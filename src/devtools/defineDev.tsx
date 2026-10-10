/**
 * defineDev — фабрика dev-тулы приложения (аналог defineModule для dev).
 *
 * Возвращает компонент: плавающая кнопка «DEV» (fixed внизу справа,
 * портал в body, z-60) → панель (z-70 — ниже проектных модалок):
 * «API · Сервисы» (список сервисов, радио стратегий, применить/
 * сбросить) и «Состояния» (каталог живых машин, прыжки, журнал).
 *
 * Питается инстансом приложения (defineApp): из AppContext корня
 * (компонент монтируется внутри app.Root) или явно конфигом app.
 * Из декларации берётся список модулей — при открытии панели чанки
 * прогреваются (shell.loadModule): каталог сервисов полон с первого
 * открытия, статические импорты 13 сервисов в dev-чанке проекта
 * не нужны. Без инстанса (тула вне defineApp) — прежнее поведение:
 * реестр видит только загруженные service-модули.
 *
 * Вьюха заменяемая: view-проп получает DevPanelApi (каталог, черновик
 * выбора, apply/reset/close) — UI на дизайн-системе проекта.
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
  useState,
  type ComponentType,
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
    const [open, setOpen] = useState(false);
    const [catalog, setCatalog] = useState<ReadonlyArray<ServiceCatalogEntry>>([]);
    const [selection, setSelection] = useState<Record<string, string>>({});
    // Прогрев чанков модулей: сколько осталось (null — не идёт).
    const [warmLeft, setWarmLeft] = useState<number | null>(null);

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
      setOpen(true);
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

    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
      if (!open) return undefined;
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [open]);

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
          variant="soft"
          size="sm"
          className={cx("sk-devtools-fab", className)}
          style={{
            position: "fixed",
            right: "16px",
            bottom: "var(--sk-devtools-bottom, 1.5rem)",
            zIndex: 60,
          }}
          aria-expanded={open}
          aria-controls="sk-devtools-panel"
          title="DEV-инструменты"
          data-name="dev/fab"
          onClick={open ? close : openPanel}
        >
          DEV
        </Button>
        {open ? (view !== undefined ? view(api) : <DefaultDevPanel api={api} />) : null}
      </>,
      document.body,
    );
  }

  return DevTools;
}
