/**
 * NavList — вертикальная навигация со «скользящим» активным фоном:
 * пилюля акцента переезжает на активный пункт (как в табах), а не
 * перекрашивается на месте. Фон — один абсолютный элемент
 * (`.nav-indicator`); позиция и высота — из измерений активного
 * пункта, движение — transform (+height при разных высотах).
 *
 * Дети — обычные NavItem: список сам находит активный (`.is-active`)
 * и следует за ним — прогон на каждом рендере покрывает смену
 * страницы, роли и набора пунктов, ResizeObserver — сдвиги от
 * шрифтов/адаптива. Первая позиция ставится без transition — пилюля
 * не «приезжает из верха». Активного пункта нет — пилюля скрыта.
 *
 * Структурные стили — `.nav-list` / `.nav-indicator` в
 * src/ui/components.css: внутри списка активный пункт фон теряет
 * (пилюля вместо него), тайминг/кривая — токены
 * `--nav-indicator-duration/--nav-indicator-easing`,
 * prefers-reduced-motion отключает плавность.
 *
 * @example
 * <NavList className="flex flex-col gap-1 p-3">
 *   <NavItem icon={<Icon name="grid" />} active>Лента</NavItem>
 *   <NavItem icon={<Icon name="chat" />}>Мессенджер</NavItem>
 * </NavList>
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cx } from "../../lib";

export interface NavListProps {
  className?: string;
  children: ReactNode;
  /** DevTools-навигация / E2E-селектор (конвенция data-name). */
  "data-name"?: string;
}

export function NavList({
  className,
  children,
  "data-name": dataName,
}: NavListProps): ReactNode {
  const listRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const placed = useRef(false);

  // Позиция пилюли — по активному пункту. useLayoutEffect: до краски,
  // чтобы смена страницы не мелькала «прыжком». Прогон на каждом
  // рендере — отдельные зависимости не нужны (две записи style).
  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) {
      return;
    }
    const active = list.querySelector<HTMLElement>(".nav-item.is-active");
    if (!active) {
      indicator.style.opacity = "0";
      return;
    }
    indicator.style.opacity = "1";
    indicator.style.height = `${active.offsetHeight}px`;
    indicator.style.transform = `translateY(${active.offsetTop}px)`;
    if (!placed.current) {
      // Первая позиция — мгновенно: глушим transition на эту запись
      // стиля, возвращаем со следующим кадром.
      indicator.style.transition = "none";
      void indicator.offsetHeight;
      const raf = requestAnimationFrame(() => {
        indicator.style.transition = "";
        placed.current = true;
      });
      return () => cancelAnimationFrame(raf);
    }
  });

  // Сдвиги геометрии мимо рендеров (догрузка шрифтов, перенос):
  // контейнер слушаем, активный пункт перемеряем.
  useEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator || typeof ResizeObserver === "undefined") {
      return;
    }
    const place = (): void => {
      const active = list.querySelector<HTMLElement>(".nav-item.is-active");
      if (!active) {
        return;
      }
      indicator.style.height = `${active.offsetHeight}px`;
      indicator.style.transform = `translateY(${active.offsetTop}px)`;
    };
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={listRef}
      data-name={dataName}
      className={cx("nav-list", className)}
    >
      <div ref={indicatorRef} className="nav-indicator" aria-hidden="true" />
      {children}
    </nav>
  );
}
