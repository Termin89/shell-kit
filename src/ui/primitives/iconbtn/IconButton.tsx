/**
 * IconButton — кнопка только с иконкой.
 *
 * Структурный стиль — класс `.iconbtn` в src/ui/components.css.
 * `label` обязателен: у иконочной кнопки нет текста, aria-label —
 * единственная подсказка для скринридеров.
 *
 * @example
 * <IconButton label="Уведомления"><Icon name="bell" /></IconButton>
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Назначение кнопки для скринридеров. */
  label: string;
  /** DevTools-навигация / E2E-селектор (конвенция data-name). */
  "data-name"?: string;
  className?: string;
  children?: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, className, type, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        aria-label={label}
        className={cx("iconbtn", className)}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
