// oxlint-disable react/only-export-components
// (fast-refresh — React-инструмент; для Solid провайдер + хуки в одном
// файле идиоматичны, слой плоский по решению из PLAN.md)
/**
 * Связки router-слоя для Solid: провайдер RouterPort + хуки.
 * Framework-free часть (RouterPort, matchPath, история, петля
 * connectRouter) живёт в `src/router` и переиспользуется as-is —
 * реэкспортируется из `shell-kit/solid`.
 */

import {
  createContext,
  createMemo,
  createSignal,
  onSettled,
  useContext,
} from "solid-js";
import type { Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { RouterPort } from "../router/port";

// Контекст default-less (каноника Solid 2): сам является провайдером,
// useContext вне <RouterProvider> кидает типизированную ошибку.
export const RouterContext = createContext<RouterPort>();

export interface RouterProviderProps {
  /** Порт из connectRouter(...) или свой адаптер RouterPort. */
  port: RouterPort;
  children: JSX.Element;
}

export function RouterProvider(props: RouterProviderProps): JSX.Element {
  return <RouterContext value={props.port}>{props.children}</RouterContext>;
}

function useRouterPort(): RouterPort {
  return useContext(RouterContext);
}

/** Порт целиком (back/replace) — для контроллеров вне схемы хвоста. */
export function useRouter(): RouterPort {
  return useRouterPort();
}

/** Опции перехода: replace — заменить запись истории вместо push. */
export interface NavigateOptions {
  readonly replace?: boolean;
}

/**
 * useNavigate — переход по полному пути ("/partners/42"). Про shell
 * не знает: модуль переключит петля connectRouter (URL → activeModule),
 * единая точка правды — URL.
 */
export function useNavigate(): (path: string, opts?: NavigateOptions) => void {
  const port = useRouterPort();
  return (path, opts) => {
    if (opts?.replace === true) {
      port.replace(path);
      return;
    }
    port.push(path);
  };
}

/**
 * usePath — полный текущий путь ("/partners/42", "/login").
 * Реактивен: push/replace и popstate дёргают подписчиков порта —
 * колбэк приходит из event listener'а, вне owned scope.
 */
export function usePath(): Accessor<string> {
  const port = useRouterPort();
  const [path, setPath] = createSignal(port.path);
  onSettled(() => port.subscribe(setPath));
  return path;
}

export interface ModuleRoute {
  /** Хвост после /<moduleId>: "" — корень модуля, "/post/x" — вложенный. */
  readonly path: Accessor<string>;
  /**
   * Переход внутри модуля: navigate("/post/x") → /<moduleId>/post/x.
   * replace — канонизация адреса без записи в историю (например,
   * ссылка-инструкция «чат с человеком» → реальный id чата).
   */
  readonly navigate: (tail: string, opts?: NavigateOptions) => void;
}

/**
 * useModuleRoute — маршрут активного модуля: хвост после первого
 * сегмента URL. Вызывается в контроллере своего модуля (модуль
 * смонтирован — первый сегмент и есть его id). Реактивен.
 *
 * @example
 * const route = useModuleRoute("feed")
 * const post = matchPath("/post/:postId", route.path())
 * const onOpenCard = (id: string) => route.navigate(`/post/${id}`)
 */
export function useModuleRoute(moduleId: string): ModuleRoute {
  const port = useRouterPort();
  const path = usePath();
  const base = `/${moduleId}`;
  const tail = createMemo(() => {
    const full = path();
    return full === base || full.startsWith(`${base}/`)
      ? full.slice(base.length)
      : "";
  });
  const navigate = (tailPath: string, opts?: NavigateOptions): void => {
    const full = `${base}${tailPath}`;
    if (opts?.replace === true) {
      port.replace(full);
      return;
    }
    port.push(full);
  };
  return { path: tail, navigate };
}
