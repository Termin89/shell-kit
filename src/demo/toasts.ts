/**
 * Демо-стор тостов: приёмник toastHandler'а шины ошибок. UI-данные —
 * не shell state (см. core/state.md: бизнес-данные и высокочастотные
 * значения в нём не живут), поэтому минимальный внешний стор
 * с подпиской через useSyncExternalStore.
 */

import { useSyncExternalStore } from "react";

export type ToastSeverity = "warn" | "error" | "info";

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly severity: ToastSeverity;
}

let _toasts: Toast[] = [];
const _listeners = new Set<() => void>();
let _nextId = 1;

const _emit = (): void => _listeners.forEach((fn) => fn());

/** Показать тост; скроется сам через ttl (мс). */
export function pushToast(
  message: string,
  severity: ToastSeverity,
  ttl = 6000,
): void {
  const toast: Toast = { id: _nextId++, message, severity };
  _toasts = [..._toasts, toast];
  _emit();
  setTimeout(() => dismissToast(toast.id), ttl);
}

/** Скрыть тост вручную. */
export function dismissToast(id: number): void {
  _toasts = _toasts.filter((t) => t.id !== id);
  _emit();
}

const _subscribe = (cb: () => void): (() => void) => {
  _listeners.add(cb);
  return () => {
    _listeners.delete(cb);
  };
};

/** Хук текущих тостов для ToastBar. */
export function useToasts(): Toast[] {
  return useSyncExternalStore(
    _subscribe,
    () => _toasts,
    () => _toasts,
  );
}
