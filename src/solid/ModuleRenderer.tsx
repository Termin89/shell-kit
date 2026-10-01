import { createEffect, createMemo, createSignal, onSettled, untrack, Show, Errored, Loading } from "solid-js";
import type { Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
import { useActiveModules, useShell, useShellState } from "./hooks";
import { getModuleComponent } from "./module-lazy";

export interface ModuleRendererProps {
  /** id модуля для рендера. Не задан — берётся из state.activeModule. */
  moduleId?: string;
  /** Fallback на время загрузки модуля. */
  fallback?: JSX.Element;
  /** Что показать, если модуль не активен или не зарегистрирован. */
  notFound?: JSX.Element;
  /** Кастомный рендер ошибки загрузки/рендера модуля. */
  errorFallback?: (error: Accessor<Error>, retry: () => void) => JSX.Element;
  /**
   * Появление страницы при смене модуля (enter-only): имя CSS-варианта
   * или резолвер per-module (глобальный дефолт + точечные override).
   * Вариант — просто строка: рендерер ставит `data-page-enter="<имя>"`
   * на обёртку контента, анимирует CSS (компонентные классы ядра —
   * fade/fade-up/scale — или свои в theme.css проекта; длительность/
   * кривая — токены --page-enter-*). Анимация только на композиторе
   * (transform/opacity), при prefers-reduced-motion отключается
   * на уровне CSS. Первый вход в приложение не анимируется.
   *
   * Пересоздание поддерева при смене модуля (keyed <Show>) само
   * перезапускает CSS-анимацию — отдельный ключ, как в React, не нужен.
   */
  pageTransition?: string | ((moduleId: string) => string | undefined);
  /**
   * Минимальное время показа загрузчика при смене модуля, мс: пока
   * идёт задержка, рендерится `fallback`, а чанк нового модуля греется
   * сразу — задержка не суммируется с загрузкой (на медленной сети
   * загрузчик просто живёт дольше). 0 / undefined — без задержки.
   * Действует только на переключения между показами модулей: первый
   * показ (вход в приложение, включая асинхронное появление
   * activeModule после bootstrap), retry и уход в notFound — без
   * задержки.
   */
  loadingDelay?: number;
}

const DefaultLoading = (): JSX.Element => <div>Loading module…</div>;

const DefaultError = (props: {
  error: Accessor<Error>;
  retry: () => void;
}): JSX.Element => (
  <div role="alert">
    <p>Failed to load module: {props.error().message}</p>
    <button type="button" onClick={props.retry}>
      Retry
    </button>
  </div>
);

/**
 * Рендерит модуль по id (или из state.activeModule): загрузка через
 * <Loading> (lazy-чанк), ошибки — через <Errored> с retry. Неактивный
 * или незарегистрированный модуль — notFound.
 *
 * Паритет с React-версией: retry пересоздаёт поддерево целиком
 * (keyed <Show> по `${targetId}:${attempt}`) — недостаточно сбросить
 * boundary, solid-`lazy` кеширует промис внутри себя, а кеш
 * module-lazy уже сброшен при ошибке → remount создаёт свежий lazy
 * и заново вызывает loadModule.
 */
export function ModuleRenderer(props: ModuleRendererProps): JSX.Element {
  const shell = useShell();
  const state = useShellState();
  const activeModules = useActiveModules();

  const targetId = createMemo(() => props.moduleId ?? state().activeModule);
  const isActive = createMemo(() => {
    const id = targetId();
    return id !== null && activeModules().some((m) => m.id === id);
  });

  // attempt пересоздаёт поддерево после ошибки: кеш lazy уже сброшен
  // при неудаче, поэтому новая попытка заново вызывает loadModule.
  // Запись — из обработчика клика (вне owned scope).
  const [attempt, setAttempt] = createSignal(0);
  const retry = (): void => {
    setAttempt((a) => a + 1);
  };

  // Первый вход в приложение (F5/логин): страницу не анимируем,
  // только переключения после него.
  let firstRender = true;
  onSettled(() => {
    firstRender = false;
  });

  // Минимальное время показа загрузчика: shownId отстаёт от targetId
  // только на задержку; чанк греется сразу, поэтому задержка не
  // добавляется к загрузке сверху. Начальное значение — синхронный
  // untrack-peek (тело компонента — owner, не tracking scope).
  const [shownId, setShownId] = createSignal<string | null>(
    untrack(() => targetId()),
  );
  const holding = createMemo(() => shownId() !== targetId());
  // Задержка — только между показами модулей: первый показ (вход:
  // F5/логин, включая асинхронный resolve activeModule из null) идёт
  // без загрузчика.
  let hasShown = false;
  createEffect(
    () => shownId(),
    (id) => {
      if (id !== null) {
        hasShown = true;
      }
    },
  );
  createEffect(
    () => ({
      holding: shownId() !== targetId(),
      target: targetId(),
      delay: props.loadingDelay ?? 0,
    }),
    ({ holding: isHolding, target, delay }) => {
      if (!isHolding || target === null) {
        return;
      }
      if (delay <= 0 || !hasShown) {
        setShownId(target);
        return;
      }
      // Прогрев чанка: к концу задержки модуль уже в кешах Shell/lazy.
      void shell.loadModule(target).catch(() => {
        // Ошибка всплывёт через lazy при рендере модуля.
      });
      const timer = setTimeout(() => setShownId(target), delay);
      return () => clearTimeout(timer);
    },
  );

  const enterVariant = createMemo(() => {
    const id = targetId();
    if (id === null) {
      return undefined;
    }
    const transition = props.pageTransition;
    if (transition === undefined) {
      return undefined;
    }
    return typeof transition === "function" ? transition(id) : transition;
  });

  const renderError = (err: Accessor<unknown>): JSX.Element => {
    const error = err as Accessor<Error>;
    return props.errorFallback ? (
      props.errorFallback(error, retry)
    ) : (
      <DefaultError error={error} retry={retry} />
    );
  };

  // Ветка контента модуля: создаётся заново каждым keyed-remount,
  // поэтому getModuleComponent здесь видит свежий кеш после сбоя.
  const ModuleView = (p: {
    moduleId: string;
    transition: string | undefined;
    animate: boolean;
  }): JSX.Element => {
    const ModuleComponent = getModuleComponent(shell, p.moduleId);
    if (p.transition === undefined) {
      return <ModuleComponent />;
    }
    return (
      <div data-page-enter={p.animate ? p.transition : undefined}>
        <ModuleComponent />
      </div>
    );
  };

  return (
    <Show
      when={isActive() && targetId() !== null}
      fallback={props.notFound ?? null}
    >
      <Show when={!holding()} fallback={props.fallback ?? <DefaultLoading />}>
        <Show when={`${targetId() ?? "none"}:${attempt()}`} keyed>
          <Loading fallback={props.fallback ?? <DefaultLoading />}>
            <Errored fallback={(err, _reset) => renderError(err)}>
              <ModuleView
                moduleId={targetId() ?? ""}
                transition={enterVariant()}
                animate={!firstRender}
              />
            </Errored>
          </Loading>
        </Show>
      </Show>
    </Show>
  );
}
