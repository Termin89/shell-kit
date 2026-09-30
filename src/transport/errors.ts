import type { TransportErrorShape } from "./types";

/**
 * Базовая ошибка транспорта. Несёт `kind` (network/timeout/http/parse) и
 * опциональный HTTP-статус — этого хватает errors-слою для классификации,
 * не заглядывая в детали. Транспорт создаёт ошибки сам; потребитель
 * (сервис) бросает их наверх из `{ ok: false }`-конверта.
 */
export class TransportError extends Error {
  readonly kind: TransportErrorShape["kind"];
  readonly status?: number;

  constructor(shape: TransportErrorShape) {
    super(shape.message);
    this.name = "TransportError";
    this.kind = shape.kind;
    this.status = shape.status;
    if (shape.cause !== undefined) {
      this.cause = shape.cause;
    }
  }
}

/** Нет сети / DNS / connection refused — fetch упал до ответа. */
export class NetworkError extends TransportError {
  constructor(message: string, cause?: unknown) {
    super({ kind: "network", message, cause });
    this.name = "NetworkError";
  }
}

/** Записали abort по таймауту — сервер не успел ответить. */
export class TimeoutError extends TransportError {
  constructor(timeoutMs: number, cause?: unknown) {
    super({
      kind: "timeout",
      message: `Request timed out after ${timeoutMs}ms`,
      cause,
    });
    this.name = "TimeoutError";
  }
}

/** Сервер ответил ненулевым статусом (4xx/5xx). */
export class HttpError extends TransportError {
  constructor(status: number, message: string, cause?: unknown) {
    super({ kind: "http", status, message, cause });
    this.name = "HttpError";
  }
}

/** Ответ не удалось разобрать (например, битый JSON). */
export class ParseError extends TransportError {
  constructor(message: string, cause?: unknown) {
    super({ kind: "parse", message, cause });
    this.name = "ParseError";
  }
}
