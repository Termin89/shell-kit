/**
 * port — контракт истории адресов + мини-матчер путей.
 *
 * Это единственная точка подмены технологии: пока у библиотеки есть
 * push/replace/back и подписка на изменение адреса, она портируется
 * в RouterPort адаптером на ~10 строк (пример — readme.md), а петля
 * синхронизации, хуки и модули остаются нетронутыми.
 */

export interface RouterPort {
  /** Текущий путь (pathname, без query). */
  readonly path: string;
  /** Записать путь в историю и уведомить подписчиков. */
  push(path: string): void;
  /** Заменить текущую запись истории (без новой точки назад). */
  replace(path: string): void;
  /** Шаг назад по истории (браузерная кнопка «назад»). */
  back(): void;
  /** Подписка на изменение пути; отписка — возвращаемая функция. */
  subscribe(cb: (path: string) => void): () => void;
}

/** Результат сопоставления пути с шаблоном. */
export interface RouteMatch {
  readonly params: Readonly<Record<string, string>>;
}

const segments = (value: string): string[] =>
  value.split("?")[0].split("/").filter((s) => s !== "");

const decode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Мини-матчер: сегменты «/»-путей, `:name` захватывает сегмент в
 * params, `*` — хвост целиком (ключ `"*"`). Сопоставление полное:
 * лишние сегменты в path — null. Query-часть игнорируется.
 *
 * @example
 * matchPath("/post/:id", "/post/roofs")  // { params: { id: "roofs" } }
 * matchPath("/post/:id", "/post")        // null
 * matchPath("/*", "/a/b")                // { params: { "*": "a/b" } }
 */
export function matchPath(pattern: string, path: string): RouteMatch | null {
  const p = segments(pattern);
  const s = segments(path);
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i];
    if (seg === "*") {
      params["*"] = s.slice(i).map(decode).join("/");
      return { params };
    }
    if (i >= s.length) {
      return null;
    }
    if (seg.startsWith(":")) {
      params[seg.slice(1)] = decode(s[i]);
    } else if (seg !== s[i]) {
      return null;
    }
  }
  return s.length === p.length ? { params } : null;
}
