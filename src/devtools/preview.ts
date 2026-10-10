import type { StatesDeclaration } from "../module/states";

/**
 * devtools/preview — общие хелперы офлайн-превью состояний:
 * плейсхолдеры динамических сегментов, путь превью состояния и
 * роли-вселенная декларации. Пользуются и каталог (StatesCatalog),
 * и оверлей (PreviewHost) — одна точка правды о демо-данных.
 */

/** Плейсхолдер-параметры динамических сегментов пути (:id → demo). */
export function demoParams(
  path: string | undefined,
): Readonly<Record<string, string>> | undefined {
  if (path === undefined) return undefined;
  const out: Record<string, string> = {};
  for (const seg of path.split("/")) {
    if (seg.startsWith(":")) out[seg.slice(1)] = "demo";
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Шаблон пути состояния превью: собственный path адресуемого или
 * host-путь внутреннего (внутреннее живёт на адресе host'а).
 */
export function statePath(
  declaration: StatesDeclaration<string, string, string>,
  stateId: string,
): string | undefined {
  const config = declaration.states[stateId];
  if (config === undefined) return undefined;
  if (config.path !== undefined) return config.path;
  const host = config.host;
  return host !== undefined ? declaration.states[host]?.path : undefined;
}

/**
 * Путь превью с плейсхолдерами (`:id` → demo) — затравка source-стаба
 * изолированной машины: первый sync уже резолвит целевое состояние,
 * без «мигающего» initial.
 */
export function demoPath(
  declaration: StatesDeclaration<string, string, string>,
  stateId: string,
): string {
  const template = statePath(declaration, stateId) ?? "/";
  const filled = template
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "demo" : seg))
    .join("/");
  return filled === "" ? "/" : filled;
}

/**
 * Роли-вселенная декларации: объединение access.roles состояний
 * («any» и отсутствие ограничения в универсум не попадают — роль
 * не discrimинирует). Источник чипов ролей превью.
 */
export function rolesUniverse(
  declaration: StatesDeclaration<string, string, string>,
): string[] {
  const roles = new Set<string>();
  for (const config of Object.values(declaration.states)) {
    const list = config.access?.roles;
    if (list !== undefined && list !== "any") {
      for (const role of list) roles.add(role);
    }
  }
  return [...roles];
}
