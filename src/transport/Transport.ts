import type { TransportRequest, TransportResponse } from "./types";

/**
 * Порт транспорта. Реализация (HttpTransport, fetch-мок в тестах,
 * electron-IPC и т.п.) подключается снаружи — сервисы зависят только
 * от этого интерфейса.
 */
export interface ITransport {
  request<T>(req: TransportRequest): Promise<TransportResponse<T>>;
}
