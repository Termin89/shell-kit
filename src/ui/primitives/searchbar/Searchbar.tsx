/**
 * Searchbar — строка поиска (иконка + инпут).
 *
 * Структурный стиль — класс `.searchbar` в src/ui/components.css.
 * Иконку передаёт проект (<Icon name="search" size="sm" />), атрибуты
 * инпута — через `inputProps` (placeholder, readOnly, onChange…).
 *
 * @example
 * <Searchbar icon={<Icon name="search" size="sm" />} inputProps={{ placeholder: "Поиск" }} />
 */
import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib";

export interface SearchbarProps {
  /** Иконка слева. */
  icon?: ReactNode;
  /** DevTools-навигация / E2E-селектор (конвенция data-name). */
  "data-name"?: string;
  /** Класс на обёртке. */
  className?: string;
  /** Прокидывается в input. */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export function Searchbar({
  icon,
  className,
  inputProps,
  ...rest
}: SearchbarProps): ReactNode {
  return (
    <div className={cx("searchbar", className)} {...rest}>
      {icon}
      <input type="search" {...inputProps} />
    </div>
  );
}
