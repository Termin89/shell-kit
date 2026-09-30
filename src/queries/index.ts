/**
 * queries — унифицированный query/mutation-слой поверх query-порта.
 */

export type {
  CacheEntry,
  CacheSubscriber,
  QueryKey,
  QueryPort,
} from "./QueryPort";
export { keyStartsWith, keysEqual } from "./QueryPort";

export { SelfRolledAdapter } from "./SelfRolledAdapter";

export { configureQuery, getQueryPort } from "./configureQuery";

export type {
  MutationResult,
  QueryResult,
  UseQueryOptions,
} from "./hooks";
export { useServiceMutation, useServiceQuery } from "./hooks";
