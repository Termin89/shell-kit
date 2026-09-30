import { useCallback, useContext, useSyncExternalStore } from "react";
import { RouterContext } from "./context";
import type { RouterPort } from "./port";

function useRouterPort(): RouterPort {
  const port = useContext(RouterContext);
  if (port === null) {
    throw new Error(
      "[router] хуки роутера требуют <RouterProvider port={...}> — см. src/router/readme.md",
    );
  }
  return port;
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
  return useCallback(
    (path: string, opts?: NavigateOptions) => {
      if (opts?.replace === true) {
        port.replace(path);
        return;
      }
      port.push(path);
    },
    [port],
  );
}

/**
 * usePath — полный текущий путь ("/partners/42", "/login").
 * Реактивен: push/replace и back дёргают ререндер. Для экранов вне
 * схемы модульных хвостов — прежде всего гейт-роуты (auth): экран
 * читает адрес сам, connectRouter его не резолвит (опция gate).
 */
export function usePath(): string {
  const port = useRouterPort();
  return useSyncExternalStore(
    (onStoreChange) => port.subscribe(onStoreChange),
    () => port.path,
  );
}

export interface ModuleRoute {
  /** Хвост после /<moduleId>: "" — корень модуля, "/post/x" — вложенный. */
  readonly path: string;
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
 * смонтирован — первый сегмент и есть его id). Реактивен: push/replace
 * и back дёргают подписчиков порта.
 *
 * @example
 * const route = useModuleRoute("feed")
 * const post = matchPath("/post/:postId", route.path)
 * const onOpenCard = (id: string) => route.navigate(`/post/${id}`)
 */
export function useModuleRoute(moduleId: string): ModuleRoute {
  const port = useRouterPort();
  const full = useSyncExternalStore(
    (onStoreChange) => port.subscribe(onStoreChange),
    () => port.path,
  );
  const base = `/${moduleId}`;
  const path =
    full === base || full.startsWith(`${base}/`) ? full.slice(base.length) : "";
  const navigate = useCallback(
    (tail: string, opts?: NavigateOptions) => {
      const full = `${base}${tail}`;
      if (opts?.replace === true) {
        port.replace(full);
        return;
      }
      port.push(full);
    },
    [port, base],
  );
  return { path, navigate };
}
