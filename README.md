# shell-kit

Библиотека модульных приложений: headless-ядро Shell + React-адаптер.
Модули — независимые мини-приложения со своим доменом и чанком; Shell
решает, **какие из них видимы** в текущем контексте. Дистрибуция —
git-зависимость (`github:Termin89/shell-kit#<tag>`), сборка пакета —
`prepare`-скриптом при установке.

Глубокий разбор архитектуры — [MAP.md](MAP.md). Зачем существует и в чём
ценность — [VALUE.md](VALUE.md). Разбор на живом ТЗ — [CASE-U-KON.md](CASE-U-KON.md).
План развития — [PLAN.md](PLAN.md).

## Установка

Node ≥ 20, React 19 (peer):

```bash
npm install github:Termin89/shell-kit#v0.1.0 react react-dom
```

`prepare`-скрипт пакета собирает `dist/` при установке (нужны devDeps
пакета — первый install требует сеть). Дальнейшие обновления —
`npm update shell-kit`.

## Quickstart

Ядро headless: создаёте `Shell` с реестром модулей и состоянием,
оборачиваете приложение в провайдер. CSS-слой подключается отдельным
импортом.

```tsx
// main.tsx
import "shell-kit/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```tsx
// App.tsx
import { Shell } from "shell-kit/core";
import type { ModuleConfig } from "shell-kit/core";
import { ModuleRenderer, ShellGate, ShellProvider } from "shell-kit/react";

type AppState = { role: "guest" | "user"; activeModule: string | null };

const modules = [
  {
    id: "catalog",
    load: () => import("./modules/Catalog"),   // lazy-чанк
    enabled: ({ role }) => role === "user",    // видимость = состояние
  },
] as const satisfies readonly ModuleConfig<AppState>[];

const shell = new Shell<AppState, typeof modules>({
  initialState: { role: "guest", activeModule: null },
  modules,
});

export function App() {
  return (
    <ShellProvider shell={shell}>
      <ShellGate>{/* auth-слот, пока bootstrap не готов */}</ShellGate>
    </ShellProvider>
  );
}
```

```tsx
// modules/Catalog/index.tsx — контракт модуля
import { defineModule } from "shell-kit/module";

export default defineModule({
  page: {
    component: CatalogPage,       // чистая вьюха: только пропсы
    controller: useCatalogProps,  // бизнес-часть: сервисы + состояние
  },
});
```

Модуль — единица чанка: `load` возвращает `import()`, ядро греет
активные, ошибка загрузки не кешируется (retry работает). Какой модуль
показывать и где — решает layout приложения (`ModuleRenderer` + ваш
навигационный каркас); роутинг URL — слой `shell-kit/router` по
желанию.

## Субпути пакета

| Импорт | Что даёт |
|---|---|
| `shell-kit` | всё public-API ядра (корневой вход) |
| `shell-kit/core` | Shell: реестр, видимость, bootstrap, состояние |
| `shell-kit/react` | ShellProvider, hooks, ModuleRenderer, ShellGate |
| `shell-kit/module` | контракт модуля: `defineModule` |
| `shell-kit/service` | `defineService`: стратегии api/mock per-call |
| `shell-kit/transport` | HTTP-транспорт: конверт, TransportError |
| `shell-kit/errors` | классификация (ErrorKind), шина, хендлеры |
| `shell-kit/queries` | query-порт, `useServiceQuery`/`useServiceMutation` |
| `shell-kit/storage` | PersistentMock, медиа (IndexedDB), LS-утилиты |
| `shell-kit/router` | синхронизация activeModule ↔ URL, `useNavigate` |
| `shell-kit/ui` | UI-слой: cx, createIcon, Button/Card/Chip/… |
| `shell-kit/ui/styles.css` | структурные классы UI-слоя (токены — в theme.css проекта) |

## Скилы (промт-конвейеры платформы)

Скилы — файлы `skills/<name>/SKILL.md`: конвейеры «прототип →
приложение», доработки фич/компонентов/сервисов, плановые проходы
модулей, деплой, прод-готовность, доки.

Два канала подключения в проект-потребитель:

1. **Плагин** (основной):
   ```bash
   zai plugin marketplace add github:Termin89/shell-kit
   zai plugin install shell-kit --scope project
   ```
2. **Фолбэк** — раздел «Скиллы платформы» в MEMORY.md проекта: реестр
   имён + правило резолва (`node_modules/shell-kit/skills/<name>/SKILL.md`).

## Демо

```bash
npm run dev          # демо-приложение src/demo с HMR
npm run build:demo   # его же продакшен-сборка
```

Демо догфудит публичный API: импортирует `shell-kit/<layer>` и
`shell-kit/ui/styles.css`, покрывает фичи ядра (bootstrap, retry,
варианты, сервисный модуль, mock/api-тумблер).

## Структура репо

```
src/
  core/      ядро Shell: реестр, видимость, bootstrap (+ state.md)
  react/     React-адаптер: ShellProvider, hooks, ModuleRenderer
  module/    контракт модуля: defineModule
  service/   defineService: стратегии api/mock, per-call диспетчер
  transport/ HTTP-транспорт
  errors/    классификация ошибок, шина, хендлеры
  queries/   query-порт + хуки
  storage/   PersistentMock, медиа
  router/    router-слой (activeModule ↔ URL)
  ui/        универсальный UI-слой + components.css
  demo/      демо-приложение (витрина public API)
skills/      11 промт-скиллов платформы (плагин)
.claude-plugin/   манифесты плагина
```

## Разработка

```bash
npm ci               # install + prepare (сборка dist/)
npm run lint         # oxlint
npm run typecheck    # tsc -b (app + lib проекты)
npm run build:lib    # сборка пакета в dist/ (preserveModules, ES)
npm run build:demo   # сборка демо
```

CI (`.github/workflows/ci.yml`): lint → typecheck → build:lib →
валидация плагин-манифестов → `npm pack --dry-run`.

Версионирование: правка ядра → коммит → тег `vX.Y.Z` → push; в
потребителе `npm update shell-kit`. Скилы версионируются вместе с
пакетом (bump версии в `.claude-plugin/plugin.json` +
`marketplace.json` → `zai plugin marketplace update` у потребителя).
