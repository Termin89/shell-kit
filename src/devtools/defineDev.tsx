/**
 * defineDev — фабрика dev-тулы приложения (аналог defineModule для dev).
 *
 * Возвращает компонент: плавающая кнопка «DEV» (fixed внизу справа,
 * портал в body, z-60) → панель с секцией «API · Сервисы» (z-70 — ниже
 * проектных модалок): список сервисов реестра, радио стратегий,
 * «Применить» (активна при изменениях) и «Сбросить».
 *
 * Вьюха заменяемая: view-проп получает DevPanelApi (каталог, черновик
 * выбора, apply/reset/close) — UI на дизайн-системе проекта. Данные —
 * getServiceCatalog() реестра service-слоя; тулу видно только
 * загруженные service-модули, поэтому dev-чанк приложения импортирует
 * их статически.
 *
 * Apply = write в LS + location.reload() (у сервисов есть состояние:
 * LS-моки, query-кеш, module-level инстансы — чистый старт). Ядро DEV
 * не гейтит (import.meta.env — не для lib-кода): вырезание из prod —
 * `import.meta.env.DEV && <DevTools/>` в приложении.
 */

import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
 * гейтов экранов — работает и на auth-экране).
 *
 * @example
 * const DevTools = defineDev({ className: "…" });
 * // в рендере корня:
 * import.meta.env.DEV && <DevTools />
 */
export function defineDev(config: DevToolsConfig = {}): ComponentType {
  const { view, className } = config;

  function DevTools(): ReactNode {
    const [open, setOpen] = useState(false);
    const [catalog, setCatalog] = useState<ReadonlyArray<ServiceCatalogEntry>>([]);
    const [selection, setSelection] = useState<Record<string, string>>({});

    // Каталог перечитывается при открытии: реестр мог пополниться
    // ленивыми чанками с прошлого раза.
    const openPanel = useCallback(() => {
      const snapshot = getServiceCatalog();
      setCatalog(snapshot);
      setSelection(buildSelection(snapshot));
      setOpen(true);
    }, []);

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
      select,
      apply,
      reset,
      close,
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
