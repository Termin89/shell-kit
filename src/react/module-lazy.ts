import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { Shell } from "../core/Shell";

export type ModuleComponent = LazyExoticComponent<ComponentType>;

/**
 * Поддерживаемые контракты экспорта модуля для React-адаптера:
 * - `export default defineModule({ ... })` — контракт ShellModule, берётся `view`;
 * - `export default Component`;
 * - `export { Component }`;
 * - модуль сам является компонентом.
 */
function asComponent(value: unknown): ComponentType | null {
  return typeof value === "function" ? (value as ComponentType) : null;
}

function resolveComponent(exports: unknown): ComponentType | null {
  const direct = asComponent(exports);
  if (direct) return direct;
  if (exports && typeof exports === "object") {
    const e = exports as {
      default?: unknown;
      Component?: unknown;
      view?: unknown;
    };
    return (
      asComponent(e.default) ??
      asComponent((e.default as { view?: unknown } | undefined)?.view) ??
      asComponent(e.Component) ??
      asComponent(e.view)
    );
  }
  return null;
}

const lazyCache = new WeakMap<Shell, Map<string, ModuleComponent>>();

function getShellCache(shell: Shell): Map<string, ModuleComponent> {
  let cache = lazyCache.get(shell);
  if (!cache) {
    cache = new Map();
    lazyCache.set(shell, cache);
  }
  return cache;
}

/**
 * Возвращает стабильный lazy-компонент для модуля (кешируется по id).
 * При ошибке загрузки запись кеша удаляется — следующий вызов создаст
 * новый lazy и повторит загрузку (Shell сам не кеширует неудачные попытки).
 */
export function getModuleComponent(
  shell: Shell,
  moduleId: string,
): ModuleComponent {
  const cache = getShellCache(shell);
  const cached = cache.get(moduleId);
  if (cached) return cached;

  const component = lazy(() =>
    shell
      .loadModule(moduleId)
      .then((exports) => {
        const resolved = resolveComponent(exports);
        if (!resolved) {
          throw new Error(
            `Module "${moduleId}" did not export a React component`,
          );
        }
        return { default: resolved };
      })
      .catch((err: unknown) => {
        cache.delete(moduleId);
        throw err;
      }),
  );

  cache.set(moduleId, component);
  return component;
}
