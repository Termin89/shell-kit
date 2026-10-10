/**
 * PreviewHost — офлайн-превью состояний («режиссёр»): оверлей с
 * изолированной машиной по декларации из реестра (module/states/
 * registry). Машина живёт на source-стабе в памяти — реальный URL
 * и состояние приложения не мутируются; onEnter не вызывается
 * (skipOnEnter), devId/журнал не заданы — реестр живых машин не
 * засоряется. Роли — чипами в нижнем баре (getRoles через ref:
 * смена роли без пересоздания машины); запрещённое для роли
 * состояние откатывается в fallback — чипы показывают факт из
 * снапшота, а не выбор.
 *
 * Вьюхи, требующие контекста экрана (vm-контроллер auth), рендерятся
 * через preview-обёртку записи реестра; прочие сбои рендера гасит
 * ErrorBoundary — карточка вместо белого экрана.
 */

import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ModuleStateProvider,
  SwapFrame,
  projectAccess,
  swapOrder,
  useModuleState,
  useModuleStateMachine,
} from "../module/states";
import type {
  ModuleStateSource,
  RegisteredStatesDeclaration,
} from "../module/states";
import { Button, Chip } from "../ui";
import { demoParams, demoPath, rolesUniverse, statePath } from "./preview";

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  // z-80: панель тулы — 70, превью поверх неё
  zIndex: 80,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  fontFamily: FONT,
  fontSize: 13,
  lineHeight: 1.45,
  color: "#1c2430",
};

const backdropStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(15, 23, 36, 0.55)",
};

const frameStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  width: "min(1080px, 100%)",
  maxHeight: "calc(100dvh - 48px)",
  background: "#ffffff",
  borderRadius: 12,
  boxShadow: "0 24px 64px rgba(15, 23, 36, 0.35)",
  overflow: "hidden",
};

const previewHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderBottom: "1px solid #e3e7ec",
};

const stageStyle: CSSProperties = {
  flex: 1,
  minHeight: 320,
  overflow: "auto",
  background: "#ffffff",
};

const barStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  maxHeight: 168,
  overflowY: "auto",
  padding: "8px 12px 10px",
  borderTop: "1px solid #e3e7ec",
};

const barRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 5,
};

const barLabelStyle: CSSProperties = {
  minWidth: 84,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#5c6674",
};

const chipStyle: CSSProperties = { fontSize: 11, padding: "2px 8px" };

const boundaryStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 8,
  margin: 24,
  padding: 16,
  maxWidth: 520,
  border: "1px solid #e3e7ec",
  borderRadius: 12,
  background: "#f7f9fb",
};

/**
 * Граница ошибок превью: контекстожадная вьюха (требует провайдер
 * экрана, которого нет в изоляции) деградирует карточкой, а не белым
 * экраном; «повторить» пере-рендерит после правки обстоятельств
 * (например, смены роли).
 */
class PreviewBoundary extends Component<
  { readonly children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error | null } {
    return { error };
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error !== null) {
      return (
        <div style={boundaryStyle} data-name="dev/preview/error">
          <strong style={{ fontSize: 13 }}>Вьюха не отрендерилась в превью</strong>
          <p style={{ margin: 0, fontSize: 12, color: "#5c6674" }}>
            Часто вьюхе нужен контекст экрана (провайдер контроллера или
            данных), которого нет в изолированном превью. Добавьте
            preview-обёртку в регистрацию декларации.
          </p>
          <code style={{ fontSize: 11, color: "#a03434", wordBreak: "break-word" }}>
            {error.message}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => this.setState({ error: null })}
            data-name="dev/preview/retry"
          >
            Повторить
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Точка входа превью: какое состояние (и вариант) показать. */
export interface PreviewInitState {
  readonly state: string;
  readonly variant?: string;
}

export interface PreviewHostProps {
  /** Запись реестра деклараций (декларация + превью-обёртка). */
  readonly entry: RegisteredStatesDeclaration;
  readonly initState: PreviewInitState;
  readonly onClose: () => void;
}

/**
 * Сцена превью — внутри провайдера изолированной машины: свап-рамка
 * с вьюхой состояния + нижний бар (состояния / варианты / роли).
 * Выбор (state/variant/role) — локальный;.goto прогоняется
 * layout-эффектом, активность чипов читается из снапшота машины.
 */
function PreviewStage({
  entry,
  initState,
  rolesRef,
}: {
  readonly entry: RegisteredStatesDeclaration;
  readonly initState: PreviewInitState;
  readonly rolesRef: { current: readonly string[] };
}): ReactNode {
  const declaration = entry.declaration;
  const machine = useModuleStateMachine();
  const view = useModuleState();
  const order = useMemo(() => swapOrder(declaration), [declaration]);
  const universe = useMemo(() => rolesUniverse(declaration), [declaration]);
  const Wrap = entry.preview;

  const [selected, setSelected] = useState<{ state: string; variant: string | null }>({
    state: initState.state,
    variant: initState.variant ?? null,
  });
  // Стартовая роль — первая из вселенной, которой состояние доступно
  // (статическая проекция): превью ролевого состояния открывается
  // сразу «в роли», а не откатом в fallback.
  const [role, setRole] = useState<string | null>(() => {
    for (const candidate of universe) {
      if (projectAccess(declaration, [candidate])[initState.state] === true) {
        return candidate;
      }
    }
    return null;
  });
  // Счётчик попыток: повторный клик по тому же чипу после отката в
  // fallback (смена роли) снова прогоняет goto.
  const [attempt, setAttempt] = useState(0);

  const gotoPreview = useCallback(
    (state: string, variant: string | null, nextRole: string | null) => {
      rolesRef.current = nextRole === null ? [] : [nextRole];
      const params = demoParams(statePath(declaration, state));
      machine.goto(state, {
        ...(params === undefined ? {} : { params }),
        variant,
      });
    },
    [declaration, machine, rolesRef],
  );

  // Первый вход — layout-эффектом до краски (path-стаб предрезолвен,
  // без «мигающего» initial), дальше — на каждую смену выбора.
  useLayoutEffect(() => {
    gotoPreview(selected.state, selected.variant, role);
  }, [gotoPreview, selected.state, selected.variant, role, attempt]);

  const selectState = (state: string): void => {
    setSelected({ state, variant: null });
    setAttempt((n) => n + 1);
  };

  const selectVariant = (variant: string | null): void => {
    setSelected({ state: view.state, variant });
    setAttempt((n) => n + 1);
  };

  const selectRole = (nextRole: string | null): void => {
    setRole(nextRole);
    setAttempt((n) => n + 1);
  };

  const variants = declaration.states[view.state]?.variants ?? [];
  const View = declaration.states[view.state]?.view;

  return (
    <>
      <div style={stageStyle} data-name="dev/preview/stage">
        {View === undefined ? null : (
          <SwapFrame
            swapKey={view.state}
            order={order}
            transition={declaration.transition ?? "fade"}
          >
            <PreviewBoundary>
              {Wrap === undefined ? (
                <View {...view} />
              ) : (
                <Wrap>
                  <View {...view} />
                </Wrap>
              )}
            </PreviewBoundary>
          </SwapFrame>
        )}
      </div>

      <div style={barStyle} data-name="dev/preview/bar">
        <div style={barRowStyle}>
          <span style={barLabelStyle}>состояния</span>
          {Object.entries(declaration.states).map(([id, config]) => (
            <Button
              key={id}
              variant={view.state === id ? "soft" : "ghost"}
              size="sm"
              style={chipStyle}
              title={config.title ?? id}
              onClick={() => selectState(id)}
              data-name={`dev/preview/state/${id}`}
            >
              {id}
            </Button>
          ))}
        </div>

        {variants.length > 0 && (
          <div style={barRowStyle}>
            <span style={barLabelStyle}>варианты</span>
            <Button
              variant={view.variant === null ? "soft" : "ghost"}
              size="sm"
              style={chipStyle}
              title="Вариант по умолчанию (variant = null)"
              onClick={() => selectVariant(null)}
              data-name="dev/preview/variant/default"
            >
              по умолчанию
            </Button>
            {variants.map((variant) => (
              <Button
                key={variant.id}
                variant={view.variant === variant.id ? "soft" : "ghost"}
                size="sm"
                style={chipStyle}
                title={variant.title}
                onClick={() => selectVariant(variant.id)}
                data-name={`dev/preview/variant/${variant.id}`}
              >
                {variant.id}
              </Button>
            ))}
          </div>
        )}

        <div style={barRowStyle}>
          <span style={barLabelStyle}>роли</span>
          <Button
            variant={role === null ? "soft" : "ghost"}
            size="sm"
            style={chipStyle}
            title="Пустой набор ролей (как до логина)"
            onClick={() => selectRole(null)}
            data-name="dev/preview/role/none"
          >
            без роли
          </Button>
          {universe.map((candidate) => (
            <Button
              key={candidate}
              variant={role === candidate ? "soft" : "ghost"}
              size="sm"
              style={chipStyle}
              onClick={() => selectRole(candidate)}
              data-name={`dev/preview/role/${candidate}`}
            >
              {candidate}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Оверлей превью: портал в body, z-80 (поверх панели тулы), Esc и
 * клик по затемнению закрывают. Машина — только на props.entry
 * (key на провайдере), source-стаб создаётся один раз на открытие.
 */
export function PreviewHost({
  entry,
  initState,
  onClose,
}: PreviewHostProps): ReactNode {
  const declaration = entry.declaration;
  // Source-стаб в памяти: своё пространство адреса — navigate/replace
  // пишут в pathRef, реальный роутер не участвует. Засев — demoPath
  // целевого состояния: первый sync уже резолвит его.
  const [source] = useState<ModuleStateSource>(() => {
    const pathRef = { current: demoPath(declaration, initState.state) };
    return {
      getPath: () => pathRef.current,
      getQuery: () => "",
      navigate: (path: string) => {
        pathRef.current = path;
      },
    };
  });
  const rolesRef = useRef<readonly string[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label={`Превью состояний: ${entry.id}`}
      data-name="dev/preview"
    >
      <div
        style={backdropStyle}
        onClick={onClose}
        aria-hidden="true"
        data-name="dev/preview/backdrop"
      />
      <div style={frameStyle} data-name="dev/preview/frame">
        <div style={previewHeaderStyle}>
          <strong style={{ fontSize: 13 }}>превью · {entry.id}</strong>
          <Chip style={{ fontSize: 10, padding: "1px 8px" }}>офлайн</Chip>
          <Button
            variant="ghost"
            size="sm"
            style={{ marginLeft: "auto" }}
            onClick={onClose}
            aria-label="Закрыть превью"
            data-name="dev/preview/close"
          >
            ✕
          </Button>
        </div>
        <ModuleStateProvider
          key={entry.id}
          declaration={declaration}
          source={source}
          getRoles={() => rolesRef.current}
          skipOnEnter
        >
          <PreviewStage entry={entry} initState={initState} rolesRef={rolesRef} />
        </ModuleStateProvider>
      </div>
    </div>,
    document.body,
  );
}
