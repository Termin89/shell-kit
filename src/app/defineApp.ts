import { Shell } from "../core";
import type { AppState, ModuleConfig } from "../core";
import {
  connectRouter,
  createBrowserHistory,
  createMemoryHistory,
} from "../router";
import { configureStorage } from "../storage";
import { createAppRoot } from "./Root";
import type { AppDefinition, AppHandle, AppInstance } from "./types";

/**
 * defineApp — фабрика приложения: декларация превращается в
 * собранный инстанс, порядок сборки запечён здесь, а не в памяти
 * разработчика каждого проекта:
 *
 *   1. configureStorage — идентичность LS/IDB до всего, что пишет;
 *   2. dev.beforeBootstrap — override стратегий до первого
 *      обращения к сервисам;
 *   3. new Shell — реестр модулей (мета стрипается: Shell про неё
 *      не знает) + services-контекст;
 *   4. connectRouter — до bootstrap: deep-link применяется к
 *      состоянию до резолва сессии;
 *   5. errors-хук — подписка на шину строго до bootstrap: ни один
 *      запрос не проходит мимо;
 *   6. shell.bootstrap — восстановление сессии (не задан init —
 *      шаг пропускается, гейт прозрачен).
 *
 * Выход: { definition, shell, router, port, Root }. Инстанс — для
 * каркаса и dev-тул (useApp), не сервис-локатор: модули приложения
 * его не импортируют (граница — readme.md).
 */
export function defineApp<S extends AppState = AppState, M = unknown>(
  definition: AppDefinition<S, M>,
): AppInstance<S, M> {
  configureStorage({ project: definition.project });

  definition.dev?.beforeBootstrap?.();

  // Мета модулей — принадлежность app-слоя: в реестр Shell идут
  // только поля ModuleConfig.
  const modules: ModuleConfig<S>[] = definition.modules.map((entry) => ({
    id: entry.id,
    load: entry.load,
    enabled: entry.enabled,
    preload: entry.preload,
  }));

  const shell = new Shell<S>({
    initialState: definition.state ?? ({ activeModule: null } as S),
    modules,
    services: definition.services,
  });

  const router = definition.router;
  const connection = connectRouter(
    shell,
    router?.mode === "memory"
      ? createMemoryHistory()
      : createBrowserHistory(router?.basename),
    { gate: router?.gate },
  );

  const handle: AppHandle<S, M> = {
    definition,
    shell,
    router: connection,
    port: connection.port,
  };

  // Хук ошибок — до bootstrap (шаг 5): хендлер видит собранный
  // дескриптор (shell + port), подписка успевает до первого запроса.
  definition.errors?.(handle);

  if (definition.bootstrap !== undefined) {
    shell.bootstrap(definition.bootstrap);
  }

  return { ...handle, Root: createAppRoot(handle) };
}
