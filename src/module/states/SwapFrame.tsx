import type { ReactNode } from "react";
import { useSwapAnimation } from "./swapAnimation";

/**
 * SwapFrame — рамка-свап состояний: смена вьюхи на одной поверхности
 * без скачка каркаса. Три режима (transition декларации):
 *
 * - `"slide"` — высотный FLIP + направленный слайд с fade
 *   (useSwapAnimation; направление — order состояний);
 * - `"fade"` — лёгкий кроссфейд со слайдом (keyframes sk-swap-in);
 * - `false` — плоский key-swap без анимации.
 *
 * Классы можно переопределить (className/itemClassName) — проект со
 * своей дизайн-системой подставляет свои (эталон: u-kon передаёт
 * swap-surface/swap-anim и auth-card-swap из theme.css).
 */

export interface SwapFrameProps {
  /** Ключ сменяемого контента — id состояния. */
  readonly swapKey: string;
  /** Режим свапа. */
  readonly transition: "fade" | "slide" | false;
  /** Порядок ключей для направления слайда (вглубь — справа). */
  readonly order?: readonly string[];
  /** Класс обёртки-поверхности (дефолт sk-swap-surface у slide). */
  readonly className?: string;
  /** Класс сменяемого контента (дефолт sk-swap-anim / sk-state-fade). */
  readonly itemClassName?: string;
  readonly children: ReactNode;
}

const STATIC_KEY = "";
const EMPTY_ORDER: readonly string[] = [];

export function SwapFrame({
  swapKey,
  transition,
  order,
  className,
  itemClassName,
  children,
}: SwapFrameProps): ReactNode {
  // Хук безусловный: в режимах без слайда ключ константен — свапов нет.
  const { ref, animate } = useSwapAnimation(
    transition === "slide" ? swapKey : STATIC_KEY,
    order ?? EMPTY_ORDER,
  );

  if (transition === "slide") {
    return (
      <div className={className ?? "sk-swap-surface"} ref={ref}>
        <div
          key={swapKey}
          className={animate ? (itemClassName ?? "sk-swap-anim") : undefined}
        >
          {children}
        </div>
      </div>
    );
  }

  if (transition === "fade") {
    return (
      <div className={className}>
        <div key={swapKey} className={itemClassName ?? "sk-state-fade"}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div key={swapKey}>{children}</div>
    </div>
  );
}
