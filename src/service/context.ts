/**
 * Мост между Shell и service-слоем.
 *
 * Решение (см. PLAN.md, «Конфиг сервисов»): контекст берётся из
 * services-конфига **конструктора Shell**, а не из глобального конфиг-модуля
 * (как было в gemba-walks). Shell с конфигом `services` при создании
 * регистрирует здесь функцию-источник; диспетчеры defineService дёргают её
 * на каждом вызове метода — поэтому смена флага мока видна мгновенно.
 *
 * Это единственная точка, где ядро знает о service-слое (одна функция
 * биндинга); сам слой не импортирует ядро в рантайме — только типы.
 */

import type { ResolveContext } from "./types";

/** Текущий источник контекста. Module-private — ставится через bindServiceContextSource(). */
let _provider: (() => ResolveContext) | undefined;

/**
 * Зарегистрировать источник контекста. Вызывается конструктором Shell,
 * если передан конфиг `services`. Повторный бинд (тесты, несколько Shell)
 * — предупреждение, последний побеждает.
 */
export function bindServiceContextSource(
  provider: () => ResolveContext,
): void {
  if (_provider) {
    console.warn(
      "[service] источник контекста заменён — предыдущий Shell с services-конфигом забыт",
    );
  }
  _provider = provider;
}

/**
 * Контекст на момент вызова. Контракт диспетчера: значения свежие,
 * а не снятые при инициализации, — на этом держится мгновенное
 * переключение моков.
 */
export function getResolveContext(): ResolveContext {
  if (!_provider) {
    throw new Error(
      "[service] контекст сервисов не привязан: передайте services-конфиг " +
        "(baseUrl, getToken, mockFlags) в конструктор Shell",
    );
  }
  return _provider();
}
