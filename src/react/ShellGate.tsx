import type { ReactNode } from "react";
import { useShell, useShellStatus } from "./hooks";

export interface ShellGateProps {
  /** Что показывать, пока идёт инициализация (bootstrapping). */
  fallback?: ReactNode;
  /** Рендер-проп ошибки инициализации: (error, retry). */
  error?: (error: Error, retry: () => void) => ReactNode;
  /**
   * Рендер-проп статуса unauthenticated: (retry). Retry — после
   * успешного логина, он прогоняет bootstrap заново.
   */
  unauthenticated?: (retry: () => void) => ReactNode;
  children: ReactNode;
}

const DefaultFallback = () => (
  <div role="status">Инициализация приложения…</div>
);

const DefaultError = ({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) => (
  <div role="alert">
    <p>Не удалось инициализировать приложение: {error.message}</p>
    <button type="button" onClick={retry}>
      Повторить
    </button>
  </div>
);

const DefaultUnauthenticated = ({ retry }: { retry: () => void }) => (
  <div role="alert">
    <p>Требуется вход в систему</p>
    <button type="button" onClick={retry}>
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
export function ShellGate({
  fallback,
  error,
  unauthenticated,
  children,
}: ShellGateProps) {
  const shell = useShell();
  const status = useShellStatus();

  if (status === "bootstrapping") {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  if (status === "unauthenticated") {
    const renderAuth =
      unauthenticated ?? ((retry) => <DefaultUnauthenticated retry={retry} />);
    return <>{renderAuth(shell.retryBootstrap.bind(shell))}</>;
  }

  if (status === "error") {
    const renderError =
      error ?? ((err, retry) => <DefaultError error={err} retry={retry} />);
    return (
      <>
        {renderError(
          shell.getBootstrapError() ??
            new Error("Инициализация завершилась с ошибкой"),
          shell.retryBootstrap.bind(shell),
        )}
      </>
    );
  }

  return <>{children}</>;
}
