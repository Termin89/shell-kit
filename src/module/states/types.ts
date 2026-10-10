import type { ComponentType } from "react";

/**
 * states/types — контракт декларации состояний экрана.
 *
 * Машина состояний модуля — только **навигационная ось**: «какая
 * вьюха показана». Ось данных (loading/error/empty) — внутри вьюх,
 * машина её не знает. У состояния две природы:
 *
 * - **адресуемое** (`path`) — свой путь в пространстве модуля,
 *   deep-link, push-история, browser-back работает;
 * - **внутреннее** (`host`) — живёт на пути host-состояния, URL не
 *   меняет, выходит browser-back'ом. Инвариант: внутреннее видно
 *   ⟺ URL === host.path (внешняя смена адреса сбрасывает слот).
 *
 * Роли и сигналы — генерики: машина не знает домена проекта.
 */

/** Вариант данных состояния — каталог для dev-тулы; вьюха интерпретирует id. */
export interface StateVariant {
  readonly id: string;
  readonly title: string;
}

/** Опции прямого перехода (goto). */
export interface GotoOptions {
  /** Значения path-параметров целевого состояния (`:id` → id). */
  readonly params?: Readonly<Record<string, string>>;
  /**
   * Вариант данных целевого состояния — только память машины: URL
   * чистый, reload → дефолт (null). Прыжки dev-тулы ходят через него.
   */
  readonly variant?: string | null;
  /** Заменить запись истории вместо push (канонизация адреса). */
  readonly replace?: boolean;
}

/**
 * Действия машины, доступные вьюхам (ViewProps) и onEnter: goto —
 * прямой прыжок по id, send — семантический маршрут по объявленным
 * сигналам (стейт → глобальные → предупреждение).
 */
export interface StateActions<Id extends string = string, Signal extends string = string> {
  readonly goto: (id: Id, options?: GotoOptions) => void;
  readonly send: (signal: Signal) => void;
}

/** Пропсы вьюхи состояния: адресные данные + действия машины. */
export interface ViewProps<Id extends string = string, Signal extends string = string>
  extends StateActions<Id, Signal> {
  /** Активное состояние (ключ из декларации). */
  readonly state: Id;
  /** Path-параметры адресуемого состояния (`/:id` → `{ id }`). */
  readonly params: Readonly<Record<string, string>>;
  /** Query адреса (роутер держит только pathname — машина читает search). */
  readonly query: Readonly<URLSearchParams>;
  /** Вариант данных состояния (доставлен goto'ом) или null. */
  readonly variant: string | null;
}

/** Контекст onEnter — эффект входа в состояние. */
export interface EnterContext<Id extends string = string, Signal extends string = string>
  extends StateActions<Id, Signal> {
  /** Хвост адреса в пространстве машины (полезен для канонизации). */
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<URLSearchParams>;
}

/** Контекст проверки доступа: роли (инъекция getRoles) + адресные данные. */
export interface AccessContext {
  /** Роли текущего пользователя — машина получает их инъекцией. */
  readonly roles: readonly string[];
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<URLSearchParams>;
}

/**
 * Навигационный доступ состояния — «куда пускаем» (экраны,
 * deep-link). Матрица действий («что разрешаем делать»: кнопки,
 * мутации) — остаётся в домене приложения и машиной не решается.
 */
export interface StateAccess<Role extends string = string> {
  /** Разрешённые роли (статическая проекция для тул и документации). */
  readonly roles?: readonly Role[] | "any";
  /** Рантайм-условие (владение, суб-роли) — в проекцию не попадает. */
  readonly guard?: (context: AccessContext) => boolean;
  /** Куда свернуть запрет: replace на путь fallback-состояния. */
  readonly fallback?: string;
}

/** Запись одного состояния карты. */
export interface StateConfig<
  Id extends string = string,
  Role extends string = string,
  Signal extends string = string,
> {
  /**
   * Вьюха состояния: ComponentType<ViewProps>. view ≠ состояние 1:1 —
   * одна вьюха может обслуживать несколько состояний (например, форма
   * входа и регистрации).
   */
  readonly view: ComponentType<ViewProps<Id, Signal>>;
  /** Путь в пространстве модуля — адресуемое состояние. Ровно одно из path | host. */
  readonly path?: string;
  /** Хост-состояние (адресуемое), на пути которого живёт внутреннее. */
  readonly host?: Id;
  /** Человекочитаемое имя — каталог dev-тулы и документация. */
  readonly title?: string;
  /** Семантические рёбра: сигнал → целевое состояние этого графа. */
  readonly signals?: Readonly<Partial<Record<Signal, Id>>>;
  /** Варианты данных для dev-тулы (машина каталогизирует, вьюха трактует). */
  readonly variants?: readonly StateVariant[];
  /** Навигационный доступ (roles — проекция, guard — рантайм). */
  readonly access?: StateAccess<Role>;
  /**
   * Эффект входа: вызывается машиной при фактическом переходе (не
   * React-эффектом — StrictMode не задваивает). Возврат функции —
   * очистка при уходе из состояния; прочие возвраты (Promise от
   * асинхронной работы и т.п.) игнорируются.
   */
  readonly onEnter?: (context: EnterContext<Id, Signal>) => unknown;
  /** Позиция для направленного свапа (вглубь — слайд). */
  readonly order?: number;
  /** Свободная мета состояния (читают тулы и документация). */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** Декларация карты состояний экрана. */
export interface StatesDeclaration<
  Id extends string = string,
  Role extends string = string,
  Signal extends string = string,
> {
  /** Карта состояний: id → конфигурация. */
  readonly states: Readonly<Record<Id, StateConfig<Id, Role, Signal>>>;
  /** Вход без deep-link («голый» адрес модуля резолвится сюда). Адресуемое. */
  readonly initial: Id;
  /** Нематчнутый путь модуля показывается этим состоянием (URL не трогаем). */
  readonly notFound?: Id;
  /** Рамка-свап между состояниями: направленный слайд, лёгкий fade или без анимации. */
  readonly transition?: "fade" | "slide" | false;
  /** Глобальные сигналы — fallback для любого состояния. */
  readonly signals?: Readonly<Partial<Record<Signal, Id>>>;
}

/**
 * Опции сборки страницы состояний (createStatesPage / ветка states
 * в defineModule): инъекции машины и классы рамки-свапа.
 */
export interface StatesPageOptions<Role extends string = string> {
  /** Инъекция ролей для access-проверок машины. */
  readonly getRoles?: () => readonly Role[];
  /** Журнал переходов для dev-тулы. */
  readonly journal?: boolean;
  /** Имя машины в dev-реестре (по умолчанию — moduleId). */
  readonly devId?: string;
  /** Классы рамки-свапа (переопределение дизайн-слоя проекта). */
  readonly className?: string;
  readonly itemClassName?: string;
}
