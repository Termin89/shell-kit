/**
 * defineDev — фабрика dev-тулы приложения (аналог defineModule для dev).
 *
 * Возвращает компонент: плавающая кнопка «DEV» (fixed внизу справа,
 * портал в body, z-60) + язычок у левого края окна (z-60, под
 * панелью) → панель-drawer слева на всю высоту (z-70 — ниже проектных
 * модалок). Немодальная — без бекдропа, приложение остаётся видимым
 * и кликабельным.
 *
 * Режимы показа:
 * - «подсмотреть» (peek): наведение на язычок выдвигает панель, уход
 *   курсора за её пределы — задвигает (только hover-устройства;
 *   панель на всю высоту — «покинуть» = уйти правее неё);
 * - «закрепить»: кнопка 📌 в шапке (или клик по язычку/FAB) держит
 *   панель открытой; на таче автоскрытия нет — открепление закрывает.
 * Закрыть закреплённую: Esc / тумблер FAB / открепить.
 *
 * Фазы «open → closing → closed»: панель играет выезд по transform
 * (~260 мс) и размонтируется по таймеру (280 мс, без transitionend);
 * prefers-reduced-motion — закрытие мгновенное. После закрытия фокус
 * возвращается на FAB, только если был внутри тулы (hover-скрытие
 * фокус не крадёт).
 *
 * Питается инстансом приложения (defineApp): из AppContext корня
 * (компонент монтируется внутри app.Root) или явно конфигом app.
 * Из декларации берётся список модулей — при открытии панели чанки
 * прогреваются (shell.loadModule): каталог сервисов полон с первого
 * открытия, статические импорты сервисов в dev-чанке проекта не
 * нужны. Без инстанса (тула вне defineApp) — прежнее поведение:
 * реестр видит только загруженные service-модули.
 *
 * Вьюха заменяемая: view-проп получает DevPanelApi (каталог, черновик
 * выбора, apply/reset/close) — UI на дизайн-системе проекта; хром
 * показа (язычок, автоскрытие, пин через клик по язычку/FAB) действует
 * и на неё, кнопки 📌 у неё нет.
 *
 * Apply = write в LS + location.reload() (у сервисов есть состояние:
 * LS-моки, query-кеш, module-level инстансы — чистый старт). Ядро DEV
 * не гейтит (import.meta.env — не для lib-кода): вырезание из prod —
 * `import.meta.env.DEV && <DevTools/>` в приложении.
 */

import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AppContext } from "../app";
import { getResolveContext, getServiceCatalog } from "../service";
import type { ServiceCatalogEntry } from "../service";
import { Button, cx } from "../ui";
import { DefaultDevPanel } from "./DefaultDevPanel";
import { writeDevStrategyOverrides } from "./persist";
import type { DevPanelApi, DevToolsConfig } from "./types";

/** Запас поверх 260 мс transform-выезда (см. DefaultDevPanel). */
const CLOSE_TIMEOUT_MS = 280;

/**
 * Пока панель въезжает, hit-зона ещё едет за transform — контроль
 * ухода курсора включается с задержкой, чуть больше анимации входа.
 */
const HIDE_ARM_DELAY_MS = 320;

/** Есть ли у устройства честный hover (мышь/трекпад). */
function hoverCapable(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches
  );
}

/** Язычок у левого края: наведение — подсмотреть, клик — закрепить. */
const handleStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 60,
  writingMode: "vertical-rl",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  padding: "14px 5px",
  borderRadius: "0 999px 999px 0",
  boxShadow: "2px 0 8px rgba(16, 33, 60, 0.18)",
};

/** baseUrl из services-конфига; не биндился → undefined. */
function readBaseUrl(): string | undefined {
  try {
    return getResolveContext().baseUrl;
  } catch {
    return undefined;
  }
}

/** Черновик при открытии: активная стратегия (или первая, если активной нет). */
function buildSelection(
  catalog: ReadonlyArray<ServiceCatalogEntry>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of catalog) {
    const current = entry.activeStrategyId ?? entry.strategies[0]?.id;
    if (current !== undefined) {
      out[entry.serviceId] = current;
    }
  }
  return out;
}

/**
 * Создать dev-тулу. Монтируется на уровне корня приложения (вне
 * гейтов экранов — работает и на auth-экране); внутри app.Root
 * инстанс подтягивается из контекста.
 *
 * @example
 * const DevTools = defineDev({ className: "…" });
 * // в рендере корня:
 * import.meta.env.DEV && <DevTools />
 */
export function defineDev(config: DevToolsConfig = {}): ComponentType {
  const { view, className, app: appConfig, user } = config;

  function DevTools(): ReactNode {
    // Инстанс приложения: контекст корня (обычный случай) либо явная
    // инъекция конфигом (тула вне app.Root).
    const appFromContext = useContext(AppContext);
    const app = appConfig ?? appFromContext;
    // Жизненный цикл панели: closing — панель в DOM, играет выезд
    // (триггеры в это время no-op, aria-expanded ещё честен).
    const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
    // Закреплена — не прячется при уходе курсора.
    const [pinned, setPinned] = useState(false);
    const [catalog, setCatalog] = useState<ReadonlyArray<ServiceCatalogEntry>>([]);
    const [selection, setSelection] = useState<Record<string, string>>({});
    // Прогрев чанков модулей: сколько осталось (null — не идёт).
    const [warmLeft, setWarmLeft] = useState<number | null>(null);
    const fabRef = useRef<HTMLButtonElement | null>(null);
    // Гвард возврата фокуса: панель была открыта (не маунт тулы).
    const panelWasOpenRef = useRef(false);
    // Фокус был внутри тулы в момент закрытия. Замер — в close(),
    // при живом DOM: к фазе closed панель размонтирована и браузер
    // уже сбросил activeElement на body.
    const focusInToolRef = useRef(false);

    // Каталог перечитывается при открытии и по мере прогрева: реестр
    // наполняется импортами чанков (defineService регистрирует сервисы
    // на уровне модуля).
    const refreshCatalog = useCallback(() => {
      const snapshot = getServiceCatalog();
      setCatalog(snapshot);
      // Новые сервисы получают дефолт черновика, черновики поверх не
      // затираются.
      setSelection((prev) => ({ ...buildSelection(snapshot), ...prev }));
    }, []);

    const openPanel = useCallback(() => {
      refreshCatalog();
      setPhase("open");
      // Прогрев: тянем чанки всех модулей декларации — сервисы
      // регистрируются, каталог полон без статических импортов
      // в dev-чанке. loadModule кеширует — повторные открытия дёшевы.
      if (app !== null) {
        const modules = app.definition.modules;
        setWarmLeft(modules.length);
        for (const module of modules) {
          app.shell
            .loadModule(module.id)
            .catch(() => undefined) // битый чанк не роняет тулу
            .finally(() => {
              refreshCatalog();
              setWarmLeft((n) => (n === null ? null : Math.max(0, n - 1)));
            });
        }
      }
    }, [app, refreshCatalog]);

    // Закрытие: open → closing (панель играет transform-выезд) либо
    // сразу closed при reduced-motion. Повторные close/click по FAB
    // в фазах closing/closed — no-op.
    const close = useCallback(() => {
      // Замер «фокус в туле» при живом DOM: после размонтирования
      // панели activeElement уже body, эффект фазы closed опоздает.
      const active = document.activeElement;
      const zone = document.getElementById("sk-devtools-zone");
      const handle = document.getElementById("sk-devtools-handle");
      focusInToolRef.current =
        (zone !== null && zone.contains(active)) ||
        (handle !== null && handle.contains(active));
      setPhase((prev) => {
        if (prev !== "open") {
          return prev;
        }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          return "closed";
        }
        return "closing";
      });
    }, []);

    // Подсмотреть: наведение на язычок — панель без закрепления.
    // На таче hover-а нет (mouseenter — синтетика тапа): тап по
    // язычку открывает сразу закреплённой — незакреплённую панель
    // без мыши закрыть нечем.
    const peek = useCallback(() => {
      setPinned(!hoverCapable());
      openPanel();
    }, [openPanel]);

    // Кнопка «Закрепить» в шапке панели. На таче автоскрытия нет —
    // откреплённую панель закрыть нечем, открепление = закрыть.
    const togglePin = useCallback(() => {
      if (pinned) {
        setPinned(false);
        if (!hoverCapable()) {
          close();
        }
        return;
      }
      setPinned(true);
    }, [pinned, close]);

    // Выезд проигрался — размонтируем. Таймер живёт в эффекте —
    // cleanup отменяет его при анмаунте тулы.
    useEffect(() => {
      if (phase !== "closing") {
        return undefined;
      }
      const timer = setTimeout(() => setPhase("closed"), CLOSE_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }, [phase]);

    // Автоскрытие (только hover-устройства): незакреплённая панель
    // закрывается, как только курсор оказывается вне тулы — панели
    // и язычка. Панель на всю высоту, язычок у левого края под ней —
    // «вне» = правее панели; контроль включается после въезда.
    useEffect(() => {
      if (phase !== "open" || pinned || !hoverCapable()) {
        return undefined;
      }
      let armed = false;
      const armTimer = setTimeout(() => {
        armed = true;
      }, HIDE_ARM_DELAY_MS);
      const onMove = (event: MouseEvent): void => {
        if (!armed) {
          return;
        }
        const target = event.target as Node | null;
        if (target === null) {
          return;
        }
        const zone = document.getElementById("sk-devtools-zone");
        const handle = document.getElementById("sk-devtools-handle");
        if (
          (zone !== null && zone.contains(target)) ||
          (handle !== null && handle.contains(target))
        ) {
          return;
        }
        close();
      };
      document.addEventListener("mousemove", onMove);
      return () => {
        clearTimeout(armTimer);
        document.removeEventListener("mousemove", onMove);
      };
    }, [phase, pinned, close]);

    // Фокус-гигиена: панель закрылась — если фокус был внутри тулы
    // (клик по радио, кнопкам; замер — в close(), при живом DOM),
    // вернуть на FAB. Hover-скрытие чужой фокус не крадёт; на маунте
    // тулы — тоже (гвард «была открыта»).
    useEffect(() => {
      if (phase !== "closed") {
        panelWasOpenRef.current = true;
        return undefined;
      }
      if (panelWasOpenRef.current) {
        panelWasOpenRef.current = false;
        if (focusInToolRef.current) {
          focusInToolRef.current = false;
          fabRef.current?.focus();
        }
      }
      return undefined;
    }, [phase]);

    // Esc закрывает только открытую панель (в closing — анимация
    // уже доигрывает, дёргать нечего) и снимает закрепление.
    useEffect(() => {
      if (phase !== "open") {
        return undefined;
      }
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          setPinned(false);
          close();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [phase, close]);

    const select = useCallback((serviceId: string, strategyId: string) => {
      setSelection((prev) => ({ ...prev, [serviceId]: strategyId }));
    }, []);

    // Override пишется только там, где черновик расходится с естественным
    // победителем (по флагам): возврат к естественному = снятие override.
    const apply = useCallback(() => {
      const overrides: Record<string, string> = {};
      for (const entry of getServiceCatalog()) {
        const draft = selection[entry.serviceId];
        if (draft === undefined || draft === entry.naturalStrategyId) {
          continue;
        }
        overrides[entry.serviceId] = draft;
      }
      writeDevStrategyOverrides(overrides);
      location.reload();
    }, [selection]);

    const reset = useCallback(() => {
      writeDevStrategyOverrides({});
      location.reload();
    }, []);

    const dirty = catalog.some(
      (entry) =>
        entry.activeStrategyId !== undefined &&
        selection[entry.serviceId] !== undefined &&
        selection[entry.serviceId] !== entry.activeStrategyId,
    );

    const api: DevPanelApi = {
      catalog,
      baseUrl: readBaseUrl(),
      selection,
      dirty,
      warming: warmLeft !== null && warmLeft > 0,
      warmLeft: warmLeft ?? 0,
      select,
      apply,
      reset,
      close,
      ...(user !== undefined ? { user } : {}),
    };

    return createPortal(
      <>
        <Button
          ref={fabRef}
          variant="soft"
          size="sm"
          className={cx("sk-devtools-fab", className)}
          style={{
            position: "fixed",
            right: "16px",
            bottom: "var(--sk-devtools-bottom, 1.5rem)",
            zIndex: 60,
          }}
          aria-expanded={phase !== "closed"}
          aria-controls="sk-devtools-panel"
          title="DEV-инструменты"
          data-name="dev/fab"
          onClick={() => {
            // Явное открытие — закреплённой (курсор на FAB, вне
            // панели: незакреплённая скрылась бы сразу).
            if (phase === "closed") {
              setPinned(true);
              openPanel();
            } else {
              setPinned(false);
              close();
            }
          }}
        >
          DEV
        </Button>
        <Button
          variant="soft"
          size="sm"
          id="sk-devtools-handle"
          className="sk-devtools-handle"
          style={handleStyle}
          aria-expanded={phase !== "closed"}
          aria-controls="sk-devtools-panel"
          title="DEV-инструменты: наведите — панель выдвинется; клик — закрепить"
          data-name="dev/handle"
          onMouseEnter={peek}
          onClick={() => {
            // Клик по язычку — явное намерение: закрепить (или
            // открыть закреплённой). closing — доигрывает и reopened.
            setPinned(true);
            if (phase !== "open") {
              openPanel();
            }
          }}
        >
          DEV
        </Button>
        {phase !== "closed" ? (
          // Зона тулы для контроля ухода курсора: содержит панель
          // (или кастомную view) и язычок-хром.
          <div id="sk-devtools-zone" style={{ display: "contents" }}>
            {view !== undefined ? (
              view(api)
            ) : (
              <DefaultDevPanel
                api={api}
                closing={phase === "closing"}
                pinned={pinned}
                onTogglePin={togglePin}
              />
            )}
          </div>
        ) : null}
      </>,
      document.body,
    );
  }

  return DevTools;
}
