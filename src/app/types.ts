import type { ComponentType, ReactNode } from "react";
import type { AppState, ModuleConfig, ServicesConfig, Shell } from "../core";
import type { RouterConnection, RouterPort } from "../router";

/**
 * Типы слоя app: декларация приложения (defineApp) и инстанс.
 * Слой — композиция существующих примитивов ядра (storage / Shell /
 * connectRouter / провайдеры react): новое поведение не появляется,
 * фиксируется канонический порядок сборки.
 */

/** Запись модуля в декларации приложения: конфиг + мета проекта. */
export interface AppModuleEntry<M, S extends AppState = AppState>
  extends ModuleConfig<S> {
  /**
   * Мета модуля (навигационная и пр.) — проектный тип: ядро хранит
   * и отдаёт (useApp().definition.modules), но не интерпретирует.
   * Заменяет второй реестр «модули для Shell + страницы для меню».
   */
  readonly meta: M;
}

/** Режим адреса: url — адресная строка, memory — память (тесты/iframe). */
export type AppRouterMode = "url" | "memory";

export interface AppRouterConfig {
  readonly mode: AppRouterMode;
  /** База браузерной истории — прод вне корня (например /u-kon). */
  readonly basename?: string;
  /** Гейт-сегменты: первые сегменты вне реестра (auth-роуты). */
  readonly gate?: readonly string[];
}

/** Пропсы auth-экрана: onSuccess — после входа, до retryBootstrap. */
export interface AppAuthScreenProps {
  readonly onSuccess: () => void;
}

export interface AppAuthConfig<
  S extends AppState = AppState,
  M = unknown,
> {
  /** Экран гейта (ленивый чанк — оборачивается в Suspense со сплэшем). */
  readonly screen: ComponentType<AppAuthScreenProps>;
  /** Сплэш: бутстрап и загрузка auth-чанка. */
  readonly splash?: ReactNode;
  /**
   * Хук после успешного входа, до перезапуска bootstrap: канонический
   * пример — replace гейт-адреса на целевой модуль (чтобы back не
   * возвращал на /login).
   */
  readonly onSuccess?: (app: AppHandle<S, M>) => void;
}

export interface AppDevConfig {
  /**
   * Гейт тул: панель монтируется только при true. Значение —
   * define-константа проекта: на сборке сворачивается, ветки рендера
   * и чанк тул вырезаются из прода целиком.
   */
  readonly enabled: boolean;
  /** До создания Shell: override стратегий и прочая подготовка тул. */
  readonly beforeBootstrap?: () => void;
  /** Панель тул (ленивый чанк): уровень корня, вне ShellGate. */
  readonly tools?: ComponentType;
}

/**
 * Именованные слоты Root: app-специфика без children-конструктора.
 * Порядок провайдеров фиксирован, слоты — точки расширения.
 */
export interface AppSlots {
  /**
   * Над RouterProvider, вне ShellGate: тосты видны и на auth-экране.
   */
  readonly toast?: ReactNode;
  /**
   * Layout аутентифицированной зоны (внутри ShellGate): каркас
   * приложения (навигация + ModuleRenderer). Не задан — голый
   * ModuleRenderer.
   */
  readonly layout?: ReactNode;
}

/** Декларация приложения — вход defineApp. */
export interface AppDefinition<S extends AppState = AppState, M = unknown> {
  /** Идентичность хранилища: ключи LS `<project>:*`, медиа-база IDB. */
  readonly project: string;
  /** Начальное состояние; не задано — { activeModule: null }. */
  readonly state?: S;
  /** Реестр модулей с метой — единственный в приложении. */
  readonly modules: readonly AppModuleEntry<M, S>[];
  /**
   * Конфиг services-слоя (готовые значения: env-обвязка — забота
   * проекта, ядро к ней не прибито).
   */
  readonly services?: ServicesConfig;
  readonly router?: AppRouterConfig;
  /** Подписка на ошибки API — вызывается строго до bootstrap. */
  readonly errors?: (app: AppHandle<S, M>) => void;
  readonly auth?: AppAuthConfig<S, M>;
  readonly dev?: AppDevConfig;
  /** App-специфика Root: именованные слоты (тосты, layout). */
  readonly slots?: AppSlots;
  /** Init бутстрапа (восстановление сессии и т.п.); не задан — без бутстрапа. */
  readonly bootstrap?: (state: S) => Promise<Partial<S> | void>;
}

/**
 * Дескриптор приложения: всё, кроме Root. Именно он кладётся в
 * AppContext (компонентам Root сам не нужен) и передаётся хукам
 * errors/auth.onSuccess.
 */
export interface AppHandle<S extends AppState = AppState, M = unknown> {
  readonly definition: AppDefinition<S, M>;
  readonly shell: Shell<S>;
  readonly router: RouterConnection;
  readonly port: RouterPort;
}

/** Инстанс defineApp: дескриптор + корневой компонент. */
export interface AppInstance<S extends AppState = AppState, M = unknown>
  extends AppHandle<S, M> {
  /** Корень: провайдеры и гейт в каноническом порядке (createAppRoot). */
  readonly Root: ComponentType;
}
