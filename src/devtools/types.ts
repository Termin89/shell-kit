/**
 * Типы devtools-слоя: конфиг defineDev и headless-API панели.
 */

import type { ReactNode } from "react";
import type { AppHandle } from "../app";
import type { ServiceCatalogEntry } from "../service";

/**
 * Dev-тула стратегий: данные и действия панели. Полный headless-контракт
 * для своей вьюхи (view-проп defineDev): проект рисует UI на своей
 * дизайн-системе, не зная внутренностей реестра.
 */
export interface DevPanelApi {
  /** Снимок каталога сервисов на момент открытия панели. */
  readonly catalog: ReadonlyArray<ServiceCatalogEntry>;
  /** baseUrl из services-конфига Shell; undefined — контекст не биндился. */
  readonly baseUrl: string | undefined;
  /** Черновик выбора: serviceId → strategyId. Применяется только apply(). */
  readonly selection: Readonly<Record<string, string>>;
  /** Черновик расходится с активными стратегиями — «Применить» доступна. */
  readonly dirty: boolean;
  /** Идёт прогрев чанков модулей декларации — каталог может пополняться. */
  readonly warming: boolean;
  /** Сколько чанков модулей осталось догрузить (0 — прогрев завершён). */
  readonly warmLeft: number;
  /** Выбрать стратегию сервиса в черновике. */
  select(serviceId: string, strategyId: string): void;
  /** Записать override в localStorage и перезагрузить страницу. */
  apply(): void;
  /** Снять все override (очистить LS-ключ) и перезагрузить страницу. */
  reset(): void;
  /** Закрыть панель. */
  close(): void;
}

/** Конфиг defineDev. */
export interface DevToolsConfig {
  /**
   * Полная замена вьюхи панели под дизайн-систему проекта: получает
   * DevPanelApi (каталог, черновик, действия) и возвращает ReactNode.
   * Плавающая кнопка «DEV» (вход в тулу) остаётся стандартной.
   */
  view?: (api: DevPanelApi) => ReactNode;
  /**
   * className плавающей кнопки. Сдвиг по вертикали — через CSS-переменную
   * `--sk-devtools-bottom` (дефолт 1.5rem): на проектах с нижней навигацией
   * задайте её под высоту навигации на нужных брейкпойнтах.
   */
  className?: string;
  /**
   * Инстанс приложения (AppHandle из defineApp): при открытии панели
   * прогреваются чанки всех модулей декларации — каталог сервисов полон
   * без статических импортов в чанке тулы. Не задан — берётся из
   * AppContext (тула внутри app.Root); нет ни того ни другого —
   * прежнее поведение: реестр видит только загруженные модули.
   */
  app?: AppHandle;
}
