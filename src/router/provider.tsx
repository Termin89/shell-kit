import type { ReactNode } from "react";
import { RouterContext } from "./context";
import type { RouterPort } from "./port";

export interface RouterProviderProps {
  /** Порт из connectRouter: connection.port. */
  port: RouterPort;
  children: ReactNode;
}

/**
 * RouterProvider — порт роутера в React-контекст. Обязателен для хуков
 * слоя; вкладывается внутрь ShellProvider рядом с ShellGate.
 */
export const RouterProvider = ({
  port,
  children,
}: RouterProviderProps): ReactNode => (
  <RouterContext.Provider value={port}>{children}</RouterContext.Provider>
);
