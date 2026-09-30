/**
 * Реестр мок-стратегий. Заполняется defineService при описании сервисов;
 * читается MockPanel'ю этапа D (список сервисов с моками + тумблер по флагу).
 * Сейчас реестр просто собирается — потребитель появится на этапе D.
 */

/** Запись о мок-стратегии сервиса. */
export interface MockStrategyRegistration {
  /** Id сервиса (из defineService). */
  readonly serviceId: string;
  /** Id стратегии (из ServiceStrategy.id). */
  readonly strategyId: string;
  /** Ключ в mockFlags, которым мок включается/выключается. */
  readonly flag: string;
}

/** Реестр. Module-private — чтение через getMockRegistry(). */
const _registrations: MockStrategyRegistration[] = [];

/** Зарегистрировать мок-стратегию (вызывает defineService). Дедуп по паре id. */
export function _registerMockStrategy(entry: MockStrategyRegistration): void {
  const exists = _registrations.some(
    (r) => r.serviceId === entry.serviceId && r.strategyId === entry.strategyId,
  );
  if (!exists) {
    _registrations.push(entry);
  }
}

/**
 * Снимок реестра моков. Для MockPanel этапа D: тумблер сервиса пишет
 * `mockFlags[flag]`, диспетчер подхватывает на следующем вызове.
 */
export function getMockRegistry(): ReadonlyArray<MockStrategyRegistration> {
  return _registrations;
}
