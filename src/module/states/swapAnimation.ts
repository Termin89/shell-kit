import { useLayoutEffect, useRef, type Ref } from "react";

/**
 * useSwapAnimation — высотный FLIP для смены контента на одной
 * поверхности. Промоотирован из u-kon (src/ui/shared) как механика
 * рамки-свапа состояний (SwapFrame); классы поверхностей остаётcя на
 * стороне дизайн-слоя приложения (дефолты — swap.css слоя). Свап =
 * смена key (id состояния):
 *
 * - обёртка (ref, класс sk-swap-surface): высота анимируется inline-
 *   переходом от старой высоты к новой; overflow hidden на время
 *   перехода; прерывание — снап в конечное состояние.
 * - сменяемый контент (прямой ребёнок обёртки, класс sk-swap-anim при
 *   animate): направленный слайд с fade (keyframes sk-swap-in в
 *   swap.css), направление — CSS-переменная --swap-dir на обёртке
 *   (вперёд по order — въезд справа, назад — слева).
 *
 * Границы: первый mount — без анимации (animate=false до первого
 * свапа); prefers-reduced-motion — мгновенная смена; order влияет
 * только на направление слайда (ключ вне order — «вперёд»).
 */
export function useSwapAnimation(
  key: string,
  order: readonly string[],
): {
  ref: Ref<HTMLDivElement>;
  animate: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const prevKey = useRef(key);
  const seenSwap = useRef(false);
  const autoHeight = useRef<number | null>(null);
  const settle = useRef<(() => void) | null>(null);

  // Анимируется только контент, смонтированный свапом: класс sk-swap-anim
  // ставится при рендере нового варианта, первичному его нет вовсе.
  if (key !== prevKey.current) {
    seenSwap.current = true;
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }
    if (prevKey.current === key) {
      // Mount/StrictMode-повтор и безключевые ререндеры: держим
      // актуальной «естественную» высоту (появился error и т.п.).
      if (el.style.height === "") {
        autoHeight.current = el.offsetHeight;
      }
      return;
    }

    // Направление слайда: вперёд по order — въезд справа.
    const prevIndex = order.indexOf(prevKey.current);
    const nextIndex = order.indexOf(key);
    prevKey.current = key;
    el.style.setProperty(
      "--swap-dir",
      prevIndex >= 0 && nextIndex >= 0 && nextIndex < prevIndex ? "-1" : "1",
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      autoHeight.current = el.offsetHeight;
      return;
    }

    // Прерывание предыдущего перехода — снап в конечное состояние.
    settle.current?.();

    // from: текущая высота (при прерывании) или запомненная «авто»;
    // to: естественная высота нового контента.
    const from =
      el.style.height !== "" ? el.offsetHeight : autoHeight.current;
    el.style.height = "";
    const to = el.offsetHeight;
    if (from === null || Math.abs(to - from) < 1) {
      autoHeight.current = to;
      return;
    }

    el.style.overflow = "hidden";
    el.style.height = `${from}px`;
    void el.offsetHeight; // reflow: старт перехода от старой высоты
    el.style.transition = "height 280ms cubic-bezier(0.4,0,0.2,1)";
    el.style.height = `${to}px`;
    autoHeight.current = to;

    let settled = false;
    const done = (event?: TransitionEvent): void => {
      // transitionend всплывает от детей (бордеры полей) — ловим только
      // собственный height и программный сброс (event === undefined).
      if (event !== undefined && event.propertyName !== "height") {
        return;
      }
      if (settled) {
        return;
      }
      settled = true;
      el.style.transition = "";
      el.style.height = "";
      el.style.overflow = "";
      el.removeEventListener("transitionend", done);
      settle.current = null;
    };
    el.addEventListener("transitionend", done);
    settle.current = () => done();
  }, [key, order]);

  return { ref, animate: seenSwap.current };
}
