import { useShellState } from "shell-kit/react";
import type { AppState } from "shell-kit/core";

export const SCOPES = ["guest", "user", "admin"] as const;
export type Scope = (typeof SCOPES)[number];

/** Типизированное состояние демо: enabled-функции получают scope как union. */
export interface DemoState extends AppState {
  scope: Scope;
  /** Стартовый модуль — патчит bootstrap, layout читает из состояния. */
  entryModule?: string;
  /**
   * Реактивное зеркало флага mockFlags.orders: тумблер пишет и сюда,
   * и в services-конфиг — контроллер заказа перечитывает данные при
   * смене (reloadOn). Режим моков — допустимая категория shell state
   * (state.md), сам флаг диспетчера живёт в services-конфиге.
   */
  mockOrders: boolean;
}

// Сужение состояния демо (паттерн из core/state.md): хуки адаптера
// работают с базовым AppState, приложение типизирует одной обёрткой.
export const useDemoState = (): DemoState => useShellState() as DemoState;
