/**
 * Персист dev-override стратегий между перезагрузками.
 *
 * Apply в тулы = write + location.reload(): у сервисов есть состояние
 * (LS-моки, query-кеш, module-level синглтоны api) — чистый старт
 * честнее live-переключения. Ключ `<project>:dev:strategy` в LS:
 * идентичность проекта — configureStorage, тот же префикс, что у
 * сервисных данных. Ядро само DEV не гейтит (import.meta.env — не для
 * lib-кода): гейтинг на совести приложения (import.meta.env.DEV).
 */

import { setServiceStrategyOverride } from "../service";
import { getStorageConfig } from "../storage";

/** Override-карта: serviceId → strategyId. */
export type DevStrategyOverrides = Readonly<Record<string, string>>;

/** Ключ LS: идентичность проекта, fallback — без configureStorage. */
function storageKey(): string {
  try {
    return `${getStorageConfig().project}:dev:strategy`;
  } catch {
    console.warn(
      "[devtools] configureStorage не вызван — персист уходит в fallback-ключ " +
        "«shell-kit:dev:strategy»",
    );
    return "shell-kit:dev:strategy";
  }
}

/** Прочитать override из LS. Битый JSON/чужой формат — пустая карта. */
export function readDevStrategyOverrides(): DevStrategyOverrides {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey());
  } catch {
    return {};
  }
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [serviceId, strategyId] of Object.entries(parsed)) {
      if (typeof strategyId === "string") {
        out[serviceId] = strategyId;
      }
    }
    return out;
  } catch {
    console.warn("[devtools] ключ dev:strategy в LS битый — игнорирован");
    return {};
  }
}

/** Записать override в LS; пустая карта снимает ключ целиком. */
export function writeDevStrategyOverrides(
  overrides: DevStrategyOverrides,
): void {
  try {
    if (Object.keys(overrides).length === 0) {
      localStorage.removeItem(storageKey());
    } else {
      localStorage.setItem(storageKey(), JSON.stringify(overrides));
    }
  } catch {
    console.warn("[devtools] LS недоступен (приват-режим?) — override не записан");
  }
}

/**
 * Применить сохранённые override к реестру. Вызывается приложением
 * на старте (module scope App, до первого обращения к сервисам):
 * дальше диспетчеры резолвят per-call уже с override.
 */
export function applyDevStrategyOverrides(): void {
  for (const [serviceId, strategyId] of Object.entries(
    readDevStrategyOverrides(),
  )) {
    setServiceStrategyOverride(serviceId, strategyId);
  }
}
