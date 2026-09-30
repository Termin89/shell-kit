import { createContext } from "react";
import type { Shell } from "../core/Shell";

// Внутренний тип контекста стёрт (Shell<any>): дженерик-провайдер кладёт
// сюда Shell<S> конкретного приложения, наружу хуки отдают базовый Shell.
export const ShellContext = createContext<Shell<any> | null>(null);
