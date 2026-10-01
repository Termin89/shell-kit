import type { JSX } from "@solidjs/web";
import type { Shell } from "../core/Shell";
import type { AppState } from "../core/types";
import { ShellContext } from "./context";

export interface ShellProviderProps<S extends AppState = AppState> {
  /** Экземпляр Shell, создаваемый приложением самостоятельно. */
  shell: Shell<S>;
  children: JSX.Element;
}

/**
 * Помещает экземпляр Shell в контекст Solid, чтобы хуки адаптера были
 * доступны во всём приложении. Дженерик принимает типизированное
 * состояние: Shell<AppShellState>. Контекст в Solid 2 — сам провайдер.
 */
export function ShellProvider<S extends AppState = AppState>(
  props: ShellProviderProps<S>,
): JSX.Element {
  // Контекст хранит стёртый тип (Shell<any>), поэтому Shell<S> любого
  // приложения кладётся в него без приведения.
  return (
    <ShellContext value={props.shell as Shell<any>}>{props.children}</ShellContext>
  );
}
