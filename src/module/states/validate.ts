import type { StatesDeclaration } from "./types";

/**
 * states/validate — чистая проверка декларации. Не бросает: машина
 * логирует проблемы `[module-states]` и продолжает best-effort —
 * сломанная декларация не должна ронять приложение, только жаловаться
 * в консоль разработчика.
 */

/** Типизированные коды проблем декларации. */
export type StatesIssueCode =
  | "UNKNOWN_HOST"
  | "DUP_PATH"
  | "PATH_AND_HOST_BOTH"
  | "NEITHER_PATH_NOR_HOST"
  | "INITIAL_NOT_ADDRESSABLE"
  | "SIGNAL_TARGET_UNKNOWN"
  | "FALLBACK_UNKNOWN"
  | "FALLBACK_NOT_ADDRESSABLE";

/** Одна проблема декларации: код + состояние + человекочитаемое описание. */
export interface StatesIssue {
  readonly code: StatesIssueCode;
  readonly state?: string;
  readonly message: string;
}

/** Проверяет декларацию и возвращает список проблем (пустой — всё чисто). */
export function validateStates(
  declaration: StatesDeclaration<string, string, string>,
): StatesIssue[] {
  const issues: StatesIssue[] = [];
  const states = declaration.states as Record<
    string,
    { path?: string; host?: string; signals?: Record<string, string>; access?: { fallback?: string } }
  >;
  const ids = Object.keys(states);
  const has = (id: string): boolean => Object.prototype.hasOwnProperty.call(states, id);
  const isAddressable = (id: string): boolean => has(id) && states[id].path !== undefined;
  const paths = new Map<string, string>();

  for (const id of ids) {
    const config = states[id];

    // path | host — ровно один
    if (config.path !== undefined && config.host !== undefined) {
      issues.push({
        code: "PATH_AND_HOST_BOTH",
        state: id,
        message: `состояние «${id}» объявляет и path («${config.path}»), и host («${config.host}») — адресуемым или внутренним может быть только одним`,
      });
    } else if (config.path === undefined && config.host === undefined) {
      issues.push({
        code: "NEITHER_PATH_NOR_HOST",
        state: id,
        message: `состояние «${id}» без path и host — объявите адресуемое (path) или внутреннее (host)`,
      });
    }

    // дубликаты путей
    if (config.path !== undefined) {
      const owner = paths.get(config.path);
      if (owner !== undefined) {
        issues.push({
          code: "DUP_PATH",
          state: id,
          message: `путь «${config.path}» объявлен и в «${owner}», и в «${id}» — адрес однозначен`,
        });
      } else {
        paths.set(config.path, id);
      }
    }

    // host существует и адресуемый
    if (config.host !== undefined && !isAddressable(config.host)) {
      issues.push({
        code: "UNKNOWN_HOST",
        state: id,
        message:
          has(config.host)
            ? `host «${config.host}» состояния «${id}» не адресуемый — внутреннее живёт на пути host'а, у host'а должен быть path`
            : `host «${config.host}» состояния «${id}» не найден в декларации`,
      });
    }

    // цели сигналов существуют
    const signals = config.signals ?? {};
    for (const [signal, target] of Object.entries(signals)) {
      if (!has(target)) {
        issues.push({
          code: "SIGNAL_TARGET_UNKNOWN",
          state: id,
          message: `сигнал «${signal}» состояния «${id}» ведёт в неизвестное состояние «${target}»`,
        });
      }
    }

    // fallback существует и адресуемый (запрос заменяется на его путь)
    const fallback = config.access?.fallback;
    if (fallback !== undefined) {
      if (!has(fallback)) {
        issues.push({
          code: "FALLBACK_UNKNOWN",
          state: id,
          message: `fallback «${fallback}» состояния «${id}» не найден в декларации`,
        });
      } else if (!isAddressable(fallback)) {
        issues.push({
          code: "FALLBACK_NOT_ADDRESSABLE",
          state: id,
          message: `fallback «${fallback}» состояния «${id}» не адресуемый — запрет заменяется replace'ом на путь fallback'а`,
        });
      }
    }
  }

  // initial адресуемый: без deep-link машина отправляет на его путь
  if (!isAddressable(declaration.initial)) {
    issues.push({
      code: "INITIAL_NOT_ADDRESSABLE",
      state: declaration.initial,
      message: `initial «${declaration.initial}» должен быть адресуемым (иметь path)`,
    });
  }

  // цели глобальных сигналов
  const globalSignals = declaration.signals ?? {};
  for (const [signal, target] of Object.entries(globalSignals)) {
    if (target !== undefined && !has(target)) {
      issues.push({
        code: "SIGNAL_TARGET_UNKNOWN",
        message: `глобальный сигнал «${signal}» ведёт в неизвестное состояние «${target}»`,
      });
    }
  }

  return issues;
}

/** Логирует проблемы декларации в консоль (префикс слоя). */
export function logStatesIssues(issues: readonly StatesIssue[]): void {
  for (const issue of issues) {
    console.error(`[module-states] ${issue.code}: ${issue.message}`);
  }
}
