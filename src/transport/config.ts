/**
 * Конфиг транспорта. В gemba-walks был глобальным модулем (читал env);
 * в shell-kit — значение на инстанс: базовый URL приходит из services-конфига
 * конструктора Shell, транспорт создаётся стратегией сервиса с этим URL.
 */

export interface TransportConfig {
  /**
   * Базовый URL всех запросов. Пустая строка = same-origin (в dev — прокси
   * Vite, в prod — reverse-proxy перед статикой, CORS не нужен).
   * Завершающие слеши срезаются.
   */
  readonly baseUrl: string;
  /** Таймаут по умолчанию; переопределяется per-request (`timeoutMs`). */
  readonly defaultTimeoutMs: number;
  /** Заголовки по умолчанию; мерджатся с per-request `headers`. */
  readonly defaultHeaders: Readonly<Record<string, string>>;
}

/** Дефолты (как в gemba-walks): same-origin, 15 секунд, JSON-заголовки. */
export const defaultTransportConfig: TransportConfig = {
  baseUrl: "",
  defaultTimeoutMs: 15_000,
  defaultHeaders: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
};

/** Нормализовать пользовательские опции: срез слешей + мердж с дефолтами. */
export function resolveTransportConfig(
  overrides?: Partial<TransportConfig>,
): TransportConfig {
  return {
    baseUrl: (overrides?.baseUrl ?? defaultTransportConfig.baseUrl).replace(
      /\/+$/,
      "",
    ),
    defaultTimeoutMs:
      overrides?.defaultTimeoutMs ?? defaultTransportConfig.defaultTimeoutMs,
    defaultHeaders: {
      ...defaultTransportConfig.defaultHeaders,
      ...overrides?.defaultHeaders,
    },
  };
}
