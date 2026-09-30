/**
 * Бизнес-часть страницы заказов: сервис (через диспетчер), query-кеш,
 * shell-состояние. Отдаёт пропсы чистой вьюхе.
 */

import { useState } from "react";
import { useDemoState } from "../../state";
import { getQueryPort, useServiceMutation, useServiceQuery } from "shell-kit/queries";
import { NEXT_STATUS, ordersService } from "./service";
import type { Order, OrderStatus } from "./service";
import type { OrdersPageProps } from "./OrdersPage";

/** Префикс ключей запросов заказов — его инвалидирует мутация. */
const ORDERS_PREFIX = ["orders"] as const;

export function useOrdersProps(): OrdersPageProps {
  const { mockOrders } = useDemoState();
  const source = mockOrders ? "mock" : "api";

  // revision поднимается после мутации: invalidate чистит кеш, а смена
  // reloadOn пересоздаёт эффект — подписчики перечитывают список.
  const [revision, setRevision] = useState(0);

  // Источник — часть ключа: кеш mock и api раздельный, переключение
  // тумблера = новый ключ = запрос новой стратегии (диспетчер резолвит
  // реализацию per-call), а возврат на mock мгновенный — старая запись
  // кеша не вытеснялась.
  const { data, loading, error, reload } = useServiceQuery(
    ["orders", "list", source],
    () => ordersService.listOrders(),
    { reloadOn: [revision] },
  );

  const { mutate, loading: saving, error: saveError } = useServiceMutation(
    (args: { id: string; status: OrderStatus }) =>
      ordersService.setOrderStatus(args.id, args.status),
  );

  const onAdvance = (order: Order): void => {
    const next: OrderStatus | undefined = NEXT_STATUS[order.status];
    if (!next) return;
    void mutate({ id: order.id, status: next })
      .then(async () => {
        await getQueryPort().invalidate(ORDERS_PREFIX);
        setRevision((n) => n + 1);
      })
      .catch(() => {
        // ошибка уже классифицирована: saveError локально + тост через шину
      });
  };

  return {
    orders: data,
    loading,
    error,
    source: mockOrders ? "mock" : "api",
    saving,
    saveError,
    onRetry: () => void reload(),
    onAdvance,
  };
}
