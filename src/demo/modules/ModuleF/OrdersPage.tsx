/**
 * Чистая вьюха заказов: только пропсы, без сервисов и состояния.
 * Переиспользуется с другим контроллером (частичное использование модуля).
 */

import type { ClassifiedError } from "shell-kit/errors";
import { NEXT_STATUS, STATUS_LABELS } from "./service";
import type { Order, OrderStatus } from "./service";

export interface OrdersPageProps {
  orders: Order[] | undefined;
  /** Идёт первичная загрузка/перечитывание. */
  loading: boolean;
  /** Локальная ошибка запроса (классифицированная). */
  error: ClassifiedError | undefined;
  /** Откуда данные — диспетчер выбран per-call, источник виден в UI. */
  source: "mock" | "api";
  /** Идёт мутация смены статуса. */
  saving: boolean;
  /** Локальная ошибка мутации. */
  saveError: ClassifiedError | undefined;
  onRetry(): void;
  /** Перевести заказ в следующий статус lifecycle'а. */
  onAdvance(order: Order): void;
}

const STATUS_CLASS: Readonly<Record<OrderStatus, string>> = {
  new: "is-new",
  paid: "is-paid",
  shipped: "is-shipped",
  done: "is-done",
};

const money = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU");

export default function OrdersPage({
  orders,
  loading,
  error,
  source,
  saving,
  saveError,
  onRetry,
  onAdvance,
}: OrdersPageProps) {
  return (
    <section className="module-panel module-f" aria-labelledby="module-f-title">
      <header className="module-header">
        <span className="module-badge">F</span>
        <div>
          <h2 id="module-f-title">Модуль F · Заказы</h2>
          <p>
            сервис на стратегиях · источник: <code>{source}</code>
            {loading ? " · загрузка…" : ""}
          </p>
        </div>
      </header>

      {error && (
        <div className="module-error" role="alert">
          <span>{error.message}</span>
          {error.retryable && (
            <button type="button" className="toolbar-btn" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}
      {!error && saveError && (
        <p className="module-error" role="alert">
          {saveError.message}
        </p>
      )}

      {orders && orders.length > 0 && (
        <table className="orders-table">
          <thead>
            <tr>
              <th>Заказ</th>
              <th>Клиент</th>
              <th>Позиции</th>
              <th>Сумма</th>
              <th>Статус</th>
              <th>Создан</th>
              <th aria-label="Действие" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const next = NEXT_STATUS[order.status];
              return (
                <tr key={order.id}>
                  <td>
                    <code>{order.id}</code>
                  </td>
                  <td>{order.customer}</td>
                  <td>{order.positions}</td>
                  <td>{money(order.amount)}</td>
                  <td>
                    <span className={`orders-status ${STATUS_CLASS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td>{date(order.createdAt)}</td>
                  <td>
                    {next && (
                      <button
                        type="button"
                        className="toolbar-btn"
                        disabled={saving}
                        onClick={() => onAdvance(order)}
                      >
                        → {STATUS_LABELS[next]}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {orders && orders.length === 0 && (
        <p className="module-state">Заказов нет</p>
      )}
    </section>
  );
}
