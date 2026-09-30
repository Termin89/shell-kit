import { defineService } from "shell-kit/service";
import { OrdersApiService } from "./service-api";
import { OrdersMockService } from "./service-mock";

// ----- Доменные типы -----

/** Статус заказа (жизненный цикл исполнения). */
export type OrderStatus = "new" | "paid" | "shipped" | "done";

/** Заказ — доменная сущность демо-модуля «Заказы». */
export interface Order {
  /** Номер заказа («ORD-1041»). */
  id: string;
  /** Клиент («Иванов О. П.»). */
  customer: string;
  /** Количество позиций. */
  positions: number;
  /** Сумма, ₽. */
  amount: number;
  status: OrderStatus;
  /** Дата создания, ISO. */
  createdAt: string;
}

// ----- Словари домена -----

/** Следующий статус lifecycle'а; done дальше не переводится. */
export const NEXT_STATUS: Readonly<Record<OrderStatus, OrderStatus | undefined>> = {
  new: "paid",
  paid: "shipped",
  shipped: "done",
  done: undefined,
};

/** Человекочитаемые подписи статусов. */
export const STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  new: "новый",
  paid: "оплачен",
  shipped: "отправлен",
  done: "выполнен",
};

// ----- Контракт сервиса -----

/**
 * Публичный контракт сервиса заказов. Интерфейс описывается руками —
 * по нему типизирован диспетчер и (на этапе E) генерируются хуки.
 */
export interface OrdersService {
  /** Список заказов магазина. */
  listOrders(): Promise<Order[]>;
  /** Перевести заказ в новый статус; возвращает обновлённый заказ. */
  setOrderStatus(id: string, status: OrderStatus): Promise<Order>;
}

// ----- Диспетчер -----

/**
 * Сервис заказов как ленивый синглтон-диспетчер: mock-стратегия включается
 * флагом `mockFlags.orders` (тумблер в тулбаре демо), безусловная api —
 * fallback'ом. Выбор происходит на каждом вызове — переключение тумблера
 * меняет источник данных без перезагрузки.
 */
export const ordersService: OrdersService = defineService<OrdersService>({
  id: "orders",
  strategies: [
    {
      id: "mock",
      mock: "orders", // ключ флага → реестр моков (MockPanel, этап D)
      available: (ctx) => ctx.mockFlags.orders === true,
      create: () => new OrdersMockService(),
    },
    {
      id: "api",
      available: () => true,
      create: (ctx) => new OrdersApiService(ctx.baseUrl),
    },
  ],
});
