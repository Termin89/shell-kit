/**
 * Api-стратегия сервиса заказов: HttpTransport + разворот конверта.
 * В демо baseUrl указывает на недоступный хост — переключение тумблера
 * на api показывает полный путь ошибки: fetch → NetworkError →
 * TransportResponse { ok: false } → throw → classify → шина → хендлеры.
 */

import { HttpTransport, type TransportResponse } from "shell-kit/transport";
import type { Order, OrderStatus, OrdersService } from "./service";

/** Разворот конверта: сбой становится исключением TransportError. */
function unwrap<T>(res: TransportResponse<T>): T {
  if (!res.ok) throw res.error;
  return res.data;
}

export class OrdersApiService implements OrdersService {
  private readonly transport: HttpTransport;

  constructor(baseUrl: string) {
    this.transport = new HttpTransport({ baseUrl });
  }

  async listOrders(): Promise<Order[]> {
    const res = await this.transport.request<Order[]>({
      method: "GET",
      path: "/orders",
    });
    return unwrap(res);
  }

  async setOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const res = await this.transport.request<Order>({
      method: "PATCH",
      path: `/orders/${id}/status`,
      body: { status },
    });
    return unwrap(res);
  }
}
