import type { ComponentType, ReactNode } from "react";
import { useModuleState } from "./hooks";
import { useModuleRouteSource } from "./hooks";
import { ModuleStateProvider } from "./react";
import { SwapFrame } from "./SwapFrame";
import type {
  StatesDeclaration,
  StatesPageOptions,
  ViewProps,
} from "./types";

/**
 * states/page — сборка декларации состояний в страницу модуля:
 * провайдер машины + рамка-свап + резолв вьюхи активного состояния.
 * Используется defineModule (ветка states) и пригодится напрямую,
 * если моду нужна своя обёртка над страницей.
 */

/** Порядок состояний для направленного свапа: order по возрастанию. */
function swapOrder(declaration: StatesDeclaration<string, string, string>): string[] {
  return Object.entries(declaration.states)
    .filter(([, config]) => typeof config.order === "number")
    .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
    .map(([id]) => id);
}

function StatesPageView({
  declaration,
  order,
  transition,
  className,
  itemClassName,
}: {
  declaration: StatesDeclaration<string, string, string>;
  order: readonly string[];
  transition: "fade" | "slide" | false;
  className?: string;
  itemClassName?: string;
}): ReactNode {
  const { state, params, query, variant, goto, send } = useModuleState();
  const View = declaration.states[state]?.view;
  if (View === undefined) {
    // Валидация декларации уже пожаловалась в консоль — рендерим пусто.
    return null;
  }
  const viewProps: ViewProps<string, string> = {
    state,
    params,
    query,
    variant,
    goto,
    send,
  };
  return (
    <SwapFrame
      swapKey={state}
      order={order}
      transition={transition}
      className={className}
      itemClassName={itemClassName}
    >
      <View {...viewProps} />
    </SwapFrame>
  );
}

/**
 * Собирает страницу модуля из декларации состояний: источник адреса —
 * модульный хвост (useModuleRouteSource), transition по умолчанию —
 * "fade" (декларация может задать "slide" или false).
 *
 * @example
 * const PartnersPage = createStatesPage("partners", PARTNERS_STATES, {
 *   getRoles: () => [user.role],
 * });
 */
export function createStatesPage<
  Id extends string = string,
  Role extends string = string,
  Signal extends string = string,
>(
  moduleId: string,
  declaration: StatesDeclaration<Id, Role, Signal>,
  options: StatesPageOptions<Role> = {},
): ComponentType {
  const decl = declaration as unknown as StatesDeclaration<string, string, string>;
  const order = swapOrder(decl);
  const transition = declaration.transition ?? "fade";
  const devId = options.devId ?? moduleId;

  function StatesPage(): ReactNode {
    const source = useModuleRouteSource(moduleId);
    return (
      <ModuleStateProvider
        declaration={declaration}
        source={source}
        getRoles={options.getRoles}
        journal={options.journal}
        devId={devId}
      >
        <StatesPageView
          declaration={decl}
          order={order}
          transition={transition}
          className={options.className}
          itemClassName={options.itemClassName}
        />
      </ModuleStateProvider>
    );
  }
  return StatesPage;
}
