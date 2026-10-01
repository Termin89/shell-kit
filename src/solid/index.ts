/**
 * solid — Solid 2-адаптер shell-kit (one-stop вход).
 *
 * Реэкспортирует связки адаптера (провайдер, гейт, рендерер, хуки,
 * router/queries-хуки) и framework-free ядра router/queries — из
 * файлов напрямую, минуя ../router/index и ../queries/index (те
 * реэкспортят React-хуки и потянули бы react в solid-дист).
 */

// ----- Адаптер -----

export { ShellProvider } from "./ShellProvider";
export type { ShellProviderProps } from "./ShellProvider";
export { ShellContext } from "./context";
export { ModuleRenderer } from "./ModuleRenderer";
export type { ModuleRendererProps } from "./ModuleRenderer";
export { ShellGate } from "./ShellGate";
export type { ShellGateProps } from "./ShellGate";
export {
  useActiveModules,
  useMedia,
  useShell,
  useShellState,
  useShellStatus,
} from "./hooks";
export type { ActiveModule } from "./hooks";
export { getModuleComponent } from "./module-lazy";
export type { ModuleComponent } from "./module-lazy";

// ----- Router-связки -----

export { RouterContext, RouterProvider, useModuleRoute, useNavigate, usePath, useRouter } from "./router";
export type {
  ModuleRoute,
  NavigateOptions,
  RouterProviderProps,
} from "./router";

// ----- Queries-хуки -----

export { useServiceMutation, useServiceQuery } from "./queries";
export type {
  MutationResult,
  QueryResult,
  UseQueryOptions,
} from "./queries";

// ----- Framework-free ядра (файлы, не React-реэкспортирующие index-ы) -----

export { matchPath } from "../router/port";
export type { RouteMatch, RouterPort } from "../router/port";
export { createBrowserHistory, createMemoryHistory } from "../router/history";
export { connectRouter } from "../router/connect";
export type { RouterConnection, RouterOptions } from "../router/connect";
export { configureQuery, getQueryPort } from "../queries/configureQuery";
export { SelfRolledAdapter } from "../queries/SelfRolledAdapter";
export type { CacheEntry, QueryKey } from "../queries/QueryPort";
