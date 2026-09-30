/**
 * handlers — стандартные обработчики ошибок для шины.
 *
 * Каждый хендлер — функция-фабрика, возвращающая `ErrorHandler`. Это позволяет
 * передавать опции (например, колбэк `onAuthExpired` для редиректа) и явно
 * регистрировать в `errorBus.subscribe()` на старте приложения.
 *
 * Каждый хендлер самодостаточен: без опций — логирует в console, с опциями —
 * подключает реакцию приложения (toast-функция, offline-баннер, редирект).
 *
 * @see bus.ts — `errorBus.subscribe(...)`
 */

import type { ErrorHandler } from "./bus";
import type { ErrorKind, ErrorSeverity } from "./classifier";

/** Маппинг severity шины в severity toast-уведомлений (fatal сворачиваем в error). */
const SEVERITY_TO_TOAST: Record<ErrorSeverity, "warn" | "error" | "info"> = {
  fatal: "error",
  error: "error",
  warn: "warn",
  info: "info",
};

/**
 * authHandler — обрабатывает 401/403: пользователь не авторизован или сессия
 * истекла. Действие по умолчанию: колбэк приложения (редирект на логин).
 *
 * ```ts
 * errorBus.subscribe(
 *   authHandler({
 *     onAuthExpired: () => navigate("/login"),
 *   }),
 * );
 * ```
 */
export function authHandler(options: {
  onAuthExpired?: () => void;
}): ErrorHandler {
  return {
    id: "auth",
    handles: new Set<ErrorKind>(["auth", "forbidden"]),
    handle(error) {
      console.warn("[errors:auth]", error.kind, error.message);
      options.onAuthExpired?.();
    },
  };
}

/**
 * toastHandler — показывать пользовательские уведомления для "мягких" ошибок:
 * бизнес-ошибки, валидация, конфликты. Не фаталит приложение.
 *
 * ```ts
 * errorBus.subscribe(
 *   toastHandler({
 *     showToast: (message, severity) => toast.show(message, severity),
 *   }),
 * );
 * ```
 */
export function toastHandler(options: {
  showToast?: (message: string, severity: "warn" | "error" | "info") => void;
}): ErrorHandler {
  return {
    id: "toast",
    handles: new Set<ErrorKind>([
      "validation",
      "business",
      "conflict",
      "notFound",
    ]),
    handle(error) {
      console.info("[errors:toast]", error.kind, error.message);
      options.showToast?.(error.message, SEVERITY_TO_TOAST[error.severity]);
    },
  };
}

/**
 * networkHandler — сетевые проблемы и таймауты. Без опций — лог; с опцией —
 * offline-баннер и подобные реакции.
 *
 * ```ts
 * errorBus.subscribe(
 *   networkHandler({
 *     onOffline: () => showOfflineBanner(),
 *   }),
 * );
 * ```
 */
export function networkHandler(options: {
  onOffline?: () => void;
}): ErrorHandler {
  return {
    id: "network",
    handles: new Set<ErrorKind>(["network", "timeout"]),
    handle(error) {
      console.warn("[errors:network]", error.kind, error.message);
      options.onOffline?.();
    },
  };
}
