import { useContext, useMemo, useRef, useSyncExternalStore } from "react";
import { useModuleRoute, useNavigate, usePath } from "../../router/hooks";
import { ModuleStateContext } from "./context";
import type { ModuleStateSource, ModuleStateMachine } from "./machine";
import type { ViewProps } from "./types";

function useContextMachine(): ModuleStateMachine<string, string, string> {
  const machine = useContext(ModuleStateContext);
  if (machine === null) {
    throw new Error(
      "[module-states] хуки состояний требуют <ModuleStateProvider> — см. src/module/states/README.md",
    );
  }
  return machine;
}

/**
 * useModuleState — состояние экрана для вьюх: адресные данные
 * (state/params/query) + вариант + действия машины (goto/send).
 * Рендер — через useSyncExternalStore на эмиттере машины.
 *
 * @example
 * function PartnersList(props: ViewProps<"list" | "detail">) {
 *   const { params, goto } = props; // или useModuleState()
 * }
 */
export function useModuleState<
  Id extends string = string,
  Signal extends string = string,
>(): ViewProps<Id, Signal> {
  const machine = useContextMachine();
  const snapshot = useSyncExternalStore(machine.subscribe, machine.getSnapshot);
  return {
    state: snapshot.state as Id,
    params: snapshot.params,
    query: snapshot.query,
    variant: snapshot.variant,
    goto: machine.goto as ViewProps<Id, Signal>["goto"],
    send: machine.send as ViewProps<Id, Signal>["send"],
  };
}

/** Машина целиком — для нестандартных сценариев внутри экрана. */
export function useModuleStateMachine<
  Id extends string = string,
  Role extends string = string,
  Signal extends string = string,
>(): ModuleStateMachine<Id, Role, Signal> {
  return useContextMachine() as unknown as ModuleStateMachine<Id, Role, Signal>;
}

/**
 * useModuleRouteSource — источник адреса для машины модуля: хвост
 * `useModuleRoute(moduleId)` («/» — корень модуля, "/:id" — хвосты),
 * навигация — через route.navigate (порт пишет полный путь).
 */
export function useModuleRouteSource(moduleId: string): ModuleStateSource {
  const route = useModuleRoute(moduleId);
  const latest = useRef(route);
  latest.current = route;
  // Стабильная обёртка: машина захватывает source один раз при
  // создании — замыкание читает актуальный маршрут через ref.
  // Пространство машины унифицировано: корень — всегда «/». Хвост
  // модуля «» маппится в «/» (иначе goto корня из корня считал бы
  // пути разными и плодил записи истории), «/» машины — в хвост «»
  // (иначе конкатенация с базой давала бы «/<module>/»).
  return useMemo<ModuleStateSource>(
    () => ({
      getPath: () => (latest.current.path === "" ? "/" : latest.current.path),
      getQuery: () => window.location.search,
      navigate: (path, options) =>
        latest.current.navigate(path === "/" ? "" : path, options),
    }),
    [],
  );
}

/**
 * useRouterSource — источник адреса в полном пространстве роутера
 * («/login», а не модульный хвост): для standalone-машин вне реестра
 * модулей — классический пример auth-гейт.
 */
export function useRouterSource(): ModuleStateSource {
  const path = usePath();
  const navigate = useNavigate();
  const latestPath = useRef(path);
  latestPath.current = path;
  const latestNavigate = useRef(navigate);
  latestNavigate.current = navigate;
  return useMemo<ModuleStateSource>(
    () => ({
      getPath: () => latestPath.current,
      getQuery: () => window.location.search,
      navigate: (p, options) => latestNavigate.current(p, options),
    }),
    [],
  );
}
