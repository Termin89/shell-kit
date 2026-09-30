/**
 * Card — surface-контейнер.
 *
 * Структурный стиль — класс `.card` в src/ui/components.css;
 * `hover` добавляет `.card-hover` (подъём при наведении) для
 * кликабельных карточек.
 *
 * @example
 * <Card hover className="overflow-hidden">…</Card>
 */
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Подъём при наведении — для кликабельных карточек. */
  hover?: boolean;
  /** DevTools-навигация / E2E-селектор (конвенция data-name). */
  "data-name"?: string;
}

export function Card({ hover = false, ...rest }: CardProps): ReactNode {
  return (
    <div
      {...rest}
      className={cx("card", hover && "card-hover", rest.className)}
    />
  );
}
