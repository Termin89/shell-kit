/**
 * Хуки Solid-адаптера: мост событийного ядра Shell → сигналы Solid 2.
 *
 * Идиоматика адаптера — getter-in / accessor-out: реактивные аргументы
 * принимаются функциями (компонент передаёт `() => value`, значения
 * коллапсируются на JSX-границе), возвращаются только аксессоры.
 *
 * Правило записей сигналов (Solid 2 запрещает запись в owned scope —
 * тела компонентов, compute-фазы): все записи живут в колбэках подписок
 * (ядро зовёт их вне owned scope), в `.then`-продолжениях, таймерах,
 * обработчиках и apply-фазе эффектов. Подписки регистрируются в
 * `onSettled` — возвращённая отписка становится cleanup'ом владельца.
 */

import {
  createEffect,
  createMemo,
  createSignal,
  onSettled,
  untrack,
  useContext,
} from "solid-js";
import type { Accessor } from "solid-js";
import type { Shell } from "../core/Shell";
import type { AppState, ShellStatus } from "../core/types";
import { peekMediaUrl, resolveMediaUrl } from "../storage/media";
import type { MediaRef } from "../storage/media";
import { ShellContext } from "./context";

/**
 * Доступ к экземпляру Shell. Вне <ShellProvider> useContext default-less
 * контекста кидает типизированную ContextNotFoundError — обёртка с
 * rethrow не нужна (каноника Solid 2).
 */
export function useShell(): Shell {
  return useContext(ShellContext);
}

/** Подписка на глобальное состояние приложения. */
export function useShellState(): Accessor<AppState> {
  const shell = useShell();
  // equals-по-ссылке: ядро в setState всегда даёт новый объект состояния,
  // ложных уведомлений нет; повторная запись той же ссылки — тихая.
  const [state, setState] = createSignal<AppState>(shell.getState(), {
    equals: (a, b) => a === b,
  });
  // Колбэк подписки ядро зовёт вне owned scope — запись легальна;
  // отписка, возвращённая из onSettled, сработает при dispose владельца.
  onSettled(() => shell.subscribe(setState));
  return state;
}

/**
 * Статус инициализации Shell: idle | bootstrapping | unauthenticated |
 * ready | error. Без shell.bootstrap(...) статус навсегда idle — хук
 * ничего не меняет.
 */
export function useShellStatus(): Accessor<ShellStatus> {
  const shell = useShell();
  const [status, setStatus] = createSignal<ShellStatus>(shell.getStatus());
  onSettled(() => shell.onStatusChange(setStatus));
  return status;
}

export interface ActiveModule {
  id: string;
  loaded: boolean;
}

/**
 * Активные модули в виде проекции `{ id, loaded }` — без внутренних
 * полей ядра (`exports`, `error`, `load`). В Solid нет каскадных
 * ререндеров от родителя, поэтому мемо реагирует и на смену состояния,
 * и на отдельное событие onModuleChange (например, активация модулей
 * при готовности bootstrap не меняет состояние).
 */
export function useActiveModules(): Accessor<ActiveModule[]> {
  const shell = useShell();
  const state = useShellState();
  const [version, bump] = createSignal(0, { equals: false });
  onSettled(() => {
    const offState = shell.subscribe(() => bump((v) => v + 1));
    const offModules = shell.onModuleChange(() => bump((v) => v + 1));
    return () => {
      offState();
      offModules();
    };
  });
  return createMemo(() => {
    version();
    state();
    return shell.getActiveModules().map(({ id, loaded }) => ({ id, loaded }));
  });
}

/**
 * MediaRef → URL для `<img src>`. Медиа лежит в IndexedDB (storage-слой),
 * objectURL кешируется на процесс — повторные монтирования не мерцают
 * и не текут (revoke только при delete/clear хранилища). Готовые
 * http(s)/data URL проходят насквозь синхронно, без storage.
 *
 * Аргумент — геттер (`useMedia(() => card.cover)`): значение читается
 * реактивно. `undefined()` — нормальное значение: пока картинка
 * догружается и для несуществующего id — вьюха решает, что показать.
 */
export function useMedia(
  media: () => MediaRef | undefined,
): Accessor<string | undefined> {
  // Начальное значение — синхронный peek в процессный кеш (паритет
  // с React-адаптером: закешированные картинки не мерцают). untrack —
  // чтение в теле компонента без подписки (тело — owner, не tracking
  // scope). Функцию в createSignal не передаём: в Solid 2 это форма
  // writable-memo, а не начальное значение.
  const [url, setUrl] = createSignal<string | undefined>(
    untrack(() => {
      const ref = media();
      return ref === undefined ? undefined : peekMediaUrl(ref);
    }),
  );
  createEffect(
    () => media(),
    (ref) => {
      if (ref === undefined) {
        setUrl(undefined);
        return;
      }
      const cached = peekMediaUrl(ref);
      if (cached !== undefined) {
        setUrl(cached);
        return;
      }
      let active = true;
      void resolveMediaUrl(ref).then((resolved) => {
        if (active) {
          setUrl(resolved);
        }
      });
      return () => {
        active = false;
      };
    },
  );
  return url;
}
