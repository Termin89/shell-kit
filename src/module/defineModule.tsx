import type { ComponentType, ReactNode } from "react";
import type {
  ModuleService,
  PageComponent,
  PageDefinition,
  PageVariant,
  ShellModule,
} from "./types";

export interface DefineModuleOptions<P extends object, S = undefined> {
  page: PageDefinition<P, S>;
  /**
   * Сервис модуля: id + сам сервис (диспетчер defineService). Instance
   * передаётся контроллеру страницы аргументом; типы сверяют связку
   * «контроллер ↔ сервис» на компиляции.
   */
  service?: ModuleService<S>;
}

const EMPTY_PROPS = {};

/**
 * Резолв вьюхи страницы. Единственный `component` — без резолва.
 * `variants` — первый подходящий по `when` (вариант без `when` матчится
 * всегда, дефолт обычно последний). Ни один не подошёл — предупреждение
 * и пустой рендер: это ошибка конфигурации. Suspense для lazy-вариантов
 * ловит внешний boundary (ModuleRenderer).
 */
function renderPage<P extends object>(
  component: PageComponent<P> | undefined,
  variants: PageVariant<P>[] | undefined,
  props: P,
): ReactNode {
  if (variants) {
    const variant = variants.find((v) => !v.when || v.when(props));
    if (!variant) {
      console.warn("[defineModule] ни один вариант вьюхи не подошёл по when");
      return null;
    }
    const View = variant.component;
    return <View {...props} />;
  }
  const View = component;
  return View ? <View {...props} /> : null;
}

/**
 * Собирает модуль из страницы (вьюха или варианты вьюх + контроллер)
 * и сервиса. Возвращает контракт ShellModule: `view` — для рендерера,
 * `component` — для частичного использования чистой вьюхи.
 *
 * Сервис передаётся контроллеру аргументом (не из замыкания): связка
 * декларативна — видна в module.ts и проверяется типами.
 *
 * ```tsx
 * // modules/Catalog/Catalog.tsx — единственная вьюха + сервис
 * export default defineModule({
 *   page: {
 *     component: CatalogPage,        // чистая вьюха на пропсах
 *     controller: useCatalogProps,   // (service: CatalogService) => Props
 *   },
 *   service: { id: "catalog", instance: catalogService },
 * });
 *
 * // Модуль без сервиса: контроллер без параметров
 * export default defineModule({
 *   page: { component: AboutPage, controller: useAboutProps },
 * });
 *
 * // modules/Report/Report.tsx — варианты вьюх одного контроллера:
 * // резолв по пропсам, каждый вариант — отдельный чанк
 * export default defineModule({
 *   page: {
 *     controller: useReportProps,
 *     variants: [
 *       {
 *         when: (p) => p.scope === "admin",
 *         component: lazy(() => import("./ReportFull")),
 *       },
 *       { component: lazy(() => import("./ReportLite")) }, // дефолт
 *     ],
 *   },
 * });
 * ```
 */
export function defineModule<P extends object, S = undefined>(
  options: DefineModuleOptions<P, S>,
): ShellModule<P> {
  const { component, controller, variants } = options.page;
  const service = options.service?.instance;

  // Две отдельные обёртки: контроллер — это хук, и его вызов не должен
  // быть условным ни статически, ни в рантайме.
  const view: ComponentType = controller
    ? function ModuleView() {
        return renderPage(component, variants, controller(service as S));
      }
    : function ModuleView() {
        return renderPage(component, variants, EMPTY_PROPS as P);
      };

  return { view, component, service: options.service };
}
