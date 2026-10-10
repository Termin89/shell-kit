import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ModuleStateContext } from "./context";
import { createModuleStateMachine } from "./machine";
import type {
  ModuleStateSource,
  ModuleStateMachine,
} from "./machine";
import type { StatesDeclaration } from "./types";

export interface ModuleStateProviderProps<
  Id extends string = string,
  Role extends string = string,
  Signal extends string = string,
> {
  /** Декларация карты состояний — фиксируется при монтировании. */
  readonly declaration: StatesDeclaration<Id, Role, Signal>;
  /** Источник адреса (useModuleRouteSource / useRouterSource). */
  readonly source: ModuleStateSource;
  /** Инъекция ролей для access-проверок. */
  readonly getRoles?: () => readonly Role[];
  /** Журнал переходов для dev-тулы. */
  readonly journal?: boolean;
  /** Имя машины в dev-реестре (каталог состояний тулы). */
  readonly devId?: string;
  readonly children: ReactNode;
}

/**
 * ModuleStateProvider — машина состояний экрана в React: создаётся
 * один раз на монтирование (useRef), внешние изменения адреса
 * Sync'аются в layout-эффекте до краски. Дети читают состояние через
 * useModuleState (useSyncExternalStore на эмиттере машины).
 *
 * onEnter стреляет на первом sync — StrictMode (двойной эффект) не
 * задваивает: повторный sync не считается переходом. Провайдер не
 * диспоузит машину при размонтировании: remount-цикл StrictMode
 * переживается той же машиной, dispose — забота владельца ref'а.
 */
export function ModuleStateProvider<
  Id extends string = string,
  Role extends string = string,
  Signal extends string = string,
>(props: ModuleStateProviderProps<Id, Role, Signal>): ReactNode {
  const machineRef = useRef<ModuleStateMachine<Id, Role, Signal> | null>(null);
  if (machineRef.current === null) {
    machineRef.current = createModuleStateMachine(props.declaration, {
      source: props.source,
      getRoles: props.getRoles,
      journal: props.journal,
      devId: props.devId,
    });
  }
  const machine = machineRef.current;

  // Внешние изменения адреса (back/forward, deep-link, переходы из
  // соседних экранов): пересчёт до краски, чтобы дети не мигнули
  // стейл-снапшотом. sync дешёвый — без изменений просто выходит.
  useLayoutEffect(() => {
    machine.sync();
  });

  return (
    <ModuleStateContext.Provider
      value={machine as unknown as ModuleStateMachine<string, string, string>}
    >
      {props.children}
    </ModuleStateContext.Provider>
  );
}
