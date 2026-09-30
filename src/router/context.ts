import { createContext } from "react";
import type { RouterPort } from "./port";

/** null = RouterProvider не подключён (хуки бросают внятную ошибку). */
export const RouterContext = createContext<RouterPort | null>(null);
