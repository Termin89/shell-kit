# Состояния модуля (module/states)

Слой стейт-машины экрана: декларативная карта состояний → вьюхи, с
адресуемостью, переходами, вариантами и доступом. Машина — только
**навигационная ось** («какая вьюха показана»): ось данных
(loading/error/empty) живёт внутри вьюх, навигационный доступ —
про «куда пускаем», а не «что разрешаем делать» (кнопки и мутации —
домен приложения).

## Две природы состояния

| | адресуемое (`path`) | внутреннее (`host`) |
| --- | --- | --- |
| Адрес | свой путь в пространстве модуля | путь host-состояния |
| Deep-link | да | нет |
| История | push/back работают | выходит browser-back'ом на host |
| После reload | восстанавливается по адресу | показывается host («reload → host») |

**Инвариант:** внутреннее состояние видно ⟺ текущий адрес — это
`host.path`. Любая внешняя смена адреса сбрасывает слот: ручная
exitOn-матрёшка («из pending назад — только на login») схлопывается в
одно правило. Внутренние состояния не персистятся.

## Декларация

```ts
import type { StatesDeclaration } from "shell-kit/module/states";

const PARTNERS_STATES: StatesDeclaration<
  "list" | "detail" | "new" | "admin",
  "member" | "partner" | "admin"
> = {
  initial: "list",
  transition: "slide",              // рамка-свап: slide | fade | false
  states: {
    list:   { path: "/",      view: PartnersList,   order: 0 },
    detail: { path: "/:id",   view: PartnersDetail, order: 1 },
    new:    { path: "/new",   view: PartnersNew,    order: 2,
              access: { roles: ["admin"], fallback: "list" } },
    admin:  { path: "/admin", view: OrgAdmin,       order: 3,
              access: { roles: ["admin"], fallback: "list" } },
  },
};
```

Поля состояния: `path` или `host` (ровно один), `view`
(`ComponentType<ViewProps>`; view ≠ состояние 1:1 — одна форма может
обслуживать вход и регистрацию), `title`, `signals` (семантические
рёбра), `variants` (варианты данных для dev-тулы — только память),
`access` (`roles` — статическая проекция, `guard` — рантайм, `fallback`
— replace при запрете), `onEnter` (эффект входа, возвращает очистку),
`order` (направление свапа), `meta`.

Матчинг путей — `matchPath` слоя router (`:name` — параметры, статик-
сегменты матчатся вперёд динамических: `/admin` и `/new` раньше
`/:id`). `initial` обязан быть адресуемым; «голый» адрес модуля без
совпадений показывает `notFound` (если объявлен) или `initial`.

## Runtime

- `useModuleState() → { state, params, query, variant, goto, send }` —
  пропсы вьюх; рендер — `useSyncExternalStore` на эмиттере машины.
- `goto(id, { params?, variant?, replace? })` — прямой прыжок:
  адресуемое → navigate, внутреннее → слот памяти (с доездом до host).
- `send(signal)` — семантический маршрут: сигналы состояния →
  глобальные сигналы декларации → предупреждение в консоль.
- `onEnter` вызывает **машина** при фактическом переходе — не
  React-эффект, поэтому StrictMode не задваивает (автопрогон
  подтверждения e-mail в auth срабатывает ровно один раз).
- `variant` — только память: доставляется `goto(id, { variant })`, URL
  чистый, reload → дефолт. Dev-тула прыгает в вариант через goto.
- Запрет доступа: deep-link в закрытое состояние → replace на путь
  `fallback` (один шаг; без fallback — остаёмся, вьюха показывает
  denied-заглушку).
- `skipOnEnter` (опция машины/провайдера, v0.9.0) — превью-режим
  dev-тулы: снапшот/переходы работают, onEnter не вызывается —
  листание состояний в офлайн-оверлее не запускает эффекты входа
  живого приложения.

## Валидация

Декларация проверяется при создании машины; проблемы логируются
`[module-states]` в консоль, работа продолжается best-effort. Коды:
`UNKNOWN_HOST`, `DUP_PATH`, `PATH_AND_HOST_BOTH`,
`NEITHER_PATH_NOR_HOST`, `INITIAL_NOT_ADDRESSABLE`,
`SIGNAL_TARGET_UNKNOWN`, `FALLBACK_UNKNOWN`,
`FALLBACK_NOT_ADDRESSABLE`.

## Страница модуля и standalone

Внутри `defineModule({ states })` страница собирается
`createStatesPage(moduleId, declaration, options)`: провайдер машины +
`SwapFrame` (высотный FLIP + направленный слайд, режимы
`slide`/`fade`/`false`) + резолв вьюхи. Стили рамки —
`shell-kit/module/states.css`; проект со своей дизайн-системой
переопределяет классы (`className`/`itemClassName`).

Standalone-машина (экран вне реестра модулей — классический пример
auth-гейт, источник адреса — полный путь роутера):

```tsx
import { createModuleStateMachine, ModuleStateProvider, useRouterSource } from "shell-kit/module/states";

const AUTH_STATES: StatesDeclaration<"login" | "register" | "verify" | "pending"> = {
  initial: "login",
  notFound: "login",
  transition: "fade",
  states: {
    login:    { path: "/login",    view: AuthCard,  title: "Вход" },
    register: { path: "/register", view: AuthCard,  title: "Регистрация",
                signals: { SUBMITTED: "pending" } },
    verify:   { path: "/verify",   view: VerifyCard, title: "Подтверждение e-mail",
                onEnter: ({ query }) => verifyContact(query.get("token") ?? "") },
    pending:  { host: "register",  view: PendingCard, title: "Заявка на модерации" },
  },
};

function AuthGate() {
  const source = useRouterSource();
  return (
    <ModuleStateProvider declaration={AUTH_STATES} source={source} devId="auth">
      {/* свап карточек — своей разметкой гейта (SwapFrame с
          itemClassName="auth-card-swap" или собственный key-свап) */}
      <AuthCards />
    </ModuleStateProvider>
  );
}
```

Машина headless: `createModuleStateMachine` принимает источник адреса
инъекцией (`ModuleStateSource`), роли — через `getRoles` (проект
читает сессию снаружи, машина не знает домена). `devId` регистрирует
машину в лёгком dev-реестре — каталог состояний dev-тулы находит её
по имени, включая standalone (auth).

## Реестр деклараций и офлайн-превью (v0.9.0)

Реестр живых машин видит только смонтированные экраны. Второй реестр —
**деклараций**: `createStatesPage` регистрирует декларацию по `moduleId`
на загрузке чанка модуля (dedup/замена по id — HMR), standalone-машины
регистрируются явно (`registerStatesDeclaration("auth", AUTH_STATES,
{ preview: AuthPreviewWrap })` из dev-файла проекта). Без dev-гейта —
цена прод-сборки Map-запись на живые объекты.

```ts
import {
  getRegisteredStateDeclarations,
  projectAccess,
  hasRuntimeGuard,
} from "shell-kit/module/states";

const declarations = getRegisteredStateDeclarations();
// Статическая матрица доступа без машины: roles vs access.roles,
// «any» и отсутствие ограничения — всем; guard — маркером:
projectAccess(declaration, ["admin"]); // { list: true, new: false, … }
hasRuntimeGuard(declaration, "detail"); // true → «guard?» в тулaх
```

По записи реестра dev-тула строит **офлайн-превью**: оверлей с
изолированной машиной на source-стабе в памяти (реальный URL и
состояние приложения не мутируются), `skipOnEnter`, роли — чипами
через `getRoles`-ref, вьюхи — через `preview`-обёртку записи
(контекст экрана: vm-контроллер auth). `preview` задаётся опцией
`createStatesPage`/`defineModule({ states })` или явной регистрацией.

`swapOrder(declaration)` — порядок состояний по `order` (направленный
слап): используется страницей модуля и превью тулы.

## Границы

- `enabled(state)` реестра решает видимость модуля целиком (двухуровне-
  вая лестница: модуль → состояние), `access` — состояние внутри
  включённого модуля.
- Моды графа (структурно разные потоки под одну роль) — бэклог:
  доступ решается проекцией, не копиями графа.
- Выход из модуля — уровень роутера, не машины.

## См. также

- [../../router/readme.md](../../router/readme.md) — порт, matchPath,
  useModuleRoute (хвосты модуля);
- [../readme.md](../readme.md) — контракт модуля, defineModule.
