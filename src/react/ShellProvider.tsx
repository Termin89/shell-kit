import type { ReactNode } from "react";
import type { Shell } from "../core/Shell";
import type { AppState } from "../core/types";
import { ShellContext } from "./context";

export interface ShellProviderProps<S extends AppState = AppState> {
  /** Экземпляр Shell, создаваемый приложением самостоятельно. */
  shell: Shell<S>;
  children: ReactNode;
}

/**
 * Помещает экземпляр Shell в React-контекст,
 * чтобы хуки адаптера были доступны во всём приложении.
 * Дженерик принимает типизированное состояние: Shell<AppShellState>.
 */
export const ShellProvider = <S extends AppState = AppState>({
  shell,
  children,
}: ShellProviderProps<S>) => (
  // Контекст хранит стёртый тип (Shell<any>), поэтому Shell<S> любого
  // приложения кладётся в него без приведения.
  <ShellContext.Provider value={shell as Shell<S>}>
    {children}
  </ShellContext.Provider>
);
