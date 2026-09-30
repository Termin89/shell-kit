import type { ComponentType } from "react";

/**
 * Чистая вьюха страницы: только презентация на семантических токенах
 * (design system). Никаких сервисов, API и бизнес-логики — только пропсы.
 * Может переиспользоваться с другим контроллером (частичное использование
 * модуля).
 */
export type PageComponent<P = object> = ComponentType<P>;

/**
 * Контроллер страницы — бизнес-часть. Подключает сервисы (их хуки),
 * shell-состояние и отдаёт пропсы для PageComponent.
 * По конвенции это кастомный хук: имя начинается с `use`
 * (например, `useCatalogProps`).
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
export interface PageVariant<P> {
  /**
   * Предикат на пропсах контроллера — резолв варианта по состоянию
   * происходит через пропсы, состояние напрямую модуль не читает.
   * Вариант без `when` матчится всегда — это дефолт, его обычно ставят
   * последним. Перебор по порядку, побеждает первый подходящий.
   */
  when?: (props: P) => boolean;
  component: PageComponent<P>;
}

/** Страница с единственной вьюхой. */
export interface SinglePage<P, S = undefined> {
  component: PageComponent<P>;
  controller?: PageController<P, S>;
  variants?: never;
}

/** Страница с вариантами вьюх одного контроллера. */
export interface VariantsPage<P, S = undefined> {
  component?: never;
  controller?: PageController<P, S>;
  variants: PageVariant<P>[];
}

/**
 * Страница: чистая вьюха (или варианты вьюх) + опциональный контроллер.
 * `component` и `variants` взаимоисключительны — на уровне типов.
 */
export type PageDefinition<P, S = undefined> =
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
 * из ModuleConfig: ядро регистрирует модуль, React-адаптер рендерит `view`.
 */
export interface ShellModule<P = object> {
  /**
   * Конечная собранная вьюха модуля (контроллер + компонент).
   * Её рендерит ModuleRenderer.
   */
  view: ComponentType;
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
