/**
 * devtools — dev-инструментарий приложения: тулa стратегий сервисов.
 *
 * defineDev — фабрика компонента (плавающая кнопка «DEV» → панель
 * с табами «API · Сервисы» — радио стратегий, применить/сбросить
 * через LS + reload — и «Состояния» — каталог живых машин модулей
 * (StatesCatalog: прыжки goto, журнал с replay, access-проекции).
 * Данные — реестры service-слоя (getServiceCatalog, override) и
 * dev-реестр машин (module/states).
 *
 * Отдельный subpath-экспорт (не корневой index): тянет React, как
 * ./react. Гейтинг DEV — на совести приложения: import.meta.env —
 * не для lib-кода.
 */

export { defineDev } from "./defineDev";
export { StatesCatalog } from "./StatesCatalog";
export type { DevPanelApi, DevToolsConfig } from "./types";

export {
  applyDevStrategyOverrides,
  readDevStrategyOverrides,
  writeDevStrategyOverrides,
} from "./persist";
export type { DevStrategyOverrides } from "./persist";

export type { ServiceCatalogEntry } from "../service";
