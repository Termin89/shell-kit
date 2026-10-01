/**
 * useServiceQuery / useServiceMutation — унифицированные хуки поверх
 * query-порта для Solid. Ручной порт React-версии (не createProjection):
 * семантический паритет важнее идиоматики — dedup через
 * CacheEntry.promise, refetch только при «данные были и исчезли»,
 * локальная ошибка + эмит в errorBus.
 *
 * Идиоматика Solid-аргументов — getter-in: реактивные параметры
 * (`key`, `options.enabled`, `options.reloadOn`) принимаются функциями;
 * статические значения нормализуются в константный геттер. Возврат —
 * аксессоры (`data()`, `loading()`), читаются на JSX-границе.
 *
 * Структура: `createEffect(compute, apply)` — compute трекает
 * key/enabled/reloadOn, apply (writable-фаза) подписывается на ключ
 * порта и запускает первичный фетч; возвращённая отписка — cleanup.
 * Записи сигналов — только в apply, колбэках подписки (порт зовёт их
 * вне owned scope) и async-продолжениях.
 *
 * @see configureQuery.ts — getQueryPort() источник адаптера
 * @see errors/bus.ts — errorBus для глобальной маршрутизации
 */

import { createEffect, createSignal, untrack } from "solid-js";
import type { Accessor } from "solid-js";
import { classifyError } from "../errors/classifier";
import type { ClassifiedError } from "../errors/classifier";
import { errorBus } from "../errors/bus";
import { getQueryPort } from "../queries/configureQuery";
import type { CacheEntry, QueryKey } from "../queries/QueryPort";

// ----- Типы -----

/**
 * Результат запроса. Все поля — аксессоры; `reload` — единственная
 * операция.
 *
 * @typeParam TData — тип данных запроса.
 */
export interface QueryResult<TData> {
  readonly data: Accessor<TData | undefined>;
  readonly error: Accessor<ClassifiedError | undefined>;
  readonly loading: Accessor<boolean>;
  reload(): Promise<void>;
}

/** Опции запроса. Реактивные значения — функциями. */
export interface UseQueryOptions {
  /** Если false — запрос не выполняется (ждёт enable). По умолчанию true. */
  readonly enabled?: boolean | (() => boolean);
  /** Перечитывать при изменении этих значений (значения — геттером). */
  readonly reloadOn?: readonly unknown[] | (() => readonly unknown[]);
}

/**
 * Результат мутации.
 *
 * @typeParam TArgs — аргументы мутатора.
 * @typeParam TResult — результат мутатора (по умолчанию void).
 */
export interface MutationResult<TArgs, TResult = void> {
  mutate(args: TArgs): Promise<TResult>;
  readonly loading: Accessor<boolean>;
  readonly error: Accessor<ClassifiedError | undefined>;
}

// ----- useServiceQuery -----

/**
 * useServiceQuery — выполнить запрос и закешировать результат.
 *
 * @param key     Ключ запроса (например, ["orders", "list"]) или его
 *                геттер — реактивная смена ключа переподписывает хук.
 * @param fetcher Безопасная функция: возвращает TData, кидает Error при
 *                сбое. Берётся свежей на каждый вызов (ref), тело не
 *                трекается.
 * @param options enabled / reloadOn — значения или геттеры.
 *
 * @typeParam TData — тип данных запроса.
 *
 * ```ts
 * const query = useServiceQuery(
 *   () => ["orders", scope()] as const,
 *   () => ordersService.listOrders(),
 * );
 * // в JSX: {query.data()?.title} / {query.loading() && <Spinner/>}
 * ```
 */
export function useServiceQuery<TData>(
  key: QueryKey | (() => QueryKey),
  fetcher: () => Promise<TData>,
  options: UseQueryOptions = {},
): QueryResult<TData> {
  const port = getQueryPort();

  // Нормализация реактивных аргументов: статика → константный геттер.
  const getKey = typeof key === "function" ? key : () => key;
  const getEnabled =
    typeof options.enabled === "function"
      ? options.enabled
      : () => options.enabled ?? true;
  const getReloadOn =
    typeof options.reloadOn === "function"
      ? options.reloadOn
      : () => options.reloadOn ?? [];

  // Fetcher может меняться (inline arrow в компоненте) — берём через
  // ref, чтобы не ломать dedup-логику.
  const fetcherRef = { current: fetcher };
  fetcherRef.current = fetcher;

  // Начальные значения — синхронный peek в кеш (untrack: тело
  // компонента — owner, не tracking scope). Закешированные данные
  // доступны без мерцания, в полёте — loading сразу true. Каст
  // начального значения — сеттер Solid не принимает функцию-как-данные
  // напрямую; записи дальше идут updater-формой.
  const initial = untrack(() => port.read<TData>(getKey()));
  const [data, setData] = createSignal<TData | undefined>(
    initial?.data as Exclude<TData, Function> | undefined,
  );
  const [error, setError] = createSignal<ClassifiedError | undefined>(
    initial?.error as ClassifiedError | undefined,
  );
  const [loading, setLoading] = createSignal<boolean>(
    initial?.loading ?? false,
  );

  // Ключ текущей подписки; runFetch берёт его на момент вызова —
  // смена ключа не перенаправляет уже летящий запрос (паритет
  // с замыканием в React-версии).
  let currentKey: QueryKey = untrack(() => getKey());

  const syncFromPort = (): void => {
    const entry = port.read<TData>(currentKey);
    // Записи — updater-формой: сеттер Solid требует Exclude<T, Function>
    // для прямой записи значения, updater проходит без кастов.
    setData(() => entry?.data);
    setError(() => entry?.error as ClassifiedError | undefined);
    setLoading(() => entry?.loading ?? false);
  };

  const runFetch = async (): Promise<void> => {
    const key = currentKey;
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
        const result = await fetcherRef.current();
        const entry: CacheEntry<TData> = {
          data: result,
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
  };

  // Подписка на изменения по ключу + первичный фетч. Compute трекает
  // key/enabled/reloadOn (геттеры читают сигналы компонента); apply —
  // сайд-эффекты и записи (writable-фаза эффектов).
  createEffect(
    () => ({ key: getKey(), enabled: getEnabled(), deps: getReloadOn() }),
    ({ key, enabled }) => {
      currentKey = key;
      // Инвалидация (adapter.invalidate) удаляет запись из кеша и
      // нотифицирует подписчика, но tracked-источники эффекта не
      // меняются — без перечитки здесь запрос остался бы без данных
      // до следующей навигации. Перечитываем, только если данные БЫЛИ
      // и исчезли (инвалидация сняла готовую запись): у ошибочного
      // первого фетча и запросов с undefined-результатом данных не
      // было — ре-фетч по каждой нотификации зациклил бы их.
      // Дедупликация по CacheEntry.promise страхует параллельные.
      let hadData = port.read<TData>(key)?.data !== undefined;
      const onNotify = (): void => {
        const entry = port.read<TData>(currentKey);
        const invalidated = hadData && entry?.data === undefined;
        hadData = entry?.data !== undefined;
        syncFromPort();
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

      return unsubscribe;
    },
  );

  const reload = async (): Promise<void> => {
    await runFetch();
  };

  return { data, error, loading, reload };
}

// ----- useServiceMutation -----

/**
 * useServiceMutation — обёртка над мутацией с loading/error-стейтом.
 *
 * Мутации не кешируются; после успеха обычно звать
 * `getQueryPort().invalidate(prefix)` для сброса связанных query.
 * Хук не делает это автоматически — инвалидация бизнес-специфична.
 *
 * @typeParam TArgs — аргументы мутатора.
 * @typeParam TResult — результат мутатора (по умолчанию void).
 *
 * ```ts
 * const mutation = useServiceMutation(
 *   (args: { id: string }) => ordersService.setStatus(args.id, "shipped"),
 * );
 * // в обработчике: await mutation.mutate({ id })
 * ```
 */
export function useServiceMutation<TArgs, TResult = void>(
  mutator: (args: TArgs) => Promise<TResult>,
): MutationResult<TArgs, TResult> {
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<ClassifiedError | undefined>(
    undefined,
  );

  const mutatorRef = { current: mutator };
  mutatorRef.current = mutator;

  const mutate = async (args: TArgs): Promise<TResult> => {
    // Синхронная часть выполняется в обработчике/apply (вне owned
    // scope), продолжения — после await, записи легальны.
    setLoading(true);
    setError(undefined);
    try {
      const result = await mutatorRef.current(args);
      setLoading(false);
      return result;
    } catch (err) {
      errorBus.emit(err);
      setError(classifyError(err));
      setLoading(false);
      throw err;
    }
  };

  return { mutate, loading, error };
}
