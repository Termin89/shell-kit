export interface AppState {
  /**
   * Модуль, выбранный для отображения. null — ничего не выбрано,
   * layout применяет свой fallback (entry, первый активный).
   * Ядро поле не интерпретирует — только тип требует и переносит
   * через состояние.
   */
  activeModule: string | null;
}

export interface ModuleConfig<S extends AppState = AppState> {
  id: string;
  load: () => Promise<any>;
  enabled?: (state: S) => boolean;
  preload?: boolean;
}

/** Запись реестра: конфиг модуля + состояние загрузки. */
export interface ModuleEntry<S extends AppState = AppState>
  extends ModuleConfig<S> {
  loaded: boolean;
  exports?: any;
  error?: Error;
}

/**
 * Конфиг services-слоя — источник `ResolveContext` для диспетчеров
 * `defineService` (см. service/types.ts). Примитивы и функции: ядро
 * headless и про React не знает.
 */
export interface ServicesConfig {
  /** Базовый URL API — отсюда транспорт и SmartyClient берут адрес. */
  readonly baseUrl: string;
  /** Доступ к токену сессии; не задан — токена нет. */
  readonly getToken?: () => string | undefined;
  /**
   * Флаги моков per-service. Диспетчер читает объект на каждом вызове:
   * смена значения в нём переключает реализацию мгновенно. Источники
   * значений (URL/localStorage/env) — этап D, runtime-mock.
   */
  readonly mockFlags: Readonly<Record<string, boolean>>;
}

/** Жизненный цикл инициализации Shell (bootstrap). */
export type ShellStatus =
  | "idle" // bootstrap не вызывался — модули активируются сразу
  | "bootstrapping" // идёт инициализация — активация модулей подавлена
  | "unauthenticated" // сессии нет — показывается auth-слот, ждём логина
  | "ready" // инициализация завершена, состояние применено
  | "error"; // инициализация упала (доступен retryBootstrap)
