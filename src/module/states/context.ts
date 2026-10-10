import { createContext } from "react";
import type { ModuleStateMachine } from "./machine";

/**
 * Контекст машины состояний. Провайдер кладёт машину одного экрана —
 * вложенные экраны со своей машиной требуют собственной вложенности.
 */
export const ModuleStateContext = createContext<ModuleStateMachine<
  string,
  string,
  string
> | null>(null);
