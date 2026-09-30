/**
 * Chip — фильтр/категория (кнопка-таблетка).
 *
 * Структурный стиль — класс `.chip` в src/ui/components.css;
 * `active` добавляет `.is-active` (заливка brand). Переключение
 * false→true проигрывает пружинящий pop (`.chip-pop`, keyframes
 * chip-pop), press — scale 0.94; reduced-motion — без анимаций.
 * Pop только по факту переключения: первичный mount активного
 * чипа не анимируется (derived-стейт в рендере, без effect).
 *
 * @example
 * <Chip active>Все</Chip>
 */
import {
  forwardRef,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "../../lib";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Выбранный фильтр. */
  active?: boolean;
  /** DevTools-навигация / E2E-селектор (конвенция data-name). */
  "data-name"?: string;
  className?: string;
  children?: ReactNode;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active = false, className, type, ...rest },
  ref,
) {
  // chip-pop живёт ровно пока чип активен: класс снимается при
  // деактивации — повторный выбор перезапускает анимацию.
  const prevActive = useRef(active);
  const [pop, setPop] = useState(false);
  if (prevActive.current !== active) {
    prevActive.current = active;
    setPop(active);
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-pressed={active}
      className={cx("chip", active && "is-active", pop && "chip-pop", className)}
      {...rest}
    />
  );
});
