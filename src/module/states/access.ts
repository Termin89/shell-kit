import type { StatesDeclaration } from "./types";

/**
 * states/access — статическая проекция навигационного доступа по
 * декларации: чистые функции без машины и роутера. Роли против
 * access.roles («any» и отсутствие ограничения — всем), рантайм-
 * guard не проецируется — тулы показывают его маркером.
 *
 * Потребители: machine.accessProjection (одна точка правды) и
 * devtools (офлайн-каталог состояний без живой машины).
 */

/**
 * Статическая матрица «роль-набор → состояние»: true, если состояние
 * доступно набору ролей (нет ограничения, «any» или пересечение).
 * guard не проецируется (ему нужны params/query живого адреса) —
 * его наличие показывает hasRuntimeGuard.
 */
export function projectAccess(
  declaration: StatesDeclaration<string, string, string>,
  roles: readonly string[],
): Record<string, boolean> {
  const projection: Record<string, boolean> = {};
  for (const [id, config] of Object.entries(declaration.states)) {
    const access = config.access;
    projection[id] =
      access?.roles === undefined ||
      access.roles === "any" ||
      access.roles.some((role) => roles.includes(role));
  }
  return projection;
}

/** Есть ли у состояния рантайм-guard (доступ решается не только ролями). */
export function hasRuntimeGuard(
  declaration: StatesDeclaration<string, string, string>,
  id: string,
): boolean {
  return declaration.states[id]?.access?.guard !== undefined;
}
