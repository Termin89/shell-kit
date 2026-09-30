/**
 * configureQuery — точка переключения query-движка.
 *
 * Один раз на старте приложения (в `main.tsx`) вызывается
 * `configureQuery(new SelfRolledAdapter())`. После этого `useServiceQuery`
 * и `useServiceMutation` работают через выбранный адаптер.
 *
 * Если `configureQuery` не был вызван — используется адаптер по умолчанию
 * (`SelfRolledAdapter`). Это позволяет не трогать точку входа, пока явная
 * конфигурация не понадобится.
 *
 * Замена адаптера в рантайме поддерживается, но **не рекомендуется**: уже
 * смонтированные компоненты держат ссылки на старый сторадж до следующего
 * рендра. План: всегда конфигурировать до первого `createRoot.render()`.
 *
 * @see SelfRolledAdapter.ts — адаптер по умолчанию
 */

import type { QueryPort } from "./QueryPort";
import { SelfRolledAdapter } from "./SelfRolledAdapter";

/** Текущий query-порт. Module-private — меняется только через configureQuery(). */
let _currentPort: QueryPort = new SelfRolledAdapter();

/** Был ли явный вызов configureQuery() — чтобы отличить настройку от замены. */
let _isConfigured = false;

/**
 * Установить глобальный query-порт. Вызывается один раз при старте приложения.
 *
 * ```ts
 * // main.tsx, до createRoot.render()
 * configureQuery(new SelfRolledAdapter());
 * // или, в будущем:
 * // configureQuery(new TanStackAdapter(queryClient));
 * ```
 */
export function configureQuery(port: QueryPort): void {
  if (_isConfigured) {
    console.warn(
      "[configureQuery] query port replaced at runtime — уже смонтированные " +
        "компоненты держат старый сторадж до следующего рендера",
    );
  }
  _isConfigured = true;
  _currentPort = port;
}

/** Получить текущий query-порт. Используется хуками. */
export function getQueryPort(): QueryPort {
  return _currentPort;
}
