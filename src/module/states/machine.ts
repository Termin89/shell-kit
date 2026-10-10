import { matchPath } from "../../router/port";
import type { GotoOptions, StateAccess, StatesDeclaration } from "./types";
import { logStatesIssues, validateStates } from "./validate";

/**
 * states/machine — стейт-машина экрана: резолв адреса в состояние,
 * переходы (goto/send), инвариант внутренних состояний, доступ и
 * журнал переходов. Headless: знает источник адреса только через
 * инжекцию (ModuleStateSource), React-обвязка — react.tsx/hooks.ts.
 *
 * Ключевые правила:
 *
 * - **Адресуемое** (`path`) резолвится таблицей маршрутов; матчи
 *   статик-сегменты вперёд динамических («/admin» и «/new» раньше
 *   «/:id» — служебный хвост не становится id).
 * - **Внутреннее** (`host`) живёт в слоте памяти и видно ⟺ текущий
 *   адрес — это host.path. Любая внешняя смена адреса сбрасывает
 *   слот (browser-back из внутреннего состояния выходит на host).
 * - **reload → host**: внутренние состояния не персистятся, после
 *   перезагрузки показывается host-состояние по адресу.
 * - **onEnter** вызывает машина при фактическом переходе — не
 *   React-эффект, поэтому StrictMode не задваивает.
 */

/** Источник адреса в пространстве машины (модульный хвост или полный путь). */
export interface ModuleStateSource {
  /** Текущий путь (pathname без query), например "/123" или "/login". */
  readonly getPath: () => string;
  /** Строка query (location.search) — роутер держит только pathname. */
  readonly getQuery?: () => string;
  /** Навигация: путь в пространстве машины + replace вместо push. */
  readonly navigate: (path: string, options?: { readonly replace?: boolean }) => void;
}

/** Снимок машины: адресные данные + вариант активного состояния. */
export interface ModuleStateSnapshot<Id extends string = string> {
  readonly state: Id;
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<URLSearchParams>;
  readonly variant: string | null;
}

/** Запись журнала переходов (кольцо, включается опцией journal). */
export interface JournalEntry<Id extends string = string> {
  readonly state: Id;
  readonly time: number;
  readonly source: "url" | "goto" | "send";
}

/** Итог проверки доступа к состоянию. */
export interface AccessVerdict {
  readonly allowed: boolean;
  /** Состояние-убежище при запрете (replace на его путь), если объявлено. */
  readonly fallback?: string;
}

export interface ModuleStateMachineOptions<Role extends string = string> {
  /** Источник адреса — единственное, что машина знает о навигации. */
  readonly source: ModuleStateSource;
  /** Роли текущего пользователя — инъекция для проверки access.roles/guard. */
  readonly getRoles?: () => readonly Role[];
  /** Включить журнал переходов (кольцо ~100 записей) — для dev-тулы. */
  readonly journal?: boolean;
  /**
   * Имя в dev-реестре машин: каталог состояний тулы находит машины
   * по нему (регистрируются и standalone-машины — например, auth).
   */
  readonly devId?: string;
}

export interface ModuleStateMachine<
  Id extends string = string,
  Role extends string = string,
  Signal extends string = string,
> {
  readonly declaration: StatesDeclaration<Id, Role, Signal>;
  /** Стабильный снапшот для useSyncExternalStore. */
  getSnapshot(): ModuleStateSnapshot<Id>;
  subscribe(onChange: () => void): () => void;
  /** Пересчитать состояние из источника (внешняя смена адреса). */
  sync(): void;
  /** Прямой прыжок: адресуемое → navigate, внутреннее → слот памяти. */
  goto(id: Id, options?: GotoOptions): void;
  /** Семантический маршрут: сигналы состояния → глобальные → предупреждение. */
  send(signal: Signal): void;
  /** Матч пути по таблице маршрутов (без notFound-фолбэка). */
  resolve(
    path: string,
  ): { readonly id: Id; readonly params: Readonly<Record<string, string>> } | null;
  /** Собрать путь адресуемого состояния из шаблона и params. */
  buildPath(id: Id, params?: Readonly<Record<string, string>>): string;
  /** Проверить доступ (roles через getRoles + guard) — рантайм. */
  checkAccess(id: Id, params?: Readonly<Record<string, string>>): AccessVerdict;
  /** Статическая матрица «роль-набор → состояние» (guard не проецируется). */
  accessProjection(roles: readonly string[]): Record<Id, boolean>;
  /** Копия журнала переходов (старые записи снизу). */
  journalEntries(): readonly JournalEntry<Id>[];
  /** Остановить машину: очистка onEnter, снятие с реестра. */
  dispose(): void;
}

/** Машина в dev-реестре (типы стёрты — реестр для тул, не для кода). */
export interface RegisteredStateMachine {
  readonly id: string;
  readonly machine: ModuleStateMachine<string, string, string>;
}

const JOURNAL_LIMIT = 100;

/** Реестр живых машин для dev-каталога состояний (лёгкий, по devId). */
const devRegistry = new Map<string, ModuleStateMachine<string, string, string>>();

/** Живые машины по devId — источник каталога состояний dev-тулы. */
export function getRegisteredStateMachines(): readonly RegisteredStateMachine[] {
  return [...devRegistry.entries()].map(([id, machine]) => ({ id, machine }));
}

interface RouteEntry {
  readonly id: string;
  readonly pattern: string;
  readonly dynamic: number;
}

/** Динамических сегментов в шаблоне (":name" и "*"). */
const dynamicSegments = (pattern: string): number =>
  pattern.split("/").filter((s) => s.startsWith(":") || s === "*").length;

/**
 * Таблица маршрутов: статик-первыми (меньше динамических сегментов —
 * раньше). При равном весе решает порядок объявления — «/admin» и
 * «/new» матчатся раньше «/:id».
 */
function buildRoutes(
  states: Readonly<Record<string, { readonly path?: string }>>,
): RouteEntry[] {
  const routes: RouteEntry[] = [];
  for (const [id, config] of Object.entries(states)) {
    if (config.path !== undefined) {
      routes.push({ id, pattern: config.path, dynamic: dynamicSegments(config.path) });
    }
  }
  return routes.sort((a, b) => a.dynamic - b.dynamic);
}

/**
 * Создаёт машину по декларации. Проблемы декларации логируются
 * (`[module-states]`), работа продолжается best-effort — конфигурационная
 * ошибка не роняет приложение.
 *
 * Снапшот вычисляется при создании, но `onEnter` стреляет только при
 * первом `sync()`/`goto()` — React-обёртка зовёт sync в layout-эффекте,
 * и в StrictMode повторный sync не считается переходом.
 */
export function createModuleStateMachine<
  Id extends string = string,
  Role extends string = string,
  Signal extends string = string,
>(
  declaration: StatesDeclaration<Id, Role, Signal>,
  options: ModuleStateMachineOptions<Role>,
): ModuleStateMachine<Id, Role, Signal> {
  const decl = declaration as unknown as StatesDeclaration<string, string, string>;
  const states = decl.states;
  const issues = validateStates(decl);
  if (issues.length > 0) {
    logStatesIssues(issues);
  }

  const routes = buildRoutes(states);
  const source = options.source;

  let memoryState: string | null = null;
  const variantByState = new Map<string, string>();
  const journal: JournalEntry<string>[] = [];
  const listeners = new Set<() => void>();
  let started = false; // был ли первый sync/goto (с него считается вход)
  let enteredId: string | null = null;
  let enterCleanup: (() => void) | undefined;
  let disposed = false;

  const warn = (message: string): void => {
    console.warn(`[module-states] ${message}`);
  };

  const parseQuery = (): URLSearchParams =>
    new URLSearchParams(source.getQuery?.() ?? "");

  function resolveRaw(path: string): { id: string; params: Record<string, string> } | null {
    for (const route of routes) {
      const match = matchPath(route.pattern, path);
      if (match !== null) {
        return { id: route.id, params: { ...match.params } };
      }
    }
    return null;
  }

  function resolveOrFallback(path: string): { id: string; params: Record<string, string> } {
    const resolved = resolveRaw(path);
    if (resolved !== null) {
      return resolved;
    }
    const notFound = decl.notFound;
    if (notFound !== undefined && states[notFound] !== undefined) {
      return { id: notFound, params: {} };
    }
    return { id: decl.initial, params: {} };
  }

  function paramsOfPattern(pattern: string): Record<string, string> {
    const params: Record<string, string> = {};
    for (const segment of pattern.split("/")) {
      if (segment.startsWith(":")) {
        params[segment.slice(1)] = "";
      }
    }
    return params;
  }

  function buildPathRaw(
    id: string,
    params: Readonly<Record<string, string>>,
  ): string {
    const pattern = states[id]?.path;
    if (pattern === undefined) {
      return "";
    }
    const path = pattern
      .split("/")
      .map((segment) => {
        if (!segment.startsWith(":")) {
          return segment;
        }
        const name = segment.slice(1);
        const value = params[name];
        if (value === undefined) {
          warn(`переход в «${id}» без параметра «${name}» — путь деградирует`);
          return "";
        }
        return encodeURIComponent(value);
      })
      .join("/");
    return path === "" ? "/" : path;
  }

  function checkAccessRaw(
    id: string,
    params: Readonly<Record<string, string>>,
  ): AccessVerdict {
    const access = states[id]?.access as StateAccess<Role> | undefined;
    if (access === undefined) {
      return { allowed: true };
    }
    if (access.roles !== undefined && access.roles !== "any") {
      const roles = options.getRoles?.() ?? [];
      if (!access.roles.some((role) => roles.includes(role))) {
        return { allowed: false, fallback: access.fallback };
      }
    }
    if (access.guard !== undefined) {
      const roles = options.getRoles?.() ?? [];
      if (!access.guard({ roles, params, query: parseQuery() })) {
        return { allowed: false, fallback: access.fallback };
      }
    }
    return { allowed: true };
  }

  function pushJournal(id: string, journalSource: "url" | "goto" | "send"): void {
    if (options.journal !== true) {
      return;
    }
    journal.push({ state: id, time: Date.now(), source: journalSource });
    if (journal.length > JOURNAL_LIMIT) {
      journal.splice(0, journal.length - JOURNAL_LIMIT);
    }
  }

  function runCleanup(): void {
    const cleanup = enterCleanup;
    enterCleanup = undefined;
    cleanup?.();
  }

  function paramsEqual(
    a: Readonly<Record<string, string>>,
    b: Readonly<Record<string, string>>,
  ): boolean {
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) {
      return false;
    }
    return aKeys.every((key) => a[key] === b[key]);
  }

  /** Применить состояние: снапшот + журнал + вход (onEnter) + уведомление. */
  function applySnapshot(
    id: string,
    params: Record<string, string>,
    query: URLSearchParams,
    journalSource: "url" | "goto" | "send",
  ): void {
    if (disposed) {
      return;
    }
    const variant = variantByState.get(id) ?? null;
    const unchanged =
      started &&
      snapshot.state === id &&
      paramsEqual(snapshot.params, params) &&
      snapshot.query.toString() === query.toString() &&
      snapshot.variant === variant;
    if (unchanged) {
      return;
    }
    started = true;
    snapshot = { state: id as Id, params, query, variant };
    pushJournal(id, journalSource);

    // onEnter — после записи снапшота и журнала: переход внутри эффекта
    // входа корректно ляжет в журнал следующим элементом кольца.
    if (enteredId !== id) {
      enteredId = id;
      runCleanup();
      const onEnter = states[id]?.onEnter;
      if (onEnter !== undefined) {
        const cleanup = onEnter({
          path: source.getPath(),
          params,
          query,
          goto: (id, gotoOptions) => machine.goto(id as Id, gotoOptions),
          send: (signal) => machine.send(signal as Signal),
        });
        if (typeof cleanup === "function") {
          // onEnter может вернуть Promise от асинхронной работы —
          // очисткой считается только функция.
          enterCleanup = cleanup as () => void;
        }
      }
    }

    notify();
  }

  function notify(): void {
    listeners.forEach((listener) => listener());
  }

  /** Пересчёт из источника: адрес → состояние + инвариант + доступ. */
  function refresh(journalSource: "url" | "goto" | "send"): void {
    if (disposed) {
      return;
    }
    const resolved = resolveOrFallback(source.getPath());
    let id = resolved.id;
    const params = resolved.params;

    // Инвариант: внутреннее видно ⟺ URL === host.path.
    if (memoryState !== null) {
      const hostId = states[memoryState]?.host;
      if (hostId === id) {
        id = memoryState;
      } else {
        memoryState = null;
      }
    }

    // Deep-link в закрытое состояние — replace на fallback (один шаг:
    // недоступный fallback оставляет адрес как есть, вьюха покажет denied).
    const verdict = checkAccessRaw(id, params);
    if (!verdict.allowed) {
      const fallback = verdict.fallback;
      let effectiveParams = params;
      if (
        fallback !== undefined &&
        fallback !== id &&
        checkAccessRaw(fallback, {}).allowed
      ) {
        memoryState = null;
        source.navigate(buildPathRaw(fallback, {}), { replace: true });
        const replaced = resolveOrFallback(source.getPath());
        id = replaced.id;
        effectiveParams = replaced.params;
      }
      applySnapshot(id, effectiveParams, parseQuery(), journalSource);
      return;
    }

    applySnapshot(id, params, parseQuery(), journalSource);
  }

  /** Переход: доступ → адресуемое (navigate) / внутреннее (слот). */
  function transition(
    id: string,
    gotoOptions: GotoOptions | undefined,
    journalSource: "goto" | "send",
  ): void {
    if (disposed) {
      return;
    }
    const config = states[id];
    if (config === undefined) {
      warn(`переход в «${id}»: состояние не объявлено`);
      return;
    }
    if (gotoOptions?.variant !== undefined) {
      if (gotoOptions.variant === null) {
        variantByState.delete(id);
      } else {
        variantByState.set(id, gotoOptions.variant);
      }
    }

    const verdict = checkAccessRaw(id, gotoOptions?.params ?? {});
    if (!verdict.allowed) {
      const fallback = verdict.fallback;
      if (fallback === undefined || fallback === id) {
        warn(`переход в «${id}» запрещён (доступ), fallback не объявлен`);
        return;
      }
      if (!checkAccessRaw(fallback, {}).allowed) {
        warn(`переход в «${id}» запрещён, fallback «${fallback}» тоже закрыт`);
        return;
      }
      memoryState = null;
      transition(fallback, { replace: true }, journalSource);
      return;
    }

    if (config.path !== undefined) {
      source.navigate(
        buildPathRaw(id, gotoOptions?.params ?? {}),
        gotoOptions?.replace === true ? { replace: true } : undefined,
      );
      // Источник обновляется синхронно (push/replace порт-адаптера
      // уведомляют сразу) — подтверждаем снапшот тем же источником журнала.
      refresh(journalSource);
      return;
    }

    // Внутреннее: слот памяти по host. Если адрес — не host.path,
    // сначала доезжаем до него (goto из другой точки графа).
    const hostId = config.host;
    if (hostId === undefined) {
      return; // проблему уже поймала валидация
    }
    const resolvedNow = resolveRaw(source.getPath());
    const onHost = resolvedNow !== null && resolvedNow.id === hostId;
    const params =
      gotoOptions?.params ??
      (onHost ? resolvedNow.params : paramsOfPattern(states[hostId]?.path ?? ""));
    if (!onHost) {
      source.navigate(buildPathRaw(hostId, params));
    }
    memoryState = id;
    applySnapshot(id, { ...params }, parseQuery(), journalSource);
  }

  function sync(): void {
    refresh("url");
  }

  // Снапшот при создании: без журнала/входа — они случатся на первом
  // sync/goto, чтобы React-StrictMode не задваивал onEnter.
  const initial = resolveOrFallback(source.getPath());
  let snapshot: ModuleStateSnapshot<Id> = {
    state: initial.id as Id,
    params: initial.params,
    query: parseQuery(),
    variant: null,
  };

  const machine: ModuleStateMachine<Id, Role, Signal> = {
    declaration,
    getSnapshot: () => snapshot,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    sync,
    goto: (id, gotoOptions) => transition(id as string, gotoOptions, "goto"),
    send: (signal) => {
      const currentId = snapshot.state as string;
      const target =
        states[currentId]?.signals?.[signal as string] ??
        decl.signals?.[signal as string];
      if (target === undefined) {
        warn(
          `сигнал «${signal}» не объявлен (ни в состоянии «${currentId}», ни глобально)`,
        );
        return;
      }
      transition(target, undefined, "send");
    },
    resolve: (path) => {
      const resolved = resolveRaw(path);
      return resolved === null
        ? null
        : { id: resolved.id as Id, params: resolved.params };
    },
    buildPath: (id, params) => buildPathRaw(id as string, params ?? {}),
    checkAccess: (id, params) => checkAccessRaw(id as string, params ?? {}),
    accessProjection: (roles) => {
      const projection = {} as Record<Id, boolean>;
      for (const id of Object.keys(states)) {
        const access = states[id].access;
        projection[id as Id] =
          access?.roles === undefined ||
          access.roles === "any" ||
          access.roles.some((role) => roles.includes(role));
      }
      return projection;
    },
    journalEntries: () => journal.slice() as JournalEntry<Id>[],
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      runCleanup();
      if (
        options.devId !== undefined &&
        devRegistry.get(options.devId) ===
          (machine as unknown as ModuleStateMachine<string, string, string>)
      ) {
        devRegistry.delete(options.devId);
      }
      listeners.clear();
    },
  };

  if (options.devId !== undefined) {
    devRegistry.set(
      options.devId,
      machine as unknown as ModuleStateMachine<string, string, string>,
    );
  }

  return machine;
}
