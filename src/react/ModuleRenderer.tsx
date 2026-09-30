import { Component, Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useActiveModules, useShell, useShellState } from "./hooks";
import { getModuleComponent } from "./module-lazy";

export interface ModuleRendererProps {
  /** id модуля для рендера. Не задан — берётся из state.activeModule. */
  moduleId?: string;
  /** Fallback на время загрузки модуля. */
  fallback?: ReactNode;
  /** Что показать, если модуль не активен или не зарегистрирован. */
  notFound?: ReactNode;
  /** Кастомный рендер ошибки загрузки/рендера модуля. */
  errorFallback?: (error: Error, retry: () => void) => ReactNode;
  /**
   * Появление страницы при смене модуля (enter-only): имя CSS-варианта
   * или резолвер per-module (глобальный дефолт + точечные override).
   * Вариант — просто строка: рендерер ставит `data-page-enter="<имя>"`
   * на обёртку контента, анимирует CSS (компонентные классы ядра —
   * fade/fade-up/scale — или свои в theme.css проекта; длительность/
   * кривая — токены --page-enter-*). Анимация только на композиторе
   * (transform/opacity), при prefers-reduced-motion отключается
   * на уровне CSS. Первый вход в приложение не анимируется.
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

const DefaultLoading = () => <div>Loading module…</div>;

const DefaultError = ({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) => (
  <div role="alert">
    <p>Failed to load module: {error.message}</p>
    <button type="button" onClick={retry}>
      Retry
    </button>
  </div>
);

interface ModuleErrorBoundaryProps {
  children: ReactNode;
  renderError: (error: Error, retry: () => void) => ReactNode;
  onRetry: () => void;
}

class ModuleErrorBoundary extends Component<
  ModuleErrorBoundaryProps,
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  retry = () => {
    this.setState({ error: null });
    this.props.onRetry();
  };

  render() {
    const { error } = this.state;
    if (error) return this.props.renderError(error, this.retry);
    return this.props.children;
  }
}

/**
 * Рендерит модуль по id (или из state.activeModule): загрузка через
 * Suspense, ошибки — через Error Boundary с retry. Неактивный или
 * незарегистрированный модуль — notFound.
 */
export const ModuleRenderer = ({
  moduleId,
  fallback,
  notFound,
  errorFallback,
  pageTransition,
  loadingDelay,
}: ModuleRendererProps) => {
  const shell = useShell();
  const activeModules = useActiveModules();
  const { activeModule } = useShellState();
  const targetId = moduleId ?? activeModule;
  const isActive =
    targetId !== null && activeModules.some((m) => m.id === targetId);
  // attempt пересоздаёт boundary после ошибки: кеш lazy уже сброшен
  // при неудаче, поэтому новая попытка заново вызывает loadModule.
  const [attempt, setAttempt] = useState(0);
  // Первый рендер рендерера — вход в приложение (F5/логин): страницу
  // не анимируем, только переключения после него. Флаг пишется
  // в эффекте, поэтому двойной рендер StrictMode читает одно и то же
  // значение и не «пережигает» первое переключение.
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);

  // Минимальное время показа загрузчика (демо-режим): смена модуля
  // сперва показывает fallback, контент — по истечении задержки.
  // shownId отстаёт от targetId только на задержку; чанк греется
  // сразу, поэтому задержка не добавляется к загрузке сверху.
  const loadingDelayMs = loadingDelay ?? 0;
  const [shownId, setShownId] = useState<string | null>(targetId);
  const holding = shownId !== targetId;
  // Задержка — только между показами модулей: первый показ
  // (вход в приложение: F5/логин, включая асинхронный resove
  // activeModule из null) идёт без загрузчика.
  const hasShown = useRef(false);
  useEffect(() => {
    if (shownId !== null) {
      hasShown.current = true;
    }
  }, [shownId]);
  useEffect(() => {
    if (!holding || targetId === null) {
      return;
    }
    if (loadingDelayMs <= 0 || !hasShown.current) {
      setShownId(targetId);
      return;
    }
    // Прогрев чанка: к концу задержки модуль уже в кешах Shell/lazy.
    void shell.loadModule(targetId).catch(() => {
      // Ошибка всплывёт через lazy при рендере модуля.
    });
    const timer = setTimeout(() => setShownId(targetId), loadingDelayMs);
    return () => clearTimeout(timer);
  }, [holding, targetId, loadingDelayMs, shell]);

  if (!isActive || targetId === null) {
    return <>{notFound ?? null}</>;
  }

  // Задержка загрузки — загрузчик вместо модуля (чанк уже греется).
  if (holding) {
    return <>{fallback ?? <DefaultLoading />}</>;
  }

  // Здесь shownId === targetId (holding выше вернул fallback), поэтому
  // идентичность компонента/ключа — от targetId.
  const enterVariant =
    pageTransition === undefined
      ? undefined
      : typeof pageTransition === "function"
        ? pageTransition(targetId)
        : pageTransition;
  // Смена модуля пересоздаёт boundary по ключу → обёртка монтируется
  // заново → CSS-анимация запускается сама, без ключей и state.
  const animate = enterVariant !== undefined && !firstRender.current;

  const ModuleComponent = getModuleComponent(shell, targetId);

  return (
    <Suspense fallback={fallback ?? <DefaultLoading />}>
      <ModuleErrorBoundary
        key={`${targetId}:${attempt}`}
        renderError={
          errorFallback ??
          ((error, retry) => <DefaultError error={error} retry={retry} />)
        }
        onRetry={() => setAttempt((a) => a + 1)}
      >
        {enterVariant === undefined ? (
          <ModuleComponent />
        ) : (
          <div data-page-enter={animate ? enterVariant : undefined}>
            <ModuleComponent />
          </div>
        )}
      </ModuleErrorBoundary>
    </Suspense>
  );
};
