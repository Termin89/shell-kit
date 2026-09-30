/**
 * useServiceQuery / useServiceMutation — унифицированные хуки поверх query-порта.
 *
 * Важные свойства:
 *
 * 1. **Fetch-функция возвращает `TData`, не `TransportResponse<TData>`.** Сервисы
 *    разворачивают `{ ok, data | error }` сами и кидают `Error`/`TransportError`
 *    при сбое. Хук ловит → классифицирует → эмитит в `errorBus` → возвращает
 *    `error` в компонент.
 *
 * 2. **Дедупликация.** Параллельные вызовы с одинаковым ключом шарят один
 *    Promise — записанный в `CacheEntry.promise`.
 *
 * 3. **Кеш глобальный.** Хук читает запись из порта; если данных нет, фетчит.
 *    После мутации — `invalidate(prefix)` + `reloadOn` вызывают ре-фетч
 *    подписчиков.
 *
 * 4. **Локальная ошибка.** Помимо `errorBus`, компонент получает `error`
 *    в return-значении для локальной UI-обработки (inline-сообщение в форме).
 *
 * @see configureQuery.ts — getQueryPort() источник адаптера
 * @see errors/bus.ts — errorBus для глобальной маршрутизации
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { classifyError, type ClassifiedError } from "../errors";
import { errorBus } from "../errors";
import { getQueryPort } from "./configureQuery";
import { type CacheEntry, type QueryKey } from "./QueryPort";

// ----- Типы -----

/**
 * Результат запроса. Все поля read-only; `reload` — единственная мутация.
 *
 * @typeParam TData — тип данных запроса.
 */
export interface QueryResult<TData> {
  readonly data?: TData;
  readonly error?: ClassifiedError;
  readonly loading: boolean;
  reload(): Promise<void>;
}

/** Опции запроса. */
export interface UseQueryOptions {
  /** Если false — запрос не выполняется (ждёт enable). По умолчанию true. */
  readonly enabled?: boolean;
  /** Перечитывать при изменении этих значений (deps). */
  readonly reloadOn?: readonly unknown[];
}

/**
 * Результат мутации.
 *
 * @typeParam TArgs — аргументы мутатора.
 * @typeParam TResult — результат мутатора (по умолчанию void).
 */
export interface MutationResult<TArgs, TResult> {
  mutate(args: TArgs): Promise<TResult>;
  readonly loading: boolean;
  readonly error?: ClassifiedError;
}

// ----- useServiceQuery -----

/**
 * useServiceQuery — выполнить запрос и закешировать результат.
 *
 * @param key     Уникальный ключ запроса (например, ["orders", "list"]).
 * @param fetcher Безопасная функция: возвращает TData, кидает Error при сбое.
 * @param options enabled / reloadOn.
 *
 * @typeParam TData — тип данных запроса.
 *
 * ```ts
 * const { data: orders, loading, error } = useServiceQuery(
 *   ["orders", "list"],
 *   () => ordersService.listOrders(),
 * );
 * ```
 */
export function useServiceQuery<TData>(
  key: QueryKey,
  fetcher: () => Promise<TData>,
  options: UseQueryOptions = {},
): QueryResult<TData> {
  const port = getQueryPort();
  const { enabled = true, reloadOn = [] } = options;

  // Fetcher может меняться каждый рендер (inline arrow) — берём через ref,
  // чтобы не пересоздавать runFetch и не ломать dedup-логику.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Триггер ре-рендера при нотификации от порта.
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((n) => n + 1), []);

  // Stable key string для deps.
  const keyId = port.serializeKey(key);

  const runFetch = useCallback(async (): Promise<void> => {
    const existing = port.read<TData>(key);
    if (existing?.promise) {
      // Дедупликация: уже кто-то качает этот ключ.
      return existing.promise;
    }

    const promise = (async () => {
      const prev = port.read<TData>(key);
      port.write<TData>(key, {
        ...prev,
        loading: true,
        error: undefined,
        promise: undefined,
      });
      try {
        const data = await fetcherRef.current();
        const entry: CacheEntry<TData> = {
          data,
          loading: false,
          error: undefined,
          promise: undefined,
          updatedAt: Date.now(),
        };
        port.write<TData>(key, entry);
      } catch (err) {
        const classified = classifyError(err);
        // Эмитим в глобальную шину (она тоже классифицирует, но дёшево).
        errorBus.emit(err);
        const entry: CacheEntry<TData> = {
          ...port.read<TData>(key),
          loading: false,
          error: classified,
          promise: undefined,
        };
        port.write<TData>(key, entry);
      }
    })();

    const current = port.read<TData>(key) ?? ({} as CacheEntry<TData>);
    port.write<TData>(key, { ...current, loading: true, promise });
    await promise;
  }, [port, key]);

  // Подписка на изменения по ключу + первичный фетч.
  useEffect(() => {
    // Инвалидация (adapter.invalidate) удаляет запись из кеша и
    // нотифицирует подписчика, но deps этого эффекта не меняются —
    // без перечитки здесь запрос остался бы без данных до следующей
    // навигации. Перечитываем, только если данные БЫЛИ и исчезли
    // (инвалидация сняла готовую запись): у ошибочного первого фетча
    // и запросов с undefined-результатом данных не было — ре-фетч по
    // каждой нотификации зациклил бы их. Дедупликация по
    // CacheEntry.promise страхует параллельные перечитки.
    let hadData = port.read<TData>(key)?.data !== undefined;
    const onNotify = (): void => {
      const entry = port.read<TData>(key);
      const invalidated = hadData && entry?.data === undefined;
      hadData = entry?.data !== undefined;
      rerender();
      if (enabled && invalidated && !entry?.promise) {
        void runFetch();
      }
    };

    const unsubscribe = port.subscribe(key, onNotify);

    if (enabled) {
      const entry = port.read<TData>(key);
      // Фетчим, если данных нет или они были с ошибкой.
      if (entry?.data === undefined && !entry?.promise) {
        void runFetch();
      }
    }

    return () => {
      unsubscribe();
    };
    // reloadOn — намеренно спредится в deps: изменение значений = ре-фетч.
  }, [keyId, enabled, ...reloadOn]);

  const reload = useCallback(async () => {
    await runFetch();
  }, [runFetch]);

  const entry = port.read<TData>(key);
  return {
    data: entry?.data,
    error:
      entry?.error !== undefined ? (entry.error as ClassifiedError) : undefined,
    loading: entry?.loading ?? false,
    reload,
  };
}

// ----- useServiceMutation -----

/**
 * useServiceMutation — обёртка над мутацией с loading/error-стейтом.
 *
 * Мутации не кешируются; после успеха обычно звать `port.invalidate(prefix)`
 * для сброса связанных query. Хук не делает это автоматически — инвалидация
 * бизнес-специфична (пример: после `setOrderStatus` инвалидируем `["orders"]`).
 *
 * NB: `mutator` входит в deps `useCallback` — при inline arrow функция
 * `mutate` пересоздаётся каждый рендер. Для стабильной ссылки передавайте
 * memoized-функцию (useCallback) или метод сервиса.
 *
 * @typeParam TArgs — аргументы мутатора.
 * @typeParam TResult — результат мутатора (по умолчанию void).
 *
 * ```ts
 * const { mutate: setStatus, loading } = useServiceMutation(
 *   (args: { id: string; status: OrderStatus }) =>
 *     ordersService.setStatus(args.id, args.status),
 * );
 * await setStatus({ id, status: "shipped" });
 * await getQueryPort().invalidate(["orders"]);
 * ```
 */
export function useServiceMutation<TArgs, TResult = void>(
  mutator: (args: TArgs) => Promise<TResult>,
): MutationResult<TArgs, TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClassifiedError | undefined>(undefined);

  const mutate = useCallback(
    async (args: TArgs): Promise<TResult> => {
      setLoading(true);
      setError(undefined);
      try {
        const result = await mutator(args);
        setLoading(false);
        return result;
      } catch (err) {
        errorBus.emit(err);
        setError(classifyError(err));
        setLoading(false);
        throw err;
      }
    },
    [mutator],
  );

  return { mutate, loading, error };
}
