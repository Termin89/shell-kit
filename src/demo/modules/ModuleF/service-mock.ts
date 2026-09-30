/**
 * Mock-стратегия сервиса заказов: правдоподобные данные в памяти инстанса
 * (инстанс живёт в кеше диспетчера — статус заказа переживает переключение
 * источника туда-обратно), задержки имитируют сеть, чтобы был виден loading.
 */

import type { Order, OrdersService, OrderStatus } from "./service";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const SEED: Order[] = [
  {
    id: "ORD-1042",
    customer: "Иванов О. П.",
    positions: 3,
    amount: 12_400,
    status: "new",
    createdAt: "2026-08-17",
  },
  {
    id: "ORD-1041",
    customer: "Петрова А. С.",
    positions: 1,
    amount: 2_990,
    status: "paid",
    createdAt: "2026-08-16",
  },
  {
    id: "ORD-1039",
    customer: "Сидоров К. В.",
    positions: 7,
    amount: 48_300,
    status: "shipped",
    createdAt: "2026-08-14",
  },
  {
    id: "ORD-1036",
    customer: "Кузнецова М. И.",
    positions: 2,
    amount: 8_750,
    status: "done",
    createdAt: "2026-08-11",
  },
  {
    id: "ORD-1034",
    customer: "ООО «Прокат+»",
    positions: 12,
    amount: 103_600,
    status: "new",
    createdAt: "2026-08-09",
  },
];

export class OrdersMockService implements OrdersService {
  private orders: Order[] = structuredClone(SEED);

  async listOrders(): Promise<Order[]> {
    await wait(700); // имитация сети — видно скелет loading
    return structuredClone(this.orders);
  }

  async setOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    await wait(300);
    const idx = this.orders.findIndex((o) => o.id === id);
    if (idx === -1) {
      throw new Error(`Заказ ${id} не найден`);
    }
    this.orders[idx] = { ...this.orders[idx], status };
    return structuredClone(this.orders[idx]);
  }
}
