/**
 * errors — реэкспорт каркаса обработки ошибок: классификация, шина, хендлеры.
 */

export type { ErrorBus, ErrorHandler, Unsubscribe } from "./bus";
export { errorBus } from "./bus";

export type {
  ClassifiedError,
  ClassifiedOverrides,
  ErrorKind,
  ErrorSeverity,
  Retryability,
} from "./classifier";
export { classifyError } from "./classifier";

export { authHandler, networkHandler, toastHandler } from "./handlers";
