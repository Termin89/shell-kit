/**
 * Button — базовая кнопка.
 *
 * Структурный стиль (padding, переходы, focus/disabled) — класс `.btn`
 * в src/ui/components.css (@layer components); вариант и размер —
 * классы-модификаторы; внешний className добавляется последним.
 *
 * @example
 * <Button>Вступить в клуб</Button>
 * <Button variant="ghost" size="sm">Отмена</Button>
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib";

export type ButtonVariant = "primary" | "accent" | "ghost" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary — заливка brand; accent — акцентный; ghost — контурный; soft — мягкая заливка. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Растянуть на всю ширину родителя. */
  block?: boolean;
  /** DevTools-навигация / E2E-селектор (конвенция data-name). */
  "data-name"?: string;
  className?: string;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  accent: "btn-accent",
  ghost: "btn-ghost",
  soft: "btn-soft",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      block = false,
      className,
      type,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cx(
          "btn",
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          block && "btn-block",
          className,
        )}
        {...rest}
      />
    );
  },
);
