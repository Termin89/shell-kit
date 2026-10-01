import { lazy } from "solid-js";
import type { Component } from "solid-js";
import type { Shell } from "../core/Shell";

export type ModuleComponent = Component<Record<string, unknown>> & {
  preload: () => Promise<unknown>;
};

/**
 * Поддерживаемые контракты экспорта модуля для Solid-адаптера:
 * - `export default defineModule({ ... })` — контракт ShellModule, берётся `view`;
 * - `export default Component`;
 * - `export { Component }`;
 * - `export { view }`.
 *
 * Для Solid 2: `defineModule` (module-слой) собирает React-компонент —
 * Solid-приложения используют прямые экспорты компонента, поле `view`
 * проверяется для симметрии контрактов.
 */
function asComponent(value: unknown): Component<Record<string, unknown>> | null {
  return typeof value === "function"
    ? (value as Component<Record<string, unknown>>)
    : null;
}

function resolveComponent(
  exports: unknown,
): Component<Record<string, unknown>> | null {
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

const lazyCache = new WeakMap<Shell<any>, Map<string, ModuleComponent>>();

function getShellCache(shell: Shell<any>): Map<string, ModuleComponent> {
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
 * новый lazy и повторит загрузку (Shell сам не кеширует неудачные
 * попытки; ModuleRenderer дополнительно пересоздаёт поддерево по retry,
 * потому что solid-`lazy` кеширует промис внутри себя).
 */
export function getModuleComponent(
  shell: Shell<any>,
  moduleId: string,
): ModuleComponent {
  const cache = getShellCache(shell);
  const cached = cache.get(moduleId);
  if (cached) return cached;

  const component: ModuleComponent = lazy(async () => {
    try {
      const exports = await shell.loadModule(moduleId);
      const resolved = resolveComponent(exports);
      if (!resolved) {
        throw new Error(
          `Module "${moduleId}" did not export a Solid component`,
        );
      }
      return { default: resolved };
    } catch (err) {
      cache.delete(moduleId);
      throw err as Error;
    }
  });

  cache.set(moduleId, component);
  return component;
}
