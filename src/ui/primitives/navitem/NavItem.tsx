/**
 * NavItem — пункт навигации (sidebar).
 *
 * Структурный стиль — класс `.nav-item` в src/ui/components.css;
 * `active` добавляет `.is-active`.
 *
 * @example
 * <NavItem icon={<Icon name="grid" />} active>Лента</NavItem>
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib";

export interface NavItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Иконка слева (обычно <Icon name="…" />). */
  icon?: ReactNode;
  /** Активный пункт — подсветка. */
  active?: boolean;
  /** DevTools-навигация / E2E-селектор (конвенция data-name). */
  "data-name"?: string;
  className?: string;
  children?: ReactNode;
}

export const NavItem = forwardRef<HTMLButtonElement, NavItemProps>(
  function NavItem(
    { icon, active = false, className, type, children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        aria-current={active ? "page" : undefined}
        className={cx("nav-item", active && "is-active", className)}
        {...rest}
      >
        {icon}
        {children}
      </button>
    );
  },
);
