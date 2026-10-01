import { Match, Switch } from "solid-js";
import type { JSX } from "@solidjs/web";
import { useShell, useShellStatus } from "./hooks";

export interface ShellGateProps {
  /** Что показывать, пока идёт инициализация (bootstrapping). */
  fallback?: JSX.Element;
  /** Рендер-проп ошибки инициализации: (error, retry). */
  error?: (error: Error, retry: () => void) => JSX.Element;
  /**
   * Рендер-проп статуса unauthenticated: (retry). Retry — после
   * успешного логина, он прогоняет bootstrap заново.
   */
  unauthenticated?: (retry: () => void) => JSX.Element;
  children: JSX.Element;
}

const DefaultFallback = (): JSX.Element => (
  <div role="status">Инициализация приложения…</div>
);

const DefaultError = (props: { error: Error; retry: () => void }): JSX.Element => (
  <div role="alert">
    <p>Не удалось инициализировать приложение: {props.error.message}</p>
    <button type="button" onClick={props.retry}>
      Повторить
    </button>
  </div>
);

const DefaultUnauthenticated = (props: {
  retry: () => void;
}): JSX.Element => (
  <div role="alert">
    <p>Требуется вход в систему</p>
    <button type="button" onClick={props.retry}>
      Войти
    </button>
  </div>
);

/**
 * Ворота инициализации: пока shell бутстрапится — fallback, при
 * отсутствии сессии (unauthenticated) — auth-слот, при ошибке —
 * error-рендер с retry, иначе (idle / ready) — дети.
 * Если приложение не использует bootstrap, гейт прозрачен.
 */
export function ShellGate(props: ShellGateProps): JSX.Element {
  const shell = useShell();
  const status = useShellStatus();
  // Ошибка bootstrap — не реактивное значение: ядро хранит её рядом
  // со статусом, ветка рендерится при переходе в error.
  const bootstrapError = (): Error =>
    shell.getBootstrapError() ??
    new Error("Инициализация завершилась с ошибкой");
  const retry = (): void => {
    shell.retryBootstrap();
  };

  return (
    <Switch fallback={props.children}>
      <Match when={status() === "bootstrapping"}>
        {props.fallback ?? <DefaultFallback />}
      </Match>
      <Match when={status() === "unauthenticated"}>
        {props.unauthenticated ? (
          props.unauthenticated(retry)
        ) : (
          <DefaultUnauthenticated retry={retry} />
        )}
      </Match>
      <Match when={status() === "error"}>
        {props.error ? (
          props.error(bootstrapError(), retry)
        ) : (
          <DefaultError error={bootstrapError()} retry={retry} />
        )}
      </Match>
    </Switch>
  );
}
