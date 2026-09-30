import type { AppState } from "../core/types";

/**
 * Контекст разрешения стратегии. Строится **per-call** из services-конфига
 * конструктора Shell + текущего состояния: флаги моков и state читаются
 * на момент вызова метода, поэтому диспетчер переключает реализацию
 * мгновенно, без пересоздания сервиса.
 *
 * @typeParam S — состояние приложения (AppState приложения).
 */
export interface ResolveContext<S extends AppState = AppState> {
  /** Базовый URL API из services-конфига Shell. */
  readonly baseUrl: string;
  /** Доступ к токену сессии (для auth-заголовков SmartyClient, этап C). */
  readonly getToken: () => string | undefined;
  /**
   * Флаги моков. Объект из services-конфига: MockPanel (этап D) меняет
   * значения в нём — диспетчер перечитывает их на каждом вызове.
   */
  readonly mockFlags: Readonly<Record<string, boolean>>;
  /** Текущее состояние Shell (scope, права, окружение). */
  readonly state: S;
}

/**
 * Стратегия — один кандидат на роль реализации сервиса.
 *
 * @typeParam TService — интерфейс сервиса (описывается руками, см. план).
 */
export interface ServiceStrategy<TService extends object> {
  /** Идентификатор для логов и реестра: "mock" | "api" | ... */
  readonly id: string;
  /**
   * Ключ флага в `ctx.mockFlags`, которым включается эта стратегия.
   * Наличие поля включает стратегию в реестр моков (его читает MockPanel
   * этапа D: список сервисов + тумблер по этому ключу).
   */
  readonly mock?: string;
  /** true, если стратегия применима в текущем контексте. */
  available(ctx: ResolveContext): boolean;
  /** Создать инстанс реализации. Вызывается лениво, один раз на стратегию. */
  create(ctx: ResolveContext): TService;
}

/** Опции defineService. */
export interface DefineServiceOptions<TService extends object> {
  /** Id сервиса: ключ в реестре, используется в ключах query и логах. */
  readonly id: string;
  /**
   * Кандидаты в порядке приоритета: первый, чей `available()` вернул true,
   * обслуживает вызов. Последним обычно идёт безусловный `api`.
   */
  readonly strategies: ReadonlyArray<ServiceStrategy<TService>>;
}
