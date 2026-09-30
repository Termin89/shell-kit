/**
 * createIcon — фабрика типизированного Icon из реестра иконок проекта.
 *
 * Механика (svg-обёртка, размеры .ic/.ic-sm/.ic-lg) — универсальная,
 * живёт в ядре; содержимое (реестр inline-SVG) — контент проекта.
 *
 * @example
 * const ICONS = { search: <path d="…" /> } as const;
 * export const Icon = createIcon(ICONS);
 * export type IconName = keyof typeof ICONS; // "search"
 */
import type { ReactNode } from "react";
import { cx } from "../lib";

export type IconSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<IconSize, string> = {
  sm: "ic ic-sm",
  md: "ic",
  lg: "ic ic-lg",
};

export function createIcon<Registry extends Record<string, ReactNode>>(
  icons: Registry,
) {
  return function Icon({
    name,
    size = "md",
    className,
  }: {
    name: keyof Registry & string;
    size?: IconSize;
    className?: string;
  }): ReactNode {
    return (
      <svg
        className={cx(SIZE_CLASS[size], className)}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {icons[name]}
      </svg>
    );
  };
}
