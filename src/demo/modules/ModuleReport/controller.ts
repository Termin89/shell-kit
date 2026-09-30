import { useDemoState } from "../../state";
import type { Scope } from "../../state";

export interface ReportRow {
  label: string;
  value: string;
}

export interface ReportProps {
  scope: Scope;
  rows: ReportRow[];
  totals: string;
}

const rows: ReportRow[] = [
  { label: "Выручка", value: "12 400 ₽" },
  { label: "Расходы", value: "4 180 ₽" },
  { label: "Маржа", value: "8 220 ₽" },
];

/**
 * Бизнес-часть отчёта одна на оба варианта: данные и состояние —
 * здесь, детали представления — в компонентах вариантов.
 */
export function useReportProps(): ReportProps {
  const { scope } = useDemoState();
  return { scope, rows, totals: "8 220 ₽" };
}
