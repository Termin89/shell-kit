import type { RouterPort } from "./port";

/**
 * createBrowserHistory — адаптер History API: путь = pathname адресной
 * строки. push/replace пишут историю и уведомляют подписчиков сами
 * (popstate на программную запись не приходит), back() — штатный шаг
 * назад браузера. Слушатель popstate живёт всё время адаптера: адаптер
 * создаётся один раз на приложение (connectRouter), отписка снимает
 * только колбэк.
 *
 * basename — префикс приложения в адресной строке, когда оно хостится
 * не в корне домена (например /partner-portal на демо-стенде). Снаружи
 * порт работает с путями без префикса (/overview), в URL пишет
 * basename + path. По умолчанию "" — прежнее поведение в корне.
 * Удобно передавать import.meta.env.BASE_URL сборки Vite.
 */
export function createBrowserHistory(basename = ""): RouterPort {
  // нормализация: "/x/" и "/x" → "/x", "/" и "" → ""
  const base =
    basename && basename !== "/"
      ? "/" + basename.split("/").filter(Boolean).join("/")
      : "";
  const toUrl = (path: string): string => base + path;
  const toAppPath = (pathname: string): string => {
    const stripped = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
    return stripped || "/";
  };
  const listeners = new Set<(path: string) => void>();
  const notify = (): void => {
    const path = toAppPath(window.location.pathname);
    listeners.forEach((cb) => cb(path));
  };
  window.addEventListener("popstate", notify);
  return {
    get path() {
      return toAppPath(window.location.pathname);
    },
    push(path) {
      window.history.pushState(null, "", toUrl(path));
      notify();
    },
    replace(path) {
      window.history.replaceState(null, "", toUrl(path));
      notify();
    },
    back() {
      window.history.back();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/**
 * createMemoryHistory — история в памяти: адресная строка не трогается.
 * Это режим «роутер выключен» для конфига приложения: петля
 * синхронизации и хуки работают как с браузерной историей, но URL
 * остаётся прежним (F5 и deep-links не работают — как без роутера).
 * Также пригодится в тестах и сторибуке.
 */
export function createMemoryHistory(initial = "/"): RouterPort {
  let stack: string[] = [initial];
  let index = 0;
  const listeners = new Set<(path: string) => void>();
  const current = (): string => stack[index];
  const notify = (): void => {
    const path = current();
    listeners.forEach((cb) => cb(path));
  };
  return {
    get path() {
      return current();
    },
    push(path) {
      stack = [...stack.slice(0, index + 1), path];
      index = stack.length - 1;
      notify();
    },
    replace(path) {
      stack[index] = path;
      notify();
    },
    back() {
      if (index > 0) {
        index -= 1;
        notify();
      }
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
