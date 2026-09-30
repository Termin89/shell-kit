import type { TransportError } from "./errors";

/** HTTP-метод запроса. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Query-параметры. `undefined`-значения отбрасываются при сборке URL —
 * удобно передавать опциональные фильтры без условных spread'ов.
 */
export type QueryParams = Readonly<
  Record<string, string | number | boolean | undefined>
>;

/**
 * Запрос к транспорту: метод + путь (относительный, от baseUrl) + опции.
 * Транспорт — тупая труба: никакой бизнес-логики, только доставка.
 */
export type TransportRequest = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly query?: QueryParams;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  /** Таймаут конкретного запроса; по умолчанию — `defaultTimeoutMs`. */
  readonly timeoutMs?: number;
};

/** Вид сбоя транспорта — определяет подкласс `TransportError`. */
export type TransportErrorShape = {
  readonly kind: "network" | "timeout" | "http" | "parse";
  readonly status?: number;
  readonly message: string;
  readonly cause?: unknown;
};

/**
 * Ответ транспорта — всегда «конверт», исключений транспорт не бросает:
 * успех и сбой различаются по `ok`. Разворачивание `{ ok, data | error }`
 * в исключение — ответственность сервиса (см. `service/`).
 *
 * ```ts
 * const res = await transport.request<Order[]>({ method: "GET", path: "/orders" });
 * if (res.ok) return res.data;
 * throw res.error; // TransportError — классифицируется в errors/
 * ```
 */
export type TransportSuccess<T> = { readonly ok: true; readonly data: T };
export type TransportFailure = { readonly ok: false; readonly error: TransportError };
export type TransportResponse<T = unknown> = TransportSuccess<T> | TransportFailure;
