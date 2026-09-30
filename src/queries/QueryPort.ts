/**
 * QueryPort — интерфейс query/mutation движка.
 *
 * Это **порт** (в терминах hexagonal architecture): доменный слой описывает,
 * что ему нужно от query-движка, а конкретная реализация (`SelfRolledAdapter`
 * сейчас, в будущем — возможно `TanStackAdapter`) подключается снаружи через
 * `configureQuery()`.
 *
 * Порт — только storage/notify. React-хуки (`useServiceQuery`, `useServiceMutation`)
 * живут в `./hooks.ts` и работают поверх любого адаптера через `getQueryPort()`.
 *
 * @see SelfRolledAdapter.ts — минимальная реализация на Map + emitter
 * @see hooks.ts — useServiceQuery / useServiceMutation
 * @see configureQuery.ts — переключение адаптера
 */

// ----- Типы -----

/** Ключ запроса. Простые значения — стабильны для сравнения по элементам. */
export type QueryKey = readonly (string | number | boolean)[];

/**
 * Запись кеша по ключу.
 *
 * @typeParam TData — тип данных запроса.
 */
export interface CacheEntry<TData = unknown> {
  /** Данные последнего успешного запроса. */
  data?: TData;
  /** Ошибка последнего запроса (если был сбой). Тип задаёт потребитель. */
  error?: unknown;
  /** Идёт ли запрос прямо сейчас. */
  loading: boolean;
  /** Promise текущего запроса — чтобы дедуплицировать параллельные вызовы. */
  promise?: Promise<void>;
  /** Timestamp последнего успешного обновления (для stale-логики). */
  updatedAt?: number;
}

/** Подписка на изменения записи по конкретному ключу. */
export type CacheSubscriber = () => void;

/**
 * CachePort — синхронный сторадж кеша с подписками.
 *
 * Синхронность намеренная: React-хуки читают/пишут в синхронных фазах рендера,
 * асинхронность порта лишь усложнит reconciliation.
 */
export interface QueryPort {
  /** Прочитать запись. Возвращает undefined, если ключа нет. */
  read<TData>(key: QueryKey): CacheEntry<TData> | undefined;

  /** Записать/обновить запись и оповестить подписчиков этого ключа. */
  write<TData>(key: QueryKey, entry: CacheEntry<TData>): void;

  /** Подписаться на изменения конкретного ключа. Возвращает отписку. */
  subscribe(key: QueryKey, subscriber: CacheSubscriber): () => void;

  /**
   * Инвалидировать записи по префиксу ключа.
   * Без аргументов — сбросить весь кеш. Возвращает Promise, который резолвится,
   * когда все подписчики перечитают данные (если реализация это поддерживает).
   */
  invalidate(keyPrefix?: QueryKey): Promise<void>;

  /** Сериализовать ключ в строку (для Map-структур и логов). */
  serializeKey(key: QueryKey): string;
}

// ----- Хелперы ключей -----

/** Утилита сравнения ключей (equality по элементам). */
export function keysEqual(a: QueryKey, b: QueryKey): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** True, если `prefix` — начало `key` (или совпадает). */
export function keyStartsWith(key: QueryKey, prefix: QueryKey): boolean {
  if (prefix.length === 0) return true;
  if (key.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (key[i] !== prefix[i]) return false;
  }
  return true;
}
