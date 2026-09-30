/**
 * cx — компактная композиция классов (clsx-подобная).
 *
 * Принимает любой набор значений: строки, числа, false/null/undefined,
 * массивы (рекурсивно), словари {класс: флаг}. Скамливает в одну строку
 * через пробел, выкидывая falsy.
 *
 * @example
 * cx("btn", isActive && "is-active") // 'btn is-active'
 */
import type { ClassValue } from "./types";

export function cx(...args: ClassValue[]): string {
  const out: string[] = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === "string" || typeof arg === "number") {
      out.push(String(arg));
    } else if (Array.isArray(arg)) {
      const nested = cx(...arg);
      if (nested) out.push(nested);
    } else if (typeof arg === "object") {
      for (const [key, value] of Object.entries(arg)) {
        if (value) out.push(key);
      }
    }
  }
  return out.join(" ");
}
