import type { TransportConfig } from "../config";
import { HttpError, NetworkError, ParseError, TimeoutError } from "../errors";
import type { QueryParams, TransportRequest } from "../types";

/** Собрать URL: baseUrl + нормализованный путь + query (без undefined). */
function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${cleanPath}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs.length > 0 ? `${url}?${qs}` : url;
}

/** Abort по таймауту приходит как DOMException с name === "AbortError". */
function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "AbortError"
  );
}

/**
 * Достаёт человекочитаемое сообщение из тела ошибки.
 *
 * Поддержаны формы `{ errors: [{ message }] }`, `{ error: { message } }`,
 * `{ message }` и plain-text. Если ничего не распознали — обобщённое
 * `Request failed with status N`.
 */
function extractErrorMessage(parsed: unknown, status: number): string {
  if (typeof parsed === "string" && parsed.length > 0) return parsed;
  if (parsed !== null && typeof parsed === "object") {
    const body = parsed as Record<string, unknown>;
    const errors = body.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0] as { message?: unknown };
      if (typeof first?.message === "string" && first.message.length > 0) {
        return first.message;
      }
    }
    const err = body.error;
    if (err !== null && typeof err === "object") {
      const m = (err as { message?: unknown }).message;
      if (typeof m === "string" && m.length > 0) return m;
    }
    if (typeof body.message === "string" && body.message.length > 0) {
      return body.message;
    }
  }
  return `Request failed with status ${status}`;
}

/**
 * Единственный запрос fetch: JSON туда, JSON/text обратно, таймаут через
 * AbortController. Любой сбой — исключение соответствующего подкласса
 * TransportError; наверху (HttpTransport) оно заворачивается в конверт.
 */
export async function fetchJson<T>(
  req: TransportRequest,
  config: TransportConfig,
): Promise<T> {
  const url = buildUrl(config.baseUrl, req.path, req.query);
  const timeoutMs = req.timeoutMs ?? config.defaultTimeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    ...config.defaultHeaders,
    ...req.headers,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: req.method,
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: controller.signal,
      credentials: "include",
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new TimeoutError(timeoutMs, err);
    }
    const message =
      err instanceof Error ? err.message : "Network request failed";
    throw new NetworkError(message, err);
  } finally {
    clearTimeout(timer);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  let parsed: unknown;
  if (isJson) {
    try {
      parsed = await response.json();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse JSON";
      throw new ParseError(message, err);
    }
  } else {
    parsed = await response.text();
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      extractErrorMessage(parsed, response.status),
      parsed,
    );
  }

  return parsed as T;
}
