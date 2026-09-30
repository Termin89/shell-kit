import { bindServiceContextSource } from "../service/context";
import type { ResolveContext } from "../service/types";
import type {
  AppState,
  ModuleConfig,
  ModuleEntry,
  ServicesConfig,
  ShellStatus,
} from "./types";

/**
 * Сигнал init-функции bootstrap: сессии нет (например, API ответил 401).
 * Это не сбой: bootstrap перейдёт в статус unauthenticated, активация
 * модулей останется подавленной, ShellGate покажет auth-слот; после
 * логина — retryBootstrap() прогоняет init заново.
 */
export class UnauthenticatedError extends Error {
  constructor(message = "сессия не найдена") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/**
 * Ядро Shell: реестр модулей, резолв видимости (enabled) и bootstrap.
 * Навигация и выбор отображаемого модуля — ответственность consumer'а.
 */
export class Shell<
  S extends AppState = AppState,
  TModules extends readonly ModuleConfig<S>[] = readonly ModuleConfig<S>[],
> {
  private modules: Map<string, ModuleEntry<S>> = new Map();
  private activeModuleIds: Set<string> = new Set();
  private state: S;
  private stateListeners: Array<(state: S) => void> = [];
  private moduleChangeListeners: Array<() => void> = [];
  private status: ShellStatus = "idle";
  private statusListeners: Array<(status: ShellStatus) => void> = [];
  private bootstrapError?: Error;
  private bootstrapInit?: (state: S) => Promise<Partial<S> | void>;
  private services?: ServicesConfig;

  constructor(config: {
    initialState: S;
    modules: TModules;
    /**
     * Конфиг services-слоя (решение из PLAN.md — не глобальный модуль):
     * Shell становится источником ResolveContext для диспетчеров
     * defineService. Не задан — сервисы работают без контекста
     * (стратегии, которым он нужен, упадут с внятной ошибкой).
     */
    services?: ServicesConfig;
  }) {
    this.state = config.initialState;
    const { services } = config;
    if (services) {
      this.services = services;
      // Свежий контекст на каждый вызов: mockFlags/state читаются
      // на момент вызова метода сервиса, а не на момент биндинга.
      bindServiceContextSource(() => this.buildResolveContext());
    }
    config.modules.forEach((m) => this.registerModule(m));
    this.syncModules();
  }

  // ----- Регистрация и загрузка модулей -----
  registerModule(config: ModuleConfig<S>): void {
    if (this.modules.has(config.id)) return;
    this.modules.set(config.id, { ...config, loaded: false });
  }

  async loadModule(id: string): Promise<any> {
    const entry = this.modules.get(id);
    if (!entry) throw new Error(`Module ${id} not found`);
    if (entry.loaded) return entry.exports;
    try {
      const exports = await entry.load();
      entry.exports = exports;
      entry.loaded = true;
      entry.error = undefined;
      return exports;
    } catch (err) {
      entry.error = err as Error;
      throw err;
    }
  }

  // ----- Доступ к активным модулям -----
  getActiveModules(): ModuleEntry<S>[] {
    return Array.from(this.modules.values()).filter((entry) =>
      this.activeModuleIds.has(entry.id),
    );
  }

  // ----- Выбор отображаемого модуля -----
  /**
   * Выбирает модуль для отображения — пишет в state.activeModule.
   * Поле остаётся в состоянии (единая поверхность: bootstrap патчит,
   * подписчики читают, выбор переживает размонтирование layout'а);
   * метод — типизированная точка записи: id ограничены конфигом
   * модулей (TModules), в рантайме проверяются по реестру.
   * Неизвестный id — предупреждение, запись всё равно происходит:
   * выбор неизвестного модуля не отличается от выбора неактивного
   * (рендерер покажет notFound). Активность и выбор разделены.
   */
  setActiveModule(id: TModules[number]["id"]): void {
    if (!this.modules.has(id)) {
      console.warn(
        `[shell] setActiveModule: модуль "${id}" не зарегистрирован`,
      );
    }
    this.setState({ activeModule: id } as Partial<S>);
  }

  // ----- Состояние -----
  getState(): S {
    return this.state;
  }

  setState(updater: Partial<S> | ((state: S) => S)): void {
    const newState =
      typeof updater === "function"
        ? updater(this.state)
        : { ...this.state, ...updater };
    this.state = newState;
    this.stateListeners.forEach((fn) => fn(this.state));
    this.syncModules();
  }

  subscribe(callback: (state: S) => void): () => void {
    this.stateListeners.push(callback);
    return () => {
      this.stateListeners = this.stateListeners.filter((fn) => fn !== callback);
    };
  }

  // ----- Событие изменения списка активных модулей -----
  onModuleChange(callback: () => void): () => void {
    this.moduleChangeListeners.push(callback);
    return () => {
      this.moduleChangeListeners = this.moduleChangeListeners.filter(
        (fn) => fn !== callback,
      );
    };
  }

  // ----- Bootstrap (асинхронная инициализация) -----
  /**
   * Запускает инициализацию: проверку авторизации, восстановление сессии,
   * загрузку окружения и т.п. Резолв инициализации — патч состояния,
   * из которого активация модулей выводится обычным путём (enabled).
   * Пока идёт инициализация (bootstrapping), активация модулей подавлена:
   * UI не должен показывать интерфейс, доступ к которому ещё не проверен.
   * Никогда не бросает исключение — результат наблюдается через статус.
   */
  bootstrap(init: (state: S) => Promise<Partial<S> | void>): void {
    if (this.status === "bootstrapping") return;
    this.bootstrapInit = init;
    void this.runBootstrap();
  }

  /**
   * Повторная попытка инициализации — из статуса error (сбой) или
   * unauthenticated (после успешного логина): init прогоняется заново.
   */
  retryBootstrap(): void {
    if (
      (this.status !== "error" && this.status !== "unauthenticated") ||
      !this.bootstrapInit
    ) {
      return;
    }
    void this.runBootstrap();
  }

  getStatus(): ShellStatus {
    return this.status;
  }

  getBootstrapError(): Error | undefined {
    return this.bootstrapError;
  }

  onStatusChange(callback: (status: ShellStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(
        (fn) => fn !== callback,
      );
    };
  }

  private async runBootstrap(): Promise<void> {
    this.bootstrapError = undefined;
    this.setStatus("bootstrapping");
    try {
      const patch = await this.bootstrapInit!(this.state);
      if (patch) {
        // Патч применяется напрямую, без syncModules: активация ещё
        // подавлена, пересчёт произойдёт в setStatus("ready").
        this.state = { ...this.state, ...patch };
        this.stateListeners.forEach((fn) => fn(this.state));
      }
      this.setStatus("ready");
    } catch (err) {
      // «Нет сессии» — не сбой: auth-слот, после логина — retry
      if (err instanceof UnauthenticatedError) {
        this.bootstrapError = undefined;
        this.setStatus("unauthenticated");
        return;
      }
      this.bootstrapError = err as Error;
      this.setStatus("error");
    }
  }

  private setStatus(status: ShellStatus): void {
    if (this.status === status) return;
    this.status = status;
    if (
      (status === "bootstrapping" || status === "unauthenticated") &&
      this.activeModuleIds.size > 0
    ) {
      this.activeModuleIds = new Set();
      this.moduleChangeListeners.forEach((fn) => fn());
    }
    if (status === "ready") {
      this.syncModules();
    }
    this.statusListeners.forEach((fn) => fn(status));
  }

  // ----- Конфиг сервисов -----
  /** Контекст для диспетчеров defineService: снимок конфига + текущее состояние. */
  private buildResolveContext(): ResolveContext<S> {
    const services = this.services;
    if (!services) {
      // Недостижимо: биндинг происходит только при заданном конфиге
      throw new Error("[shell] services-конфиг не задан");
    }
    return {
      baseUrl: services.baseUrl,
      getToken: services.getToken ?? (() => undefined),
      mockFlags: services.mockFlags,
      state: this.state,
    };
  }

  // ----- Внутренняя синхронизация -----
  private syncModules(): void {
    // Активация подавлена, пока идёт инициализация (bootstrap)
    // или ожидается вход (unauthenticated).
    const suppressed =
      this.status === "bootstrapping" || this.status === "unauthenticated";
    if (suppressed) return;
    const state = this.state;
    const newActive = new Set<string>();
    for (const [id, entry] of this.modules) {
      const isEnabled = entry.enabled ? entry.enabled(state) : true;
      if (isEnabled) {
        newActive.add(id);
        if (!entry.loaded && entry.preload) {
          this.loadModule(id).catch(() => {});
        }
      }
    }
    const changed =
      this.activeModuleIds.size !== newActive.size ||
      !Array.from(this.activeModuleIds).every((id) => newActive.has(id));
    if (changed) {
      this.activeModuleIds = newActive;
      this.moduleChangeListeners.forEach((fn) => fn());
    }
  }
}
