import type { TransportConfig } from "../config";
import { resolveTransportConfig } from "../config";
import type { ITransport } from "../Transport";
import { NetworkError, TransportError } from "../errors";
import type { TransportRequest, TransportResponse } from "../types";
import { fetchJson } from "./fetchJson";

/**
 * HTTP-реализация ITransport на fetch. Конфиг (baseUrl, таймаут, дефолтные
 * заголовки) — опциями конструктора, а не глобальным модулем: в shell-kit
 * источник конфига — services-конфиг конструктора Shell.
 *
 * Маппинг сбоев: fetch упал → NetworkError, abort по таймауту → TimeoutError,
 * ненулевой статус → HttpError, битый JSON → ParseError. Все — в конверт
 * `{ ok: false, error }`: сам транспорт исключений не бросает.
 */
export class HttpTransport implements ITransport {
  private readonly config: TransportConfig;

  constructor(options?: Partial<TransportConfig>) {
    this.config = resolveTransportConfig(options);
  }

  async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
    try {
      const data = await fetchJson<T>(req, this.config);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof TransportError) {
        return { ok: false, error };
      }
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected transport error";
      return { ok: false, error: new NetworkError(message, error) };
    }
  }
}
