# Ядро Shell (core)

Независимое от UI-фреймворков ядро модульного приложения: реестр модулей,
ленивая загрузка, активация модулей по состоянию, глобальное состояние и
событийная навигация. Чистый TypeScript без зависимостей — работает и в
браузере, и в Node. Всё, что связано с React, вынесено в `src/react`.

Концепция состояния (что лежит в `AppState`, инварианты, мосты в
zustand/jotai) — в [state.md](./state.md).

## Структура

```
src/core/
  Shell.ts    # Класс Shell — весь рантайм ядра
  types.ts    # AppState, ModuleConfig, ShellStatus
  index.ts    # Публичные экспорты
```

## Типы

### AppState

Глобальное состояние приложения, из которого выводится всё остальное
(набор активных модулей и т.д.). Минимальный контракт:

```ts
interface AppState {
  scope: string; // можно расширять: user, roles, theme, ...
}
```

Приложение расширяет состояние через declaration merging — ядро менять не нужно:

```ts
declare module "shell-kit" {
  interface AppState {
    user?: { name: string };
  }
}
```

### ModuleConfig

```ts
interface ModuleConfig<S extends AppState = AppState> {
  id: string;                          // уникальный идентификатор
  load: () => Promise<any>;            // асинхронный лоадер (import(), fetch, ...)
  routes?: string[];                   // пути модуля; нет routes — модуль недоступен по маршруту
  enabled?: (state: S) => boolean;     // активация по состоянию (по умолчанию true)
  preload?: boolean;                   // грузить заранее, как только стал активным
}
```

`load` возвращает экспорты модуля. Их формат определяет адаптер:
React-адаптер ждёт компонент (`default` / `Component` / функцию) или
контракт `ShellModule` — результат `defineModule` из
[../module/readme.md](../module/readme.md): вьюха берётся из `view`.

## API

### Конструктор

```ts
const shell = new Shell({
  initialState: { scope: "user" },
  modules: [/* ModuleConfig<S>[] */],
  initialPath: "/catalog", // опционально, по умолчанию "/"
});
```

При создании регистрируются модули и сразу выполняется первая сверка
активности (`syncModules`).

Ядро типизируется дженериком `Shell<S extends AppState = AppState>`:
`getState` / `setState` / `subscribe` и `enabled` модулей получают тип
состояния приложения. Концепция состояния — в [state.md](./state.md).

```ts
interface AppShellState extends AppState {
  user: User | null;
}

const shell = new Shell<AppShellState>({
  initialState: { scope: "app", user: null },
  modules: [
    {
      id: "admin",
      load: () => import("./modules/admin"),
      enabled: (s) => s.user?.roles.includes("admin") ?? false, // s типизирован
    },
  ],
});
```

### Модули

- `registerModule(config)` — добавляет модуль в реестр. Дубликаты `id`
  молча игнорируются.
- `loadModule(id): Promise<exports>` — ленивая загрузка:
  - если модуль уже загружен — возвращает кешированные экспорты;
  - при ошибке — бросает исключение и запоминает его в `entry.error`,
    **но не кеширует неудачу**: повторный вызов снова выполнит `load()`;
  - при успехе после ошибки `error` сбрасывается.
- `getActiveModules()` — записи активных модулей (включая служебные поля
  `loaded`/`exports`/`error`; для UI-проекций адаптер их отфильтровывает).
- `getActiveRoutes()` — плоский список путей активных модулей.

### Состояние

- `getState()` — текущее состояние.
- `setState(updater)` — объект-патч или функция `(state) => newState`.
  После обновления уведомляет подписчиков и пересчитывает активные модули.
- `subscribe(cb): unsubscribe` — подписка на изменения состояния.

### Навигация

- `navigate(path)` — программная смена пути + уведомление слушателей.
- `getPath()` — текущий путь.
- `onRouteChange(cb): unsubscribe` — подписка на смену пути.

Ядро не валидирует путь против списка маршрутов и не трогает History API —
это границы ответственности адаптера/приложения.

### Bootstrap (асинхронная инициализация)

До того как приложение можно показывать, часто нужно выполнить асинхронную
работу: проверить авторизацию, восстановить сессию, загрузить конфиг
окружения. Для этого у ядра есть `bootstrap`:

```ts
const shell = new Shell({
  initialState: { scope: "guest" }, // безопасное состояние до инициализации
  modules,
  initialPath: "/catalog",
});

// никогда не бросает исключение — результат наблюдается через статус
shell.bootstrap(async (state) => {
  const session = await api.restoreSession(); // любые асинхронные действия
  return { scope: session.role }; // резолв — патч конечного состояния
});
```

Модель статусов (`ShellStatus`):

- `idle` — bootstrap не вызывался, модули активируются сразу;
- `bootstrapping` — идёт инициализация: **активация модулей подавлена**
  (активный набор пуст, `syncModules` не пересчитывает его, preload
  не стартует);
- `ready` — патч применён, активация включена и пересчитана от нового
  состояния;
- `error` — инициализация упала, ошибка доступна в `getBootstrapError()`.

API:

- `bootstrap(init)` — запускает инициализацию. `init(state)` получает
  текущее состояние и возвращает патч (или ничего). Повторный вызов во
  время `bootstrapping` игнорируется.
- `retryBootstrap()` — перезапуск после ошибки (только в статусе `error`).
- `getStatus()` / `getBootstrapError()` — текущий статус и последняя ошибка.
- `onStatusChange(cb)` — подписка на смену статуса.

Ключевая идея: **конфиг модулей остаётся статичным**. Асинхронная логика
резолвит состояние, а набор активных модулей выводится из него обычным
путём через `enabled`. Без вызова `bootstrap` (статус `idle`) Shell
работает как раньше.

Замечания:

- `setState` во время `bootstrapping` обновляет состояние и уведомляет
  подписчиков, но активация остаётся подавленной до `ready`.
- Повторный `bootstrap` после `ready` допустим (например, re-login):
  активный набор снова сбрасывается до завершения инициализации.
- В React для статуса есть `useShellStatus()` и компонент `ShellGate` —
  см. [../react/readme.md](../react/readme.md).

### События

- `onModuleChange(cb): unsubscribe` — срабатывает, когда **набор активных
  модулей** реально изменился (не при каждом пересчёте).

## Активация и preload

При каждом `setState` ядро пересчитывает активный набор:

1. для каждого модуля вызывается `enabled(state)` (нет функции — модуль активен);
2. модули, ставшие активными и помеченные `preload: true`, грузятся
   в фоне (ошибки preload игнорируются молча);
3. если набор изменился — уведомляются слушатели `onModuleChange`.

## Полный пример

```ts
import { Shell } from "shell-kit";

const shell = new Shell({
  initialState: { scope: "user" },
  initialPath: "/catalog",
  modules: [
    {
      id: "catalog",
      load: () => import("./modules/catalog"),
      routes: ["/catalog"],
      preload: true,
    },
    {
      id: "admin",
      load: () => import("./modules/admin"),
      routes: ["/admin"],
      enabled: (s) => s.scope === "admin",
    },
  ],
});

shell.subscribe((state) => console.log("state:", state.scope));
shell.onModuleChange(() =>
  console.log("active:", shell.getActiveModules().map((m) => m.id)),
);
shell.onRouteChange((path) => console.log("route:", path));

shell.setState({ scope: "admin" }); // активируется admin, сработает onModuleChange
await shell.loadModule("catalog");  // => экспорты модуля (уже загружен preload'ом)
shell.navigate("/admin");           // => route: /admin
```

## Заметки и ограничения

- Один экземпляр `Shell` на приложение; создаёт его приложение, адаптер
  лишь раздаёт через контекст.
- Модуль без `routes` — сервисный: активируется и загружается как обычный,
  но не участвует в роутинге (`getActiveRoutes` его не видит, до него
  нельзя добраться по пути — только `loadModule`).
- `registerModule` после создания не включает модуль в активный набор
  сразу — активность пересчитается при следующем `setState`.
- Деактивация модуля не выгружает его код (`loaded` остаётся), меняется
  только набор активных.
- `navigate` на неактивный модуль не ошибка — рендерер покажет `notFound`.
- Обработку ошибок загрузки делает потребитель: ядро только бросает
  исключение из `loadModule` и хранит `entry.error`.

## Что НЕ входит в ядро

- UI-фреймворки и рендеринг — адаптер (`src/react`), см. его readme.
- Бизнес-логика модулей — в самих модулях.
- Аутентификация — ядро хранит состояние (пользователь, роли), логику
  входа/выхода реализуют модули.
- History API, LocalStorage, SSR — уровень адаптера или приложения.
- Дизайн-система, сборка, кеширование — вне ядра.

## Планы

- API-клиент с интерсепторами и сервисы от модулей.
- Управление моками (включение/отключение на уровне модуля).
- Глобальная обработка ошибок (обработчики, сбор в состоянии, логирование).
- Плагины (логирование, аналитика, метрики).
