/**
 * Реестр сервисов: полный каталог стратегий + dev-override.
 *
 * Заполняется defineService при описании сервисов. Два потребителя:
 *
 * - ядро (defineService) — резолв per-call: общий хелпер resolveWinner
 *   учитывает override, одна точка правды о приоритетах;
 * - devtools (defineDev, v0.4.0) — getServiceCatalog() отдаёт каталог
 *   всех зарегистрированных сервисов с активной стратегией, панель
 *   переключает стратегии через setServiceStrategyOverride.
 *
 * Старый mock-реестр (тройки {serviceId, strategyId, flag}) сохранён
 * без изменений: узкий срез под тумблеры моков.
 */

import { getResolveContext } from "./context";
import type { ResolveContext } from "./types";

/**
 * Запись о мок-стратегии сервиса. Узкий срез реестра под тумблеры
 * моков (MockPanel): id стратегии + ключ флага.
 */
export interface MockStrategyRegistration {
  /** Id сервиса (из defineService). */
  readonly serviceId: string;
  /** Id стратегии (из ServiceStrategy.id). */
  readonly strategyId: string;
  /** Ключ в mockFlags, которым мок включается/выключается. */
  readonly flag: string;
}

/** Стратегия в записи каталога: id, ключ мока (если есть), available. */
export interface CatalogStrategy {
  readonly id: string;
  /** Ключ флага в mockFlags (только у mock-стратегий). */
  readonly mock?: string;
  /** Предикат применимости — каталог считает по нему активную. */
  available(ctx: ResolveContext): boolean;
}

/**
 * Минимальная форма кандидата для resolveWinner: любая стратегия
 * (полная ServiceStrategy или срез каталога) ей удовлетворяет.
 */
interface StrategyCandidate {
  readonly id: string;
  available(ctx: ResolveContext): boolean;
}

/** Регистрация сервиса целиком: все стратегии в порядке приоритета. */
export interface ServiceRegistration {
  readonly serviceId: string;
  readonly strategies: ReadonlyArray<CatalogStrategy>;
}

/** Публичная строка каталога: без available (внутренняя механика ядра). */
export interface ServiceCatalogEntry {
  readonly serviceId: string;
  /** Стратегии в порядке приоритета объявления. */
  /**
   * Доступные при текущем контексте стратегии; недоступные
   * (available: false — например, api-заглушка до подключения
   * backend) в каталог не попадают.
   */
  readonly strategies: ReadonlyArray<{ readonly id: string; readonly mock?: string }>;
  /** Победитель с учётом override (undefined — контекст не биндился). */
  readonly activeStrategyId?: string;
  /** Победитель без учёта override — «естественный» выбор по флагам. */
  readonly naturalStrategyId?: string;
  /** Установленный override (в LS-персисте и панели). */
  readonly overrideStrategyId?: string;
}

/** Реестр сервисов. Module-private — чтение через getServiceCatalog(). */
const _services: ServiceRegistration[] = [];

/** Override стратегий: serviceId → strategyId. Модуль-private. */
const _overrides = new Map<string, string>();

/** Mock-реестр. Module-private — чтение через getMockRegistry(). */
const _mockRegistrations: MockStrategyRegistration[] = [];

/**
 * Резолв победителя по стратегиям: одна точка правды о приоритетах.
 * Override побеждает, если стратегия с таким id существует и available;
 * иначе — честный fallback на первую available. Ни одна не подошла —
 * undefined (вызывающий решает, что делать).
 */
export function resolveWinner<TStrategy extends StrategyCandidate>(
  strategies: ReadonlyArray<TStrategy>,
  ctx: ResolveContext,
  override?: string,
): TStrategy | undefined {
  if (override !== undefined) {
    const forced = strategies.find((s) => s.id === override);
    if (forced !== undefined && forced.available(ctx)) {
      return forced;
    }
  }
  return strategies.find((s) => s.available(ctx));
}

/**
 * Зарегистрировать сервис (вызывает defineService). Дедуп по serviceId:
 * повторная регистрация (HMR) заменяет предыдущую — последний побеждает.
 */
export function _registerService(entry: ServiceRegistration): void {
  const existing = _services.findIndex(
    (s) => s.serviceId === entry.serviceId,
  );
  if (existing !== -1) {
    _services[existing] = entry;
  } else {
    _services.push(entry);
  }
}

/**
 * Override стратегии сервиса. strategyId = null снимает override.
 * Живёт в памяти модуля: применяется мгновенно (следующий вызов метода
 * резолвится уже с override). Персист между перезагрузками — забота
 * devtools (applyDevStrategyOverrides на старте приложения).
 */
export function setServiceStrategyOverride(
  serviceId: string,
  strategyId: string | null,
): void {
  if (strategyId === null) {
    _overrides.delete(serviceId);
  } else {
    _overrides.set(serviceId, strategyId);
  }
}

/** Снимок override-карты: serviceId → strategyId. */
export function getStrategyOverrides(): ReadonlyMap<string, string> {
  return _overrides;
}

/** Override конкретного сервиса (для резолва диспетчера). Module-private. */
export function _getServiceStrategyOverride(
  serviceId: string,
): string | undefined {
  return _overrides.get(serviceId);
}

/** Контекст без throw: не биндился (тула до Shell) → undefined. */
function readContextSafe(): ResolveContext | undefined {
  try {
    return getResolveContext();
  } catch {
    return undefined;
  }
}

/**
 * Каталог всех зарегистрированных сервисов со стратегиями. Реестр видит
 * только загруженные модули: чтобы dev-панель показала все сервисы,
 * dev-чанк приложения статически импортирует service-модули (прогрев
 * реестра к моменту открытия тулы). Активная стратегия считается общим
 * resolveWinner; без бинда контекста (Shell ещё не создан) активной нет.
 *
 * Стратегии фильтруются по available(ctx): недоступные (выключенные
 * заглушки) в каталог не попадают — тулa предлагает только то, что
 * реально может выиграть. Без бинда контекста available не вычислить —
 * каталог показывает все стратегии.
 */
export function getServiceCatalog(): ReadonlyArray<ServiceCatalogEntry> {
  const ctx = readContextSafe();
  return _services.map((service) => {
    const override = _overrides.get(service.serviceId);
    const withOverride = ctx
      ? resolveWinner(service.strategies, ctx, override)
      : undefined;
    const natural = ctx
      ? resolveWinner(service.strategies, ctx)
      : undefined;
    const visible = ctx
      ? service.strategies.filter((s) => s.available(ctx))
      : service.strategies;
    return {
      serviceId: service.serviceId,
      strategies: visible.map(({ id, mock }) =>
        mock === undefined ? { id } : { id, mock },
      ),
      ...(withOverride !== undefined
        ? { activeStrategyId: withOverride.id }
        : {}),
      ...(natural !== undefined
        ? { naturalStrategyId: natural.id }
        : {}),
      ...(override !== undefined ? { overrideStrategyId: override } : {}),
    };
  });
}

/** Зарегистрировать мок-стратегию (вызывает defineService). Дедуп по паре id. */
export function _registerMockStrategy(entry: MockStrategyRegistration): void {
  const exists = _mockRegistrations.some(
    (r) => r.serviceId === entry.serviceId && r.strategyId === entry.strategyId,
  );
  if (!exists) {
    _mockRegistrations.push(entry);
  }
}

/**
 * Снимок реестра моков. Для MockPanel этапа D: тумблер сервиса пишет
 * `mockFlags[flag]`, диспетчер подхватывает на следующем вызове.
 */
export function getMockRegistry(): ReadonlyArray<MockStrategyRegistration> {
  return _mockRegistrations;
}
