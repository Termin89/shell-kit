/**
 * StatesCatalog — секция «Состояния» dev-панели, два раздела:
 *
 * - **Каталог** — реестр деклараций (module/states/registry): чанк
 *   модуля грузится → декларация в реестре. Состояния × варианты ×
 *   статическая access-матрица (projectAccess, guard — маркером
 *   «guard?»), главная кнопка «превью» — офлайн-оверлей PreviewHost
 *   (изолированная машина, URL и состояние приложения не мутируются,
 *   работает и с экрана входа — ShellGate не нужен).
 * - **Живые машины** (вторично, помечено «живое») — dev-реестр
 *   смонтированных машин: goto-прыжки, журнал с replay — обратная
 *   связь с реальным приложением.
 *
 * Оба реестра не эмитят события (наполняются загрузкой чанков) —
 * панель опрашивает их тиком, пока открыта. Прогрев чанков —
 * defineDev (секция «Модули» ниже — чипы реальной навигации).
 */

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AppContext } from "../app";
import {
  getRegisteredStateDeclarations,
  getRegisteredStateMachines,
  hasRuntimeGuard,
  projectAccess,
} from "../module/states";
import type {
  JournalEntry,
  ModuleStateMachine,
  RegisteredStateMachine,
  RegisteredStatesDeclaration,
} from "../module/states";
import { Button, Chip } from "../ui";
import { PreviewHost } from "./PreviewHost";
import type { PreviewInitState } from "./PreviewHost";
import { demoParams, rolesUniverse } from "./preview";

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

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 0 2px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#5c6674",
};

const hintStyle: CSSProperties = {
  padding: "6px 0",
  margin: 0,
  color: "#5c6674",
};

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

/** Секция каталога: декларация из реестра — состояния и превью. */
function DeclarationSection({
  entry,
  onPreview,
}: {
  readonly entry: RegisteredStatesDeclaration;
  readonly onPreview: (
    entry: RegisteredStatesDeclaration,
    initState: PreviewInitState,
  ) => void;
}): ReactNode {
  const declaration = entry.declaration;
  const roles = useMemo(() => rolesUniverse(declaration), [declaration]);
  const projectionByRole = useMemo(
    () =>
      Object.fromEntries(
        roles.map((role) => [role, projectAccess(declaration, [role])]),
      ),
    [declaration, roles],
  );

  return (
    <section style={machineStyle} data-name={`dev/decl/${entry.id}`}>
      <div style={headerStyle}>
        {entry.id}
        <span style={{ marginLeft: "auto", fontWeight: 400 }}>
          {Object.keys(declaration.states).length} сост.
        </span>
      </div>

      {Object.entries(declaration.states).map(([id, config]) => (
        <div key={id} style={stateRowStyle} data-name={`dev/decl/${entry.id}/${id}`}>
          <span style={stateNameStyle}>{id}</span>
          <span style={{ color: "#5c6674" }}>
            {config.path !== undefined
              ? config.path
              : `→ host ${config.host ?? ""}`}
          </span>
          {roles.map((role) =>
            projectionByRole[role][id] ? (
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
          {hasRuntimeGuard(declaration, id) && (
            <Chip style={{ fontSize: 10, padding: "1px 7px", color: "#8a6d1a" }}>
              guard?
            </Chip>
          )}
          {(config.variants ?? []).map((variant) => (
            <Button
              key={variant.id}
              variant="ghost"
              size="sm"
              style={{ fontSize: 10, padding: "1px 7px" }}
              title={`Превью варианта: ${variant.title}`}
              onClick={() => onPreview(entry, { state: id, variant: variant.id })}
              data-name={`dev/decl/${entry.id}/${id}/variant/${variant.id}`}
            >
              v:{variant.id}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px" }}
            onClick={() => onPreview(entry, { state: id })}
            title="Офлайн-превью в оверлее: URL и состояние приложения не меняются"
            data-name={`dev/decl/${entry.id}/${id}/preview`}
          >
            превью
          </Button>
        </div>
      ))}
    </section>
  );
}

/** Секция живой машины: goto-прыжки, журнал, replay (вторично каталогу). */
function MachineSection({ entry }: { entry: RegisteredStateMachine }): ReactNode {
  const { machine } = entry;
  const declaration = machine.declaration;
  const roles = useMemo(() => rolesUniverse(declaration), [declaration]);
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

/** Секция «Состояния»: каталог деклараций + живые машины + превью. */
export function StatesCatalog(): ReactNode {
  const [, setTick] = useState(0);
  // Инстанс приложения (null — тулa вне app.Root: секция модулей
  // скрыта, показываются только реестры).
  const app = useContext(AppContext);
  const [preview, setPreview] = useState<{
    readonly entry: RegisteredStatesDeclaration;
    readonly initState: PreviewInitState;
  } | null>(null);

  // Реестры не эмитит события — опрос тиком, пока смонтирован.
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 700);
    return () => clearInterval(timer);
  }, []);

  const openPreview = useCallback(
    (
      entry: RegisteredStatesDeclaration,
      initState: PreviewInitState,
    ): void => {
      setPreview({ entry, initState });
    },
    [],
  );

  const declarations = getRegisteredStateDeclarations();
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

      <div style={sectionHeadStyle} data-name="dev/decl">
        Каталог · декларации
      </div>
      {declarations.length === 0 ? (
        <p style={hintStyle}>
          Реестр деклараций пуст — states-модули ещё не грузились
          (панель прогревает их чанки при открытии).
        </p>
      ) : (
        declarations.map((entry) => (
          <DeclarationSection key={entry.id} entry={entry} onPreview={openPreview} />
        ))
      )}

      <div style={sectionHeadStyle} data-name="dev/live">
        Живые машины
        <Chip style={{ fontSize: 9, padding: "0 6px" }}>живое</Chip>
      </div>
      {machines.length === 0 ? (
        <p style={hintStyle}>
          Живых машин нет — экраны states-модулей не смонтированы.
        </p>
      ) : (
        machines.map((entry) => (
          <MachineSection key={entry.id} entry={entry} />
        ))
      )}

      {preview !== null && (
        <PreviewHost
          key={`${preview.entry.id}:${preview.initState.state}:${preview.initState.variant ?? ""}`}
          entry={preview.entry}
          initState={preview.initState}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
