import { useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Shell } from "../core/Shell";
import type { AppState, ShellStatus } from "../core/types";
import { peekMediaUrl, resolveMediaUrl, type MediaRef } from "../storage";
import { ShellContext } from "./context";

/** Доступ к экземпляру Shell. */
export function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (!shell) {
    throw new Error("Shell hooks must be used within <ShellProvider>");
  }
  return shell;
}

/** Подписка на глобальное состояние приложения. */
export function useShellState(): AppState {
  const shell = useShell();
  const subscribe = useMemo(() => shell.subscribe.bind(shell), [shell]);
  const getSnapshot = useMemo(() => shell.getState.bind(shell), [shell]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Статус инициализации Shell: idle | bootstrapping | ready | error.
 * Без shell.bootstrap(...) статус навсегда idle — хук ничего не меняет.
 */
export function useShellStatus(): ShellStatus {
  const shell = useShell();
  const subscribe = useMemo(() => shell.onStatusChange.bind(shell), [shell]);
  const getSnapshot = useMemo(() => shell.getStatus.bind(shell), [shell]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export interface ActiveModule {
  id: string;
  loaded: boolean;
}

/**
 * Активные модули. Подписка на состояние делает список реактивным:
 * активность модулей пересчитывается ядром при каждом setState.
 */
export function useActiveModules(): ActiveModule[] {
  const shell = useShell();
  useShellState();
  return shell.getActiveModules().map(({ id, loaded }) => ({ id, loaded }));
}

/**
 * MediaRef → URL для `<img src>`. Медиа лежит в IndexedDB (storage-слой),
 * objectURL кешируется на процесс — повторные монтирования не мерцают
 * и не текут (revoke только при delete/clear хранилища). Готовые
 * http(s)/data URL проходят насквозь синхронно, без storage.
 *
 * `undefined` на первом рендере (если URL ещё не в кеше) и для
 * несуществующего id — картинки догружаются кадром позже.
 */
export function useMedia(media: MediaRef | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() =>
    media === undefined ? undefined : peekMediaUrl(media),
  );

  useEffect(() => {
    let active = true;
    if (media === undefined) {
      setUrl(undefined);
      return;
    }
    const cached = peekMediaUrl(media);
    if (cached !== undefined) {
      setUrl(cached);
      return;
    }
    void resolveMediaUrl(media).then((resolved) => {
      if (active) {
        setUrl(resolved);
      }
    });
    return () => {
      active = false;
    };
  }, [media]);

  return url;
}
