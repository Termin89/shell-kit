/**
 * service — диспетчеры доменных сервисов: стратегии (api/mock), ленивый
 * per-call резолв, реестр моков.
 */

export type {
  DefineServiceOptions,
  ResolveContext,
  ServiceStrategy,
} from "./types";
export { defineService } from "./defineService";

export { bindServiceContextSource, getResolveContext } from "./context";

export type { MockStrategyRegistration } from "./registry";
export { getMockRegistry } from "./registry";
