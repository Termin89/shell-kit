/**
 * data — JSON-коллекции сервисов в localStorage.
 *
 * Ключ: `<project>:<service>:<collection>`. Сервисный scope несёт версию
 * схемы (`__v`): несовпадение при открытии → автоматический сброс всех
 * ключей scope (данные пересеиваются персистентным моком). Коллекция —
 * один ключ LS целиком: мок-наборы малы (килобайты), атомарная запись
 * проще, чем per-record ключи.
 *
 * Инвариант слоя: сюда ходят только стратегии сервисов (mock сейчас,
 * api-кэш потом). Страницы и контроллеры про localStorage не знают.
 */

import { getStorageConfig } from "./configure";

/** Ключ версии схемы для сервисного scope. */
const VERSION_KEY = "__v";

export interface DataCollection<T> {
  /** Ключ LS целиком (без префиксов — уже полное имя). */
  readonly key: string;
  read(): T | undefined;
  write(value: T): void;
  /** Read-modify-write без гонки между вызовами одного тика. */
  update(fn: (current: T | undefined) => T): T;
  clear(): void;
}

/** Удалить все ключи сервисного scope (данные + служебные). */
export function clearServiceData(project: string, service: string): void {
  const prefix = `${project}:${service}:`;
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null && key.startsWith(prefix)) {
      doomed.push(key);
    }
  }
  for (const key of doomed) {
    localStorage.removeItem(key);
  }
}

/**
 * Открыть коллекцию сервисного scope. Побочный эффект первого открытия
 * scope с новой версией схемы — сброс данных scope (см. шапку).
 */
export function dataCollection<T>(
  service: string,
  collection: string,
  schemaVersion: number,
): DataCollection<T> {
  const { project } = getStorageConfig();
  const scope = `${project}:${service}`;
  const versionKey = `${scope}:${VERSION_KEY}`;
  const stored = localStorage.getItem(versionKey);

  if (stored !== null && Number(stored) !== schemaVersion) {
    clearServiceData(project, service);
  }
  if (stored !== String(schemaVersion)) {
    localStorage.setItem(versionKey, String(schemaVersion));
  }

  const key = `${scope}:${collection}`;
  return {
    key,
    read(): T | undefined {
      const raw = localStorage.getItem(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    },
    write(value: T): void {
      localStorage.setItem(key, JSON.stringify(value));
    },
    update(fn: (current: T | undefined) => T): T {
      const next = fn(this.read());
      this.write(next);
      return next;
    },
    clear(): void {
      localStorage.removeItem(key);
    },
  };
}
