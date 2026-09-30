/**
 * defineService — ленивый синглтон-диспетчер сервиса.
 *
 * Отличие от gemba-walks: там сервис инстанцировался при импорте по снимку
 * флагов (переключение мока = reload). Здесь диспетчер резолвит реализацию
 * **per-call** по текущему контексту: смена флага меняет реализацию со
 * следующего же вызова, а инстансы стратегий кешируются и переживают
 * переключения (возврат к api не пересоздаёт клиент).
 *
 * Контракт: интерфейс сервиса описывается руками (типами), диспетчер
 * типизирован этим интерфейсом — опечатка в методе ловится компилятором.
 *
 * ```ts
 * interface OrdersService {
 *   listOrders(): Promise<Order[]>;
 *   setOrderStatus(id: string, status: OrderStatus): Promise<Order>;
 * }
 *
 * export const ordersService: OrdersService = defineService<OrdersService>({
 *   id: "orders",
 *   strategies: [
 *     {
 *       id: "mock",
 *       mock: "orders", // ключ флага → реестр моков (MockPanel, этап D)
 *       available: (ctx) => ctx.mockFlags.orders === true,
 *       create: () => new OrdersMockService(),
 *     },
 *     {
 *       id: "api", // безусловный fallback — последняя строка обороны
 *       available: () => true,
 *       create: (ctx) => new OrdersApiService(ctx.baseUrl),
 *     },
 *   ],
 * });
 *
 * // Вызов метода — обычный, диспетчер сам выберет реализацию:
 * await ordersService.listOrders(); // стратегия резолвится в момент вызова
 * ```
 */

import { getResolveContext } from "./context";
import { _registerMockStrategy } from "./registry";
import type { DefineServiceOptions } from "./types";

/**
 * Создать диспетчер сервиса. Возвращает Proxy, типизированный интерфейсом
 * сервиса: доступ к методу прозрачен, реализация выбирается в момент
 * вызова. Инстансы стратегий создаются лениво и по одному на стратегию.
 *
 * @typeParam TService — интерфейс сервиса, описанный руками.
 */
export function defineService<TService extends object>(
  options: DefineServiceOptions<TService>,
): TService {
  const { id, strategies } = options;

  if (strategies.length === 0) {
    throw new Error(
      `[service] "${id}": список стратегий пуст — опишите хотя бы ` +
        "безусловную api-стратегию (available: () => true)",
    );
  }

  // Мок-стратегии — в реестр (его прочитает MockPanel этапа D)
  for (const strategy of strategies) {
    if (strategy.mock !== undefined) {
      _registerMockStrategy({
        serviceId: id,
        strategyId: strategy.id,
        flag: strategy.mock,
      });
    }
  }

  /** Кеш инстансов по id стратегии: переключение флагов кеш не трогает. */
  const instances = new Map<string, TService>();
  let lastWinnerId: string | undefined;

  /** Резолв per-call: свежий контекст → первая подходящая стратегия. */
  const resolve = (): TService => {
    const ctx = getResolveContext();
    const winner = strategies.find((s) => s.available(ctx));
    if (!winner) {
      const tried = strategies.map((s) => s.id).join(", ");
      throw new Error(
        `[service] "${id}": ни одна стратегия не подошла (пробовали: ${tried}). ` +
          `Проверьте mockFlags: ${JSON.stringify(ctx.mockFlags)}`,
      );
    }
    if (winner.id !== lastWinnerId) {
      console.info(`[service] "${id}" → стратегия "${winner.id}"`);
      lastWinnerId = winner.id;
    }
    let instance = instances.get(winner.id);
    if (!instance) {
      instance = winner.create(ctx);
      instances.set(winner.id, instance);
    }
    return instance;
  };

  return new Proxy({} as TService, {
    get(_target, prop) {
      const instance = resolve() as Record<string | symbol, unknown>;
      if (typeof prop === "symbol") {
        return instance[prop];
      }
      const current = instance[prop];
      // Методы оборачиваются: реализация резолвится в момент вызова,
      // а не в момент доступа к свойству.
      if (typeof current !== "function") {
        return current;
      }
      return (...args: unknown[]) => {
        const impl = resolve() as Record<string, unknown>;
        return (impl[prop] as (...a: unknown[]) => unknown).apply(impl, args);
      };
    },
  });
}
