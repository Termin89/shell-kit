/**
 * devtools — dev-инструментарий приложения: тулa стратегий сервисов.
 *
 * defineDev — фабрика компонента (плавающая кнопка «DEV» → панель
 * «API · Сервисы»: радио стратегий, применить/сбросить через LS +
 * reload). Данные — реестр service-слоя (getServiceCatalog, override).
 *
 * Отдельный subpath-экспорт (не корневой index): тянет React, как
 * ./react. Гейтинг DEV — на совести приложения: import.meta.env —
 * не для lib-кода.
 */

export { defineDev } from "./defineDev";
export type { DevPanelApi, DevToolsConfig } from "./types";

export {
  applyDevStrategyOverrides,
  readDevStrategyOverrides,
  writeDevStrategyOverrides,
} from "./persist";
export type { DevStrategyOverrides } from "./persist";

export type { ServiceCatalogEntry } from "../service";
