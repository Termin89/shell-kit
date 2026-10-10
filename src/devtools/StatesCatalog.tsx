/**
 * StatesCatalog — секция «Состояния» dev-панели: живые машины
 * модулей из dev-реестра (module/states, регистрация по devId при
 * создании — включая standalone-машины вроде auth).
 *
 * На машину: текущее состояние, стейты декларации (путь / host,
 * варианты, access-проекция по ролям — статическая матрица без
 * перелогина), прыжок goto (адресуемые и внутренние: pending
 * доступен прямо из тулы), журнал переходов с replay
 * (последовательный goto траектории).
 *
 * Реестр машин не эмитит события (машины монтируются чанками) —
 * панель опрашивает его тиком, пока открыта. Машины незагруженных
 * модулей в реестре нет: прогрев чанков — defineDev (список модулей
 * с кнопкой перехода — секция «Модули» ниже).
 */

import { useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AppContext } from "../app";
import { getRegisteredStateMachines } from "../module/states";
import type {
  JournalEntry,
  ModuleStateMachine,
  RegisteredStateMachine,
} from "../module/states";
import { Button, Chip } from "../ui";

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 6,
  padding: "8px 0 4px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontWeight: 700,
  fontSize: 12,
};

const machineStyle: CSSProperties = {
  padding: "6px 0 8px",
  borderBottom: "1px solid #eef1f5",
};

const stateRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 5,
  padding: "3px 0",
  fontSize: 12,
};

const stateNameStyle: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontWeight: 600,
};

const journalStyle: CSSProperties = {
  margin: "4px 0 0",
  padding: "4px 8px",
  border: "1px solid #eef1f5",
  borderRadius: 8,
  background: "#f7f9fb",
  fontSize: 11,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  color: "#5c6674",
  maxHeight: 108,
  overflowY: "auto",
  whiteSpace: "nowrap",
};

const modulesRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 5,
  padding: "6px 0",
  borderBottom: "1px solid #eef1f5",
};

/** Плейсхолдер-параметры динамических сегментов пути (:id → demo). */
function demoParams(
  path: string | undefined,
): Readonly<Record<string, string>> | undefined {
  if (path === undefined) return undefined;
  const out: Record<string, string> = {};
  for (const seg of path.split("/")) {
    if (seg.startsWith(":")) out[seg.slice(1)] = "demo";
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Роли-вселенная машины: объединение access.roles состояний. */
function rolesUniverse(machine: ModuleStateMachine<string, string, string>): string[] {
  const roles = new Set<string>();
  for (const config of Object.values(machine.declaration.states)) {
    for (const role of config.access?.roles ?? []) roles.add(role);
  }
  return [...roles];
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour12: false });
}

/**
 * Replay журнала: последовательный goto траектории (старые записи
 * снизу — идём по порядку), с паузой между шагами — видно свапы.
 * Параметры динамических сегментов — плейсхолдеры (в журнале только
 * id состояния).
 */
async function replayJournal(
  machine: ModuleStateMachine<string, string, string>,
  entries: readonly JournalEntry<string>[],
): Promise<void> {
  for (const entry of entries) {
    const config = machine.declaration.states[entry.state];
    if (config === undefined) continue;
    const params = demoParams(config.path);
    machine.goto(entry.state, params === undefined ? undefined : { params });
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

function MachineSection({ entry }: { entry: RegisteredStateMachine }): ReactNode {
  const { machine } = entry;
  const declaration = machine.declaration;
  const roles = rolesUniverse(machine);
  const snapshot = machine.getSnapshot();
  const journal = machine.journalEntries();

  return (
    <section style={machineStyle} data-name={`dev/states/${entry.id}`}>
      <div style={headerStyle}>
        {entry.id}
        <Chip style={{ fontSize: 10, padding: "1px 8px" }}>
          {snapshot.state}
        </Chip>
        <span style={{ marginLeft: "auto", fontWeight: 400 }}>
          {Object.keys(declaration.states).length} сост.
        </span>
        {journal.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            style={{ fontSize: 11, padding: "2px 8px" }}
            onClick={() => void replayJournal(machine, journal)}
            title="Повторить траекторию журнала (goto по записям)"
            data-name={`dev/states/${entry.id}/replay`}
          >
            ⏵ replay
          </Button>
        )}
      </div>

      {Object.entries(declaration.states).map(([id, config]) => {
        const projection = Object.fromEntries(
          roles.map((role) => [role, machine.accessProjection([role])[id]]),
        );
        const params = demoParams(config.path);
        const current = snapshot.state === id;
        return (
          <div
            key={id}
            style={stateRowStyle}
            data-name={`dev/states/${entry.id}/${id}`}
          >
            <span style={stateNameStyle}>{id}</span>
            <span style={{ color: "#5c6674" }}>
              {config.path !== undefined
                ? config.path
                : `→ host ${config.host ?? ""}`}
            </span>
            {roles.map((role) =>
              projection[role] ? (
                <Chip key={role} style={{ fontSize: 10, padding: "1px 7px" }}>
                  {role}
                </Chip>
              ) : (
                <span
                  key={role}
                  style={{ fontSize: 11, color: "#a6aeb9", textDecoration: "line-through" }}
                >
                  {role}
                </span>
              ),
            )}
            {(config.variants ?? []).length > 0 && (
              <span style={{ color: "#5c6674" }}>
                варианты:{" "}
                {(config.variants ?? []).map((v) => v.id).join(", ")}
              </span>
            )}
            <Button
              variant={current ? "soft" : "ghost"}
              size="sm"
              disabled={current}
              style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px" }}
              onClick={() =>
                machine.goto(id, params === undefined ? undefined : { params })
              }
              title="Прямой прыжок (goto)"
              data-name={`dev/states/${entry.id}/${id}/goto`}
            >
              перейти
            </Button>
          </div>
        );
      })}

      {journal.length > 0 && (
        <ol style={journalStyle} data-name={`dev/states/${entry.id}/journal`}>
          {journal
            .slice()
            .reverse()
            .map((e, i) => (
              <li key={`${e.time}-${i}`}>
                {formatTime(e.time)} · {e.state} · {e.source}
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}

/** Секция «Состояния»: живые машины из dev-реестра. */
export function StatesCatalog(): ReactNode {
  const [, setTick] = useState(0);
  // Инстанс приложения (null — тулa вне app.Root: секция модулей
  // скрыта, показываются только машины dev-реестра).
  const app = useContext(AppContext);

  // Реестр машин не эмитит события — опрос тиком, пока смонтирован.
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 700);
    return () => clearInterval(timer);
  }, []);

  const machines = getRegisteredStateMachines();

  return (
    <div data-name="dev/states">
      {app !== null && (
        <div style={modulesRowStyle} data-name="dev/states/modules">
          {app.definition.modules.map((module) => {
            // Отключённые модули (enabled: false по состоянию) видны,
            // но неактивны: переход вёл бы на экран «Раздел недоступен».
            const enabled = module.enabled?.(app.shell.getState()) ?? true;
            const current = app.port.path.split("/")[1] === module.id;
            return (
              <Button
                key={module.id}
                variant={current ? "soft" : "ghost"}
                size="sm"
                disabled={!enabled}
                style={{ fontSize: 11, padding: "2px 8px" }}
                onClick={() => app.port.push(`/${module.id}`)}
                title="Смонтировать модуль (переход по адресу)"
                data-name={`dev/states/module/${module.id}`}
              >
                {module.id}
              </Button>
            );
          })}
        </div>
      )}
      {machines.length === 0 ? (
        <p style={{ padding: "6px 0", margin: 0, color: "#5c6674" }}>
          Живых машин нет — states-модули не смонтированы (auth-машина
          появляется на экране входа).
        </p>
      ) : (
        machines.map((entry) => (
          <MachineSection key={entry.id} entry={entry} />
        ))
      )}
    </div>
  );
}
