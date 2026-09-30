/**
 * classifier — превращает любую ошибку (TransportError, нативная fetch-ошибка,
 * брошенная сервисом Error) в структурированный `ClassifiedError` с known-kind,
 * severity, флагом retryable и локализованным сообщением для пользователя.
 *
 * Классификация — единственная точка, где домен "понимает" коды/типы ошибок.
 * Все нижестоящие потребители (handlers шины, UI, хуки) работают только с
 * `ClassifiedError` и не лезут в детали `TransportError`.
 *
 * @see transport/errors.ts — иерархия TransportError
 * @see bus.ts — errorBus, использующий классификатор
 */

import {
  HttpError,
  NetworkError,
  ParseError,
  TimeoutError,
  TransportError,
} from "../transport";

// ----- Типы -----

/** Семантический вид ошибки. */
export type ErrorKind =
  | "network" // нет сети / DNS / connection refused
  | "timeout" // timeout запроса
  | "auth" // 401 — не авторизован
  | "forbidden" // 403 — недостаточно прав
  | "notFound" // 404
  | "conflict" // 409 — state collision
  | "validation" // 400 / 422 — некорректный ввод
  | "business" // прочие 4xx с понятной бизнес-причиной
  | "server" // 5xx
  | "parse" // ответ не распарсен
  | "unknown";

/** Severity для маршрутизации обработки (фаталик → экран, info → лог). */
export type ErrorSeverity = "fatal" | "error" | "warn" | "info";

/** Имеет ли смысл показывать пользователю кнопку «повторить». */
export type Retryability = boolean;

/**
 * ClassifiedError — каноническая форма ошибки на уровне приложения.
 * Один объект, на который можно ветвить UI и хендлеры шины.
 */
export interface ClassifiedError {
  readonly kind: ErrorKind;
  readonly severity: ErrorSeverity;
  readonly retryable: Retryability;
  /** Сообщение для пользователя (рус., готовое к показу). */
  readonly message: string;
  /** Исходная ошибка (для дебага и узких кейсов). */
  readonly original: unknown;
  /** HTTP-статус, если применимо. */
  readonly status?: number;
}

/** Опции переопределения дефолтных полей при создании `ClassifiedError`. */
export type ClassifiedOverrides = Partial<
  Pick<ClassifiedError, "status" | "message" | "severity" | "retryable">
>;

// ----- Lookup-таблицы -----

/** Локализованные сообщения по видам. */
const MESSAGES: Record<ErrorKind, string> = {
  network: "Нет соединения с сервером. Проверьте подключение к интернету.",
  timeout: "Сервер не ответил вовремя. Попробуйте ещё раз.",
  auth: "Сессия истекла. Необходимо войти заново.",
  forbidden: "Недостаточно прав для выполнения действия.",
  notFound: "Объект не найден.",
  conflict: "Конфликт состояния. Обновите страницу и попробуйте снова.",
  validation: "Некорректные данные. Проверьте введённые значения.",
  business: "Не удалось выполнить действие.",
  server: "На сервере произошла ошибка. Мы уже в курсе — попробуйте позже.",
  parse: "Сервер вернул некорректный ответ. Попробуйте обновить страницу.",
  unknown: "Произошла непредвиденная ошибка.",
};

/** Дефолтные severity/retryable по виду ошибки. */
const DEFAULTS: Record<ErrorKind, { severity: ErrorSeverity; retryable: Retryability }> = {
  network: { severity: "warn", retryable: true },
  timeout: { severity: "warn", retryable: true },
  auth: { severity: "fatal", retryable: false },
  forbidden: { severity: "error", retryable: false },
  notFound: { severity: "error", retryable: false },
  conflict: { severity: "warn", retryable: true },
  validation: { severity: "warn", retryable: false },
  business: { severity: "warn", retryable: false },
  server: { severity: "error", retryable: true },
  parse: { severity: "error", retryable: true },
  unknown: { severity: "error", retryable: false },
};

// ----- Хелперы -----

/** Собрать `ClassifiedError` с применением дефолтов для kind'а. */
function _createClassified(
  kind: ErrorKind,
  original: unknown,
  overrides: ClassifiedOverrides = {},
): ClassifiedError {
  const defaults = DEFAULTS[kind];
  return {
    kind,
    severity: overrides.severity ?? defaults.severity,
    retryable: overrides.retryable ?? defaults.retryable,
    message: overrides.message ?? MESSAGES[kind],
    original,
    status: overrides.status,
  };
}

/** Точный статус → ErrorKind (диапазоны — ниже, точный матч приоритетнее). */
const STATUS_KINDS: Record<number, ErrorKind> = {
  400: "validation",
  401: "auth",
  403: "forbidden",
  404: "notFound",
  409: "conflict",
  422: "validation",
};

/** Диапазоны статусов → ErrorKind (порядок значим, первый подходящий побеждает). */
const STATUS_RANGES: ReadonlyArray<readonly [from: number, to: number, kind: ErrorKind]> = [
  [400, 499, "business"],
  [500, 599, "server"],
];

/** HTTP-статус → ErrorKind. */
function _classifyHttpStatus(
  status: number | undefined,
  original: HttpError,
): ClassifiedError {
  // HttpError всегда создаётся со статусом; optional он только в базовом
  // TransportError-типе. undefined — защитная ветка на unknown.
  if (status === undefined) return _createClassified("unknown", original);
  const kind =
    STATUS_KINDS[status] ??
    STATUS_RANGES.find(([from, to]) => status >= from && status <= to)?.[2];
  return _createClassified(kind ?? "unknown", original, { status });
}

// ----- Публичный API -----

/**
 * Классифицировать любую ошибку.
 *
 * Знает про:
 *   - `TransportError` (и подклассы NetworkError/TimeoutError/HttpError/ParseError)
 *   - нативные `TypeError`/`DOMException` от fetch (NetworkError в браузере)
 *   - произвольный `Error` с сообщением (fallback на unknown)
 *
 * ```ts
 * try {
 *   await api.fetchProfile();
 * } catch (err) {
 *   const c = classifyError(err);
 *   if (c.kind === "auth") redirectToLogin();
 * }
 * ```
 */
export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof TransportError) {
    if (err instanceof NetworkError) return _createClassified("network", err);
    if (err instanceof TimeoutError) return _createClassified("timeout", err);
    if (err instanceof ParseError) return _createClassified("parse", err);
    if (err instanceof HttpError) return _classifyHttpStatus(err.status, err);
    return _createClassified("unknown", err);
  }

  // Браузерный fetch при network-failure кидает TypeError('Failed to fetch')
  // или DOMException с name 'AbortError'/'TimeoutError'.
  if (err instanceof DOMException) {
    if (err.name === "AbortError") return _createClassified("timeout", err);
    if (err.name === "TimeoutError") return _createClassified("timeout", err);
  }
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return _createClassified("network", err);
  }

  if (err instanceof Error) {
    return _createClassified("unknown", err, { message: err.message });
  }

  // Совсем непонятное — string/null/undefined.
  return _createClassified("unknown", err);
}
