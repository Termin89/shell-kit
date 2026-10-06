/**
 * Дефолтная вьюха dev-панели: меню с секцией «API · Сервисы».
 *
 * Рисуется на примитивах shell-kit/ui (Button/Card/Chip) — работает в
 * любом проекте, импортирующем shell-kit/ui/styles.css; специфичные
 * для тулы стили (fixed-позиционирование, z-слои) — инлайн: слой ниже
 * модалок проекта (fab z-60, панель z-70 — проектные оверлеи выше).
 * Свою вьюху под дизайн-систему подключает view-проп defineDev.
 */

import type { CSSProperties, ReactNode } from "react";
import type { ServiceCatalogEntry } from "../service";
import { Button, Card, Chip } from "../ui";
import type { DevPanelApi } from "./types";

const FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const panelStyle: CSSProperties = {
  position: "fixed",
  right: "16px",
  bottom: "calc(var(--sk-devtools-bottom, 1.5rem) + 3.25rem)",
  zIndex: 70,
  width: "min(340px, calc(100vw - 32px))",
  maxHeight: "min(72dvh, 620px)",
  display: "flex",
  flexDirection: "column",
  fontFamily: FONT,
  fontSize: 13,
  lineHeight: 1.45,
  color: "#1c2430",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "10px 12px 8px",
  borderBottom: "1px solid #e3e7ec",
};

const listStyle: CSSProperties = {
  overflowY: "auto",
  padding: "4px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const footerStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "10px 12px",
  borderTop: "1px solid #e3e7ec",
};

const serviceNameStyle: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  fontWeight: 600,
};

const sectionTitleStyle: CSSProperties = {
  padding: "10px 12px 2px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#5c6674",
};

const baseUrlStyle: CSSProperties = {
  padding: "0 12px 6px",
  fontSize: 11,
  color: "#5c6674",
  wordBreak: "break-all",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 6,
  padding: "6px 0",
  borderBottom: "1px solid #eef1f5",
};

const strategiesStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 6,
  marginLeft: "auto",
};

const pillBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 10px",
  border: "1px solid #d7dbe1",
  borderRadius: 999,
  fontSize: 12,
  cursor: "pointer",
  userSelect: "none",
};

const pillChecked: CSSProperties = {
  ...pillBase,
  background: "#16335b",
  borderColor: "#16335b",
  color: "#ffffff",
};

/** Строка сервиса: имя + радио стратегий (или статичная строка). */
function ServiceRow({ entry, api }: { entry: ServiceCatalogEntry; api: DevPanelApi }): ReactNode {
  const selected = api.selection[entry.serviceId];
  const single = entry.strategies.length === 1 ? entry.strategies[0] : undefined;

  return (
    <div style={rowStyle} data-name={`dev/service/${entry.serviceId}`}>
      <span style={serviceNameStyle}>{entry.serviceId}</span>
      {entry.overrideStrategyId !== undefined && (
        <Chip style={{ fontSize: 10, padding: "1px 8px" }}>override</Chip>
      )}
      {single !== undefined ? (
        <span style={{ ...strategiesStyle, fontSize: 12, color: "#5c6674" }}>
          {single.id}
        </span>
      ) : (
        <span style={strategiesStyle} role="radiogroup" aria-label={`Стратегия ${entry.serviceId}`}>
          {entry.strategies.map((strategy) => {
            const checked = selected === strategy.id;
            const active = entry.activeStrategyId === strategy.id;
            return (
              <label
                key={strategy.id}
                style={checked ? pillChecked : pillBase}
                data-name={`dev/strategy/${entry.serviceId}/${strategy.id}`}
              >
                <input
                  type="radio"
                  name={`sk-devtools-${entry.serviceId}`}
                  checked={checked}
                  onChange={() => api.select(entry.serviceId, strategy.id)}
                  style={{ margin: 0, accentColor: checked ? "#ffffff" : "#16335b" }}
                />
                {strategy.id}
                {active && <span aria-label="активная">●</span>}
              </label>
            );
          })}
        </span>
      )}
    </div>
  );
}

/** Дефолтная панель: секция «API · Сервисы», применить/сбросить. */
export function DefaultDevPanel({ api }: { api: DevPanelApi }): ReactNode {
  return (
    <Card style={panelStyle} role="dialog" aria-label="DEV-инструменты" data-name="dev/panel" id="sk-devtools-panel">
      <div style={headerStyle}>
        <strong>DEV · инструменты</strong>
        <Button variant="ghost" size="sm" onClick={api.close} aria-label="Закрыть" data-name="dev/close">
          ✕
        </Button>
      </div>

      <div style={sectionTitleStyle}>API · Сервисы</div>
      <div style={baseUrlStyle}>
        baseUrl:{" "}
        {api.baseUrl === undefined
          ? "— (контекст не биндился)"
          : api.baseUrl === ""
            ? "«» — same-origin"
            : api.baseUrl}
      </div>

      <div style={listStyle}>
        {api.catalog.length === 0 ? (
          <p style={{ padding: "8px 0", margin: 0, color: "#5c6674" }}>
            Реестр пуст — service-модули ещё не загружены (ленивые чанки).
          </p>
        ) : (
          api.catalog.map((entry) => <ServiceRow key={entry.serviceId} entry={entry} api={api} />)
        )}
      </div>

      <div style={footerStyle}>
        <Button
          size="sm"
          disabled={!api.dirty}
          onClick={api.apply}
          title={api.dirty ? "Записать override и перезагрузить" : "Нет изменений"}
          data-name="dev/apply"
        >
          Применить
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={api.reset}
          title="Снять все override и перезагрузить"
          data-name="dev/reset"
        >
          Сбросить
        </Button>
      </div>
    </Card>
  );
}
