# Приложение (app)

Слой композиции приложения: `defineApp` — декларация всего
приложения в одной точке, фабрика собирает каркас в каноническом
порядке и отдаёт инстанс с корневым компонентом. Под капотом —
существующие примитивы ядра (`configureStorage`, `Shell`,
`connectRouter`, провайдеры react-слоя): новое поведение не
появляется — фиксируется порядок, который раньше каждый проект
копировал вручную из App.tsx.

## Пирамида деклараций

```
defineModule({ states })   — экран: состояния → вьюхи
        ↓
defineApp({ modules })     — приложение: модули + сборка каркаса
        ↓
devTools(app)              — инструменты: каталог из инстанса
```

Каждый уровень потребляет предыдущий. `defineApp` не требует
машин: модули без `states` работают как раньше.

## Декларация

```ts
import { defineApp } from "shell-kit/app";

const app = defineApp<UkonState, NavMeta>({
  project: "u-kon",                    // ключи LS `<project>:*`, IDB-медиа
  state: { activeModule: "feed", user: null },
  modules: [                           // единственный реестр: конфиг + мета
    { id: "feed", meta: { title: "Лента", icon: "grid", group: "main" },
      load: () => import("../ui/pages/feed/module") },
  ],
  services: { baseUrl, getToken, mockFlags },   // готовые значения
  router: { mode: "url", basename, gate: AUTH_GATE_SEGMENTS },
  errors: (a) => setupErrorHandling(a.shell, a.port),
  auth: { screen: AuthScreen, splash: <Splash />, onSuccess: replaceGate },
  dev: DEV_TOOLS_ENABLED ? { enabled: true, tools: DevPanel,
                              beforeBootstrap: applyOverrides } : undefined,
  bootstrap: () => bootstrapInit(),
  slots: { toast: <ToastBar />, layout: <AppShell /> },
});

// main.tsx
createRoot(el).render(<StrictMode><app.Root /></StrictMode>);
```

- **modules** — записи `ModuleConfig` + `meta` проектного типа:
  второй реестр («модули для Shell + страницы для меню») умирает,
  мета читается из декларации (`useApp().definition.modules`).
- **services / router.gate / basename** — значения готовые: env-обвязка
  (VITE_*, конвенции проекта) — до вызова, ядро к ней не прибито.
- **errors** — хук подписки на шину ошибок; вызывается строго до
  bootstrap: ни один запрос не проходит мимо хендлера.
- **auth.onSuccess** — до retryBootstrap: replace гейт-адреса на
  целевой модуль, чтобы back не возвращал на /login.
- **dev.enabled** — define-константа проекта: на сборке сворачивается,
  ветки рендера и чанк тул вырезаются из прода целиком.

## Порядок сборки (запечён в фабрике)

`configureStorage → dev.beforeBootstrap → new Shell → connectRouter →
errors → shell.bootstrap`. Шаг bootstrap без `bootstrap` в декларации
пропускается — гейт прозрачен (приложение без сессий).

## Root

Порядок провайдеров фиксирован, app-специфика — именованными
слотами, не children-конструктором:

```
AppContext → ShellProvider → slots.toast → dev.tools →
RouterProvider → ShellGate (auth.splash / auth.screen) → slots.layout
```

- toast-слот — вне RouterProvider и ShellGate: тосты видны и на
  auth-экране;
- dev-панель — уровень корня, вне ShellGate: работает до логина;
- auth-экран — ленивый чанк в Suspense со сплэшем;
- layout-слот не задан — голый `ModuleRenderer`.

## Инстанс и границы

Выход: `{ definition, shell, router, port, Root }`. Инстанс доступен
каркасу и dev-тулам через `useApp()` (AppContext внутри Root) —
**не сервис-локатор**: модули приложения инстанс не импортируют,
бизнес-код говорит с ядром через хуки react/router-слоёв. Слоты
(layout-каркас, dev-панель) — вотчина app-слоя, им `useApp()` можно.
