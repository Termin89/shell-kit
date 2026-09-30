import { useDemoState } from "../../state";
import type { CatalogPageProps } from "./CatalogPage";

const items = [
  { title: "Заявка №1042", note: "новая" },
  { title: "Заявка №1041", note: "в работе" },
  { title: "Заявка №1039", note: "закрыта" },
];

/**
 * Бизнес-часть страницы каталога: shell-состояние + данные.
 * По конвенции контроллер — кастомный хук (useXxxProps).
 */
export function useCatalogProps(): CatalogPageProps {
  const { scope } = useDemoState();
  return { scope, items };
}
