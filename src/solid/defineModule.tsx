/**
 * defineModule — Solid-редакция контракта модуля. Контракт дублируется
 * от React-версии (src/module) локальными типами: импорт оттуда потянул
 * бы react в solid-дист. Семантический паритет (вьюха/варианты/
 * контроллер/сервис), отличие — механика контроллера: в Solid это не
 * хук, а setup-функция (вызов ровно один раз в owned scope).
 */

import { createMemo, Show } from "solid-js";
import type { Component } from "solid-js";
import type { JSX } from "@solidjs/web";

// ----- Типы (локальные: без react-импортов) -----

/**
 * Чистая вьюха страницы: только презентация на семантических токенах
 * (design system). Никаких сервисов, API и бизнес-логики — только пропсы.
 * Может переиспользоваться с другим контроллером (частичное использование
 * модуля).
 *
 * Ограничение `Record<string, any>` — constraint `Component` из solid-js
 * (вместо `object` в React-версии): интерфейсы пропсов проходят без
 * индексных сигнатур.
 */
export type PageComponent<P extends Record<string, any> = Record<string, any>> =
  Component<P>;

/**
 * Контроллер страницы — бизнес-часть. Это setup-функция Solid: вызывается
 * ровно один раз в теле собранной вьюхи (owned scope — можно звать
 * `useModuleRoute`/`useServiceQuery`, создавать мемо и сигналы),
 * подключает сервисы и shell-состояние, отдаёт пропсы для PageComponent.
 *
 * Реактивные значения в пропсах — аксессорами (getter-in / accessor-out —
 * канон слоя): вьюха читает `props.x()`, `when`-предикаты вариантов тоже
 * читают аксессоры — резолв варианта реактивен. Запись сигналов в теле
 * контроллера запрещена (owned/compute scope) — записи живут в
 * колбэках, `.then`-продолжениях и apply-фазе эффектов.
 *
 * Сервис контроллер получает **аргументом от модуля** (registration
 * в `defineModule`), а не из замыкания: связка «контроллер ↔ сервис»
 * видна в module.ts и проверяется типами. Модуль без сервиса
 * объявляет контроллер без параметров — `() => P`.
 *
 * @typeParam P — пропсы для PageComponent (возврат контроллера).
 * @typeParam S — контракт сервиса, который модуль передаёт контроллеру.
 */
export type PageController<P, S = undefined> = (service: S) => P;

/** Вариант вьюхи: компонент + опциональный предикат на пропсах. */
export interface PageVariant<P extends Record<string, any>> {
  /**
   * Предикат на пропсах контроллера — резолв варианта по состоянию
   * происходит через пропсы, состояние напрямую модуль не читает.
   * Читает аксессоры → смена условия реактивно пересобирает вариант.
   * Вариант без `when` матчится всегда — это дефолт, его обычно ставят
   * последним. Перебор по порядку, побеждает первый подходящий.
   */
  when?: (props: P) => boolean;
  component: PageComponent<P>;
}

/** Страница с единственной вьюхой. */
export interface SinglePage<P extends Record<string, any>, S = undefined> {
  component: PageComponent<P>;
  controller?: PageController<P, S>;
  variants?: never;
}

/** Страница с вариантами вьюх одного контроллера. */
export interface VariantsPage<P extends Record<string, any>, S = undefined> {
  component?: never;
  controller?: PageController<P, S>;
  variants: PageVariant<P>[];
}

/**
 * Страница: чистая вьюха (или варианты вьюх) + опциональный контроллер.
 * `component` и `variants` взаимоисключительны — на уровне типов.
 */
export type PageDefinition<P extends Record<string, any>, S = undefined> =
  | SinglePage<P, S>
  | VariantsPage<P, S>;

/**
 * Сервис модуля — регистрация доменного сервиса (обычно диспетчер
 * `defineService`) в контракте модуля. `instance` получает контроллер
 * страницы; `id` — для shell-инфраструктуры (mock-service, логи)
 * и совпадает с id диспетчера.
 */
export interface ModuleService<S = unknown> {
  readonly id: string;
  /** Сам сервис — его модуль передаёт контроллеру страницы. */
  readonly instance: S;
}

/**
 * Модуль — независимое мини-приложение. Это то, что возвращает `load()`
 * из ModuleConfig: ядро регистрирует модуль, Solid-адаптер рендерит `view`.
 */
export interface ShellModule<P extends Record<string, any> = Record<string, any>> {
  /**
   * Конечная собранная вьюха модуля (контроллер + компонент).
   * Её рендерит ModuleRenderer (module-lazy резолвит `default.view`).
   */
  view: Component;
  /**
   * Чистая вьюха без бизнес-привязок — для частичного использования
   * модуля (встроить вьюху в другой композиции, подставив свой контроллер).
   */
  component?: PageComponent<P>;
  /**
   * Сервис модуля (registration: id + instance). Доступен самому модулю
   * и shell-инфраструктуре (mock-service), но не другим модулям —
   * иначе появятся связи.
   */
  service?: ModuleService;
}

// ----- defineModule -----

export interface DefineModuleOptions<
  P extends Record<string, any>,
  S = undefined,
> {
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
 * всегда, дефолт обычно последний); поиск — в `createMemo`: `when(props)`
 * читает аксессоры пропсов, смена условий реактивно пересчитывает
 * вариант. Рендер — keyed `<Show>` по identity варианта: смена варианта
 * пересоздаёт поддерево (паритет с React, где пересоздаётся элемент),
 * lazy-вариант грузит свой чанк.
 *
 * Ни один не подошёл — предупреждение и пустой рендер: это ошибка
 * конфигурации. В отличие от React, warn срабатывает на изменение
 * исхода резолва (пересчёт мемо), а не на каждый рендер — меньше шума,
 * осознанное отличие. Suspense для lazy-вариантов ловит внешний
 * boundary (ModuleRenderer: `<Loading>`/`<Errored>`).
 */
function renderPage<P extends Record<string, any>>(
  component: PageComponent<P> | undefined,
  variants: PageVariant<P>[] | undefined,
  props: P,
): JSX.Element {
  if (variants) {
    const variant = createMemo(() => {
      const found = variants.find((v) => !v.when || v.when(props));
      if (!found) {
        console.warn("[defineModule] ни один вариант вьюхи не подошёл по when");
      }
      return found;
    });
    return (
      <Show when={variant()} keyed>
        {(v: PageVariant<P>): JSX.Element => {
          const View = v.component;
          return <View {...props} />;
        }}
      </Show>
    );
  }
  const View = component;
  return View ? <View {...props} /> : null;
}

/**
 * Собирает модуль из страницы (вьюха или варианты вьюх + контроллер)
 * и сервиса. Возвращает контракт ShellModule: `view` — для рендерера
 * (module-lazy берёт `default.view`), `component` — для частичного
 * использования чистой вьюхи.
 *
 * Контроллер — setup-функция: вызывается ровно один раз в теле
 * собранной вьюхи (owned scope). Сервис передаётся контроллеру
 * аргументом (не из замыкания): связка декларативна — видна в module.ts
 * и проверяется типами.
 *
 * ```tsx
 * // modules/Catalog/catalog.tsx — единственная вьюха + сервис
 * export default defineModule({
 *   page: {
 *     component: CatalogPage,        // чистая вьюха на пропсах
 *     controller: setupCatalogProps, // (service: CatalogService) => Props
 *   },
 *   service: { id: "catalog", instance: catalogService },
 * });
 *
 * // Модуль без сервиса: контроллер без параметров
 * export default defineModule({
 *   page: { component: AboutPage, controller: setupAboutProps },
 * });
 *
 * // modules/Report/report.tsx — варианты вьюх одного контроллера:
 * // резолв по пропсам, каждый вариант — отдельный чанк
 * export default defineModule({
 *   page: {
 *     controller: setupReportProps,
 *     variants: [
 *       {
 *         when: (p) => p.scope() === "admin",
 *         component: lazy(() => import("./ReportFull")),
 *       },
 *       { component: lazy(() => import("./ReportLite")) }, // дефолт
 *     ],
 *   },
 * });
 * ```
 */
export function defineModule<P extends Record<string, any>, S = undefined>(
  options: DefineModuleOptions<P, S>,
): ShellModule<P> {
  const { component, controller, variants } = options.page;
  const service = options.service?.instance;

  // Две отдельные обёртки: контроллер вызывается безусловно — паритет
  // с React-версией, где условный вызов хука ломает правила хуков.
  const view: Component = controller
    ? function ModuleView(): JSX.Element {
        return renderPage(component, variants, controller(service as S));
      }
    : function ModuleView(): JSX.Element {
        return renderPage(component, variants, EMPTY_PROPS as P);
      };

  return { view, component, service: options.service };
}
