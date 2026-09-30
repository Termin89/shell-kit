/**
 * bus — глобальная шина ошибок приложения.
 *
 * Любой источник (transport, сервис, хук) может эмитить ошибку через
 * `errorBus.emit(err)`. Шина классифицирует её и раздаёт подписанным
 * хендлерам по фильтру `handles: Set<ErrorKind>`.
 *
 * Подписка хендлеров идёт один раз на старте приложения (в `App.tsx` или
 * специализированном `error-handling/setup.ts`). Хук `useServiceQuery`
 * эмитит ошибки сюда автоматически — потребителю не нужно делать это явно.
 *
 * @see classifier.ts — `classifyError()` используется внутри emit
 * @see handlers.ts — стандартные хендлеры (authHandler, toastHandler, ...)
 */

import { type ClassifiedError, classifyError, type ErrorKind } from "./classifier";

/** Подписка на шину; возвращает функцию отписки. */
export type Unsubscribe = () => void;

/**
 * ErrorHandler — реакция на подмножество видов ошибок.
 *
 * `handles` — фильтр: хендлер получит только ошибки с matching kind.
 * `undefined` или пустое множество = подписка на все виды.
 */
export interface ErrorHandler {
  readonly id: string;
  readonly handles?: ReadonlySet<ErrorKind>;
  handle(error: ClassifiedError): void;
}

/**
 * Синхронная шина: emit сразу классифицирует и вызывает хендлеров.
 *
 * Синхронность намеренная: ошибки должны обрабатываться в том же тике,
 * чтобы реакция (редирект на 401, toast на validation) шла до любых
 * побочных эффектов.
 */
export interface ErrorBus {
  /** Классифицировать и разнести подписчикам. */
  emit(error: unknown): void;
  /** Подписаться; возвращает отписку. */
  subscribe(handler: ErrorHandler): Unsubscribe;
  /** Последняя классифицированная ошибка (для дебага и UI-баннера). */
  readonly last: ClassifiedError | undefined;
}

/**
 * Module-private реализация шины. Экспортируется только singleton
 * `errorBus` с типом-интерфейсом `ErrorBus` — потребитель не должен
 * знать о классе.
 */
class _ErrorBusImpl implements ErrorBus {
  private readonly _handlers = new Map<string, ErrorHandler>();
  private _last: ClassifiedError | undefined;

  emit(error: unknown): void {
    const classified = classifyError(error);
    this._last = classified;
    for (const handler of this._handlers.values()) {
      const kinds = handler.handles;
      if (
        kinds === undefined ||
        kinds.size === 0 ||
        kinds.has(classified.kind)
      ) {
        try {
          handler.handle(classified);
        } catch (handlerError) {
          // Хендлер не должен иметь возможности сломать шину.
          console.error("[errorBus] handler threw:", handlerError);
        }
      }
    }
  }

  subscribe(handler: ErrorHandler): Unsubscribe {
    if (this._handlers.has(handler.id)) {
      console.warn(
        `[errorBus] handler "${handler.id}" already subscribed — replaced`,
      );
    }
    this._handlers.set(handler.id, handler);
    return () => {
      this._handlers.delete(handler.id);
    };
  }

  get last(): ClassifiedError | undefined {
    return this._last;
  }
}

/** Singleton шины. Импортируется всеми источниками и хендлерами ошибок. */
export const errorBus: ErrorBus = new _ErrorBusImpl();
