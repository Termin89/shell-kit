/**
 * SelfRolledAdapter — минимальная реализация `QueryPort` без внешних зависимостей.
 *
 * Подход:
 *   - Кеш в `Map<string, CacheEntry>` в памяти модуля (один экземпляр на адаптер).
 *   - Подписки в `Map<string, Set<subscriber>>` — нотификация только по ключу.
 *   - Инвалидация по префиксу: проход по ключам, фильтр, notify подписчиков.
 *
 * Не делает: ретраев, stale-by-age, background refetch, optimistic updates.
 * Это намеренно — каркас должен быть минимальным. Если понадобится — переключаем
 * на другой адаптер через `configureQuery()`.
 *
 * @see QueryPort.ts — интерфейс
 * @see hooks.ts — useServiceQuery использует этот адаптер через getQueryPort()
 */

import {
  type CacheEntry,
  type CacheSubscriber,
  type QueryKey,
  type QueryPort,
  keyStartsWith,
} from "./QueryPort";

/** Реализация `QueryPort` на Map + emitter. Без ретраев и background-refetch. */
export class SelfRolledAdapter implements QueryPort {
  private readonly _cache = new Map<string, CacheEntry>();
  private readonly _subscribers = new Map<string, Set<CacheSubscriber>>();

  read<TData>(key: QueryKey): CacheEntry<TData> | undefined {
    return this._cache.get(this.serializeKey(key)) as
      | CacheEntry<TData>
      | undefined;
  }

  write<TData>(key: QueryKey, entry: CacheEntry<TData>): void {
    const id = this.serializeKey(key);
    this._cache.set(id, entry);
    this._notify(id);
  }

  subscribe(key: QueryKey, subscriber: CacheSubscriber): () => void {
    const id = this.serializeKey(key);
    let set = this._subscribers.get(id);
    if (!set) {
      set = new Set();
      this._subscribers.set(id, set);
    }
    set.add(subscriber);
    return () => {
      const current = this._subscribers.get(id);
      if (!current) return;
      current.delete(subscriber);
      if (current.size === 0) {
        this._subscribers.delete(id);
      }
    };
  }

  async invalidate(keyPrefix?: QueryKey): Promise<void> {
    if (keyPrefix === undefined) {
      // Сброс всего кеша. Подписчики получают «пустую» запись → ре-фетч.
      const keys = Array.from(this._cache.keys());
      this._cache.clear();
      for (const id of keys) this._notify(id);
      return;
    }

    const toInvalidate: string[] = [];
    for (const id of this._cache.keys()) {
      const key = this._deserializeKey(id);
      if (keyStartsWith(key, keyPrefix)) {
        toInvalidate.push(id);
      }
    }
    for (const id of toInvalidate) {
      this._cache.delete(id);
      this._notify(id);
    }
  }

  serializeKey(key: QueryKey): string {
    // Простой разделитель, безопасный для string|number|boolean.
    // JSON.stringify слишком тяжёлый для hot-path; ключи короткие.
    return key.map((part) => String(part)).join("/");
  }

  /** Восстановить ключ из строки — нужно только для invalidate-by-prefix. */
  private _deserializeKey(id: string): QueryKey {
    if (id === "") return [];
    return id.split("/").map((chunk) => {
      const asNum = Number(chunk);
      return Number.isFinite(asNum) && chunk !== "" ? asNum : chunk;
    });
  }

  /** Оповестить подписчиков ключа. Защищено от падения одного подписчика. */
  private _notify(id: string): void {
    const set = this._subscribers.get(id);
    if (!set) return;
    // Копируем, чтобы подписчик мог отписаться во время нотификации.
    for (const subscriber of Array.from(set)) {
      try {
        subscriber();
      } catch (err) {
        console.error("[SelfRolledAdapter] subscriber threw:", err);
      }
    }
  }
}
