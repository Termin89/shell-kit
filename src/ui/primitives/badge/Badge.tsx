/**
 * Badge — статусная метка.
 *
 * Структурный стиль — класс `.badge` в src/ui/components.css;
 * тон задаёт класс-модификатор `.badge-<tone>`.
 *
 * @example
 * <Badge tone="success">Событие</Badge>
 */
import type { ReactNode } from "react";
import { cx } from "../../lib";

export type BadgeTone =
  | "success"
  | "warn"
  | "danger"
  | "info"
  | "neutral"
  | "gold";

export interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children?: ReactNode;
  /** DevTools-навигация / E2E-селектор (конвенция data-name). */
  "data-name"?: string;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  success: "badge-success",
  warn: "badge-warn",
  danger: "badge-danger",
  info: "badge-info",
  neutral: "badge-neutral",
  gold: "badge-gold",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  "data-name": dataName,
}: BadgeProps): ReactNode {
  return (
    <span className={cx("badge", TONE_CLASS[tone], className)} data-name={dataName}>
      {children}
    </span>
  );
}
