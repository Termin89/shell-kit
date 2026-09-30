/**
 * media — Blob-хранилище в IndexedDB + резолв MediaRef → objectURL.
 *
 * Одна база на проект (`shell-kit-media:<project>`), один object store
 * `media` (keyPath `id`). Идентификаторы медиа — строки; конвенция
 * `<service>/<имя>` (`feed/case-ukon-cover`): префикс сервисного scope
 * используется точечным clear и ни на что больше не влияет.
 *
 * `resolveMediaUrl` кеширует objectURL в памяти процесса: revoke только
 * при delete/clear — монтирование/размонтирование компонентов не отбирает
 * URL у уже показанных картинок.
 */

import { getStorageConfig } from "./configure";

/**
 * Ссылка на медиа в доменных данных сервисов: id записи media-стора
 * **или** готовый URL (http/https/data) — такие резолвятся насквозь,
 * без хранения (api-стратегия может отдавать прямые ссылки, не скачивая).
 * Отдельный тип (а не голый string) — чтобы в сигнатурах было видно,
 * что значение требует резолва (useMedia), а не готово для src.
 */
export type MediaRef = string;

export interface MediaRecord {
  readonly id: MediaRef;
  readonly blob: Blob;
  readonly mime: string;
  readonly size: number;
  readonly name?: string;
}

export interface MediaSeedEntry {
  /** Id записи (`<service>/<имя>`). */
  readonly id: MediaRef;
  /** URL источника (бандл-ассет, `${import.meta.env.BASE_URL}media/…`). */
  readonly url: string;
  readonly name?: string;
}

const STORE = "media";
const DB_PREFIX = "shell-kit-media:";

/** Кеш открытых соединений: project → соединение. */
const dbCache = new Map<string, Promise<IDBDatabase>>();

function openDb(project: string): Promise<IDBDatabase> {
  let db = dbCache.get(project);
  if (!db) {
    db = new Promise((resolve, reject) => {
      const request = indexedDB.open(`${DB_PREFIX}${project}`, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbCache.set(project, db);
  }
  return db;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ------------------------------------------------------------------ */
/* URL-кеш (module-private)                                            */
/* ------------------------------------------------------------------ */

const urlCache = new Map<MediaRef, string>();

/** Префиксы готовых URL: резолвятся насквозь, стор не нужен. */
const URL_REF_PREFIXES = ["http://", "https://", "data:"];

function isUrlRef(id: MediaRef): boolean {
  return URL_REF_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function dropCachedUrl(id: MediaRef): void {
  const url = urlCache.get(id);
  if (url !== undefined) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

/* ------------------------------------------------------------------ */
/* Публичное API                                                       */
/* ------------------------------------------------------------------ */

export async function putMedia(input: {
  id: MediaRef;
  blob: Blob;
  name?: string;
}): Promise<MediaRecord> {
  const { project } = getStorageConfig();
  const record: MediaRecord = {
    id: input.id,
    blob: input.blob,
    mime: input.blob.type,
    size: input.blob.size,
    ...(input.name !== undefined ? { name: input.name } : {}),
  };
  const db = await openDb(project);
  await requestToPromise(tx(db, "readwrite").put(record));
  return record;
}

export async function getMedia(id: MediaRef): Promise<MediaRecord | undefined> {
  const { project } = getStorageConfig();
  const db = await openDb(project);
  const record = await requestToPromise<MediaRecord | undefined>(
    tx(db, "readonly").get(id),
  );
  return record ?? undefined;
}

export async function deleteMedia(id: MediaRef): Promise<void> {
  const { project } = getStorageConfig();
  dropCachedUrl(id);
  const db = await openDb(project);
  await requestToPromise(tx(db, "readwrite").delete(id));
}

/**
 * Засидировать медиа из URL (бандл-ассеты проекта): существующие id
 * пропускаются — повторный старт ничего не перекачивает.
 */
export async function seedMedia(
  entries: readonly MediaSeedEntry[],
): Promise<void> {
  for (const entry of entries) {
    const existing = await getMedia(entry.id);
    if (existing !== undefined) {
      continue;
    }
    const response = await fetch(entry.url);
    if (!response.ok) {
      throw new Error(
        `[storage] seed-медиа "${entry.url}" недоступно: HTTP ${response.status}`,
      );
    }
    await putMedia({
      id: entry.id,
      blob: await response.blob(),
      ...(entry.name !== undefined ? { name: entry.name } : {}),
    });
  }
}

/**
 * MediaRef → objectURL для `<img src>`. Готовый URL (http/https/data)
 * возвращается как есть; id записи — из стора, objectURL кешируется на
 * процесс. Отсутствующий id резолвится в undefined (картинка не найдена).
 */
export async function resolveMediaUrl(id: MediaRef): Promise<string | undefined> {
  if (isUrlRef(id)) {
    return id;
  }
  const cached = urlCache.get(id);
  if (cached !== undefined) {
    return cached;
  }
  const record = await getMedia(id);
  if (record === undefined) {
    return undefined;
  }
  const url = URL.createObjectURL(record.blob);
  urlCache.set(id, url);
  return url;
}

/** Синхронный peek в кеш — для начального стейта useMedia без мерцания. */
export function peekMediaUrl(id: MediaRef): string | undefined {
  return isUrlRef(id) ? id : urlCache.get(id);
}

/** Удалить медиа по префиксу id (`"<service>/"`) + отобрать кеш URL. */
export async function clearMediaByPrefix(prefix: string): Promise<void> {
  const { project } = getStorageConfig();
  const db = await openDb(project);
  const store = tx(db, "readwrite");
  const cursorRequest = store.openCursor();
  await new Promise<void>((resolve, reject) => {
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor === null) {
        resolve();
        return;
      }
      const id = String(cursor.key);
      if (id.startsWith(prefix)) {
        dropCachedUrl(id);
        cursor.delete();
      }
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

/** Удалить media-базу проекта целиком (clearStorage). */
export async function dropMediaDb(project: string): Promise<void> {
  const cached = dbCache.get(project);
  if (cached !== undefined) {
    const db = await cached;
    db.close();
    dbCache.delete(project);
  }
  for (const [id, url] of urlCache) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(`${DB_PREFIX}${project}`);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve(); // соединения закрыты выше — на всякий случай
  });
}

/** Все проекты с media-базами (enumerate + фильтр по префиксу). */
export async function listMediaProjects(): Promise<readonly string[]> {
  const databases = await indexedDB.databases();
  return databases
    .map((db) => db.name)
    .filter((name): name is string => name !== undefined)
    .filter((name) => name.startsWith(DB_PREFIX))
    .map((name) => name.slice(DB_PREFIX.length));
}
