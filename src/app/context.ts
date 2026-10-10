import { createContext, useContext } from "react";
import type { AppState } from "../core";
import type { AppHandle } from "./types";

/**
 * AppContext — инстанс приложения для каркаса и dev-тул. Не
 * сервис-локатор: модули инстанс не видят (граница слоя — readme.md),
 * подписка — только для компонентов, которыми владеет app-слой
 * (layout-слоты, dev-панели).
 */

export const AppContext = createContext<AppHandle | null>(null);

/**
 * useApp — дескриптор приложения (definition/shell/router/port) из
 * Root-провайдера. Дженерики — сужение до проектных типов состояния
 * и меты модулей.
 */
export function useApp<
  S extends AppState = AppState,
  M = unknown,
>(): AppHandle<S, M> {
  const app = useContext(AppContext);
  if (app === null) {
    throw new Error(
      "[app] useApp требует <app.Root /> — см. src/app/readme.md",
    );
  }
  return app as unknown as AppHandle<S, M>;
}
