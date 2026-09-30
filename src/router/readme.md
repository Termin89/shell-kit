# router — синхронизация activeModule ↔ URL

Опциональный слой над ядром: адресная строка становится проекцией
`state.activeModule`. Ядро про URL по-прежнему не знает — роутер это
«ещё один подписчик» стора, построенный только на публичном API
(`getState` / `setActiveModule` / `subscribe`). Проект, которому URL
не нужен, слой просто не подключает.

## Модель

```
URL  =  / <module> / <хвост>
        └── shell ──┘ └── модуль ──┘
```

- **Первый сегмент** — `activeModule`. Синхронизируется петлёй
  `connectRouter` в обе стороны: URL → shell на popstate/старте,
  shell → URL на каждое изменение состояния.
- **Хвост** — владение модуля. Читается через `useModuleRoute(id)`,
  в AppState не попадает. Смена хвоста не меняет первый сегмент —
  петель и лишних записей истории нет.
- **Видимость** — по-прежнему `enabled(state)`: URL это вход как клик
  по навигации; неактивный/неизвестный модуль покажет notFound
  (выбор и видимость разделены).
- **Гейт-сегменты** (`gate` в опциях connectRouter) — первые сегменты
  вне реестра модулей: экраны «до приложения», классика — `/login` и
  `/register` auth-гейта. Петля их не резолвит в activeModule и не
  перетирает: пока адрес — гейт-сегмент, shell→URL молчит (URL
  принадлежит гейту). Гейт-экран читает адрес хуком `usePath()` и
  переходит сам: смена режима — push, вход — replace на целевой
  модуль, выход — replace на гейт.

Что получает приложение: F5 сохраняет экран, браузерные back/forward,
deep-links, шаринг ссылок.

## Подключение

```tsx
// App.tsx — до shell.bootstrap (deep-link применится до резолва сессии)
import { connectRouter, RouterProvider } from "@/router";

const router = connectRouter(shell);

// С auth-гейтом: /login и /register — не модули, петля их не трогает
const router = connectRouter(
  shell,
  createBrowserHistory(),
  { gate: ["login", "register"] },
);

shell.bootstrap(bootstrapInit);

// в JSX, внутри ShellProvider:
<RouterProvider port={router.port}>…</RouterProvider>
```

### Конфиг приложения: включить / выключить

Слой подключается всегда (хукам нужен провайдер), режим выбирается
адаптером истории:

```ts
// app/config.ts
export const APP_CONFIG = { router: "url" } as const; // "url" | "off"
```

```tsx
const router = connectRouter(
  shell,
  APP_CONFIG.router === "url" ? createBrowserHistory() : createMemoryHistory(),
);
```

`"off"` = `createMemoryHistory`: петля и хуки работают как обычно,
но адресная строка не трогается — поведение приложения как до
появления роутера (F5/deep-links не работают). Тот же адаптер —
для тестов и сторибука.

## Хуки

| Хук | Что даёт |
|---|---|
| `useNavigate()` | `(path, opts?) => void` по полному пути: `navigate("/partners/42")` — модуль переключит петля, про shell хук не знает |
| `useModuleRoute(id)` | `{ path, navigate }` — хвост модуля (`""` или `"/post/x"`); реактивен на push/replace/back |
| `usePath()` | полный текущий путь (`"/partners/42"`, `"/login"`); для гейт-экранов вне схемы модульных хвостов |
| `useRouter()` | порт целиком (`back`, `replace`) |

Оба перехода принимают `{ replace: true }` — заменить текущую запись
истории вместо push. Сценарий — канонизация адреса: временная
ссылка-инструкция (например, «чат с этим человеком») резолвится в
постоянный id, и back не возвращает на промежуточный URL.

Внутренняя навигация модуля (пример контроллера ленты):

```ts
const route = useModuleRoute("feed")
const post = matchPath("/post/:postId", route.path) // null — список
const onOpenCard = (id: string) => route.navigate(`/post/${id}`)
```

Кросс-модульный переход вместо протаскивания параметров через
AppState (`partnerId`, `messengerChat`):

```ts
const navigate = useNavigate()
const onOpenPartner = (id: string) => navigate(`/partners/${id}`)
```

## Подмена готовой технологией

Вся зависимость от истории — интерфейс `RouterPort`. Библиотека,
умеющая push/replace/подписку на адрес, портируется адаптером,
остальное не меняется (пример — `history`):

```ts
import { createBrowserHistory as createHistory } from "history"

const historyAdapter = (h = createHistory()): RouterPort => ({
  get path() { return h.location.pathname },
  push: (p) => h.push(p),
  replace: (p) => h.replace(p),
  back: () => h.back(),
  subscribe: (cb) => h.listen(({ location }) => cb(location.pathname)),
})

connectRouter(shell, historyAdapter())
```

Если какому-то модулю понадобится полноценный роутер (nested-лейауты,
loaders) — он подключает его внутри себя как реализацию своего хвоста,
граница `/:module/*` не меняется.

## Явно не входит (пока)

- query/search-параметры (порт несёт pathname);
- hash-адаптер для хостингов без rewrite в index.html;
- типизированная таблица путей проекта (alias `/` → модуль);
- таблица подстраниц модуля — хелпер вида `matchModuleRoutes(tail, table)`:
  цепочку `matchPath` в контроллерах уже повторяют 6 модулей двух проектов
  (feed/partners/requests/resources/messenger, deals); декларативная таблица
  `{path, key}` резолвит хвост одним вызовом. Границы не меняет: хвост —
  по-прежнему владение модуля, дерево хуков одно (слайсы контроллера
  вызываются безусловно, маршрут гейтит только `enabled` запросов).

Ядро не менялось ни одной строкой — это прецедент паттерна «слои над
core строятся на публичном API стора» (react-адаптер, queries, errors,
теперь router).
