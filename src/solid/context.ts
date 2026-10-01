import { createContext } from "solid-js";
import type { Shell } from "../core/Shell";

// Внутренний тип контекста стёрт (Shell<any>): дженерик-провайдер кладёт
// сюда Shell<S> конкретного приложения, наружу хуки отдают базовый Shell.
// Контекст default-less (каноническая форма Solid 2): сам является
// провайдером (<ShellContext value={...}>), а useContext вне провайдера
// кидает типизированную ошибку — rethrow-обёртки не нужны.
export const ShellContext = createContext<Shell<any>>();
