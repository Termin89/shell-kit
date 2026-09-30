# GETTING-STARTED — проект на shell-kit

End-to-end онбординг потребителя: от пустой папки до работающего
модульного приложения. Все команды выполняются в корне вашего проекта.

## 1. Пакет

```bash
mkdir my-app && cd my-app && npm init -y
npm install github:Termin89/shell-kit#v0.1.0 react react-dom
npm install -D vite @vitejs/plugin-react typescript \
  @types/react @types/react-dom
```

`prepare`-скрипт shell-kit соберёт `dist/` при установке (первый install
требует сеть — ставятся devDeps пакета).

## 2. TypeScript

`tsconfig.json` — bundler-режим, путь пакета не нужен (импорты по имени):

```jsonc
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "skipLibCheck": true,
    "strict": true
  },
  "include": ["src"]
}
```

## 3. Vite

`vite.config.ts` — только react-плагин (Tailwind — по желанию проекта):

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
```

`index.html` — стандартный vite-шаблон со `<script type="module" src="/src/main.tsx">`.

## 4. Каркас приложения

```tsx
// src/main.tsx
import "shell-kit/ui/styles.css";   // структурные классы UI-слоя
import "./theme.css";               // токены проекта (цвета/тени/шрифты)
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
// src/theme.css — минимум токенов, дальше по мере вёрстки
:root {
  --color-bg: #ffffff;
  --color-ink: #1a2333;
  --color-line: #e3e8ef;
  --color-accent: #16335b;
  --radius-card: 14px;
  --shadow-card: 0 1px 2px rgb(20 32 54 / 0.06);
}
```

Каркас: Shell + реестр модулей + bootstrap — по образцу демо
(витрина — `src/demo/` репо shell-kit: github.com/Termin89/shell-kit).
Первый модуль пишите по контракту
`defineModule`: чистая вьюха (`component`) + контроллер-хук
(`controller`), сервисы — через `defineService` (mock-стратегия на
`PersistentMock` + api-fallback). Канон доменного сервиса — скилл
`service` (см. ниже).

## 5. Скилы платформы

Промт-конвейеры (прототип→приложение, фичи, компоненты, сервисы,
проходы модулей, деплой, прод, доки) подключаются плагином:

```bash
zai plugin marketplace add github:Termin89/shell-kit
zai plugin install shell-kit --scope project
```

Фолбэк без плагина — раздел в `MEMORY.md` проекта:

```markdown
## Скиллы платформы

Резолв: node_modules/shell-kit/skills/<name>/SKILL.md; проектный
оверрайд — skills/<name>/ в корне проекта (приоритетнее).

- prototype-to-app — прототип → приложение (конвейер с фазами)
- feature — фича внутри модуля существующего приложения
- components — доработка UI-компонента по всем потребителям
- service — канон доменных сервисов (types/seeds/mock/api)
- module-pass — параллельный плановый проход модулей
- improvements — пул доработок модуля по стадиям
- deploy / production — хостинг/CI и прод-готовность
- storybook — каталог компонентов
- product-analysis / doc-sync — продуктовые доки и их синхронизация
```

Нюансы проекта под скилы — в `skills/PROJECT.md` (роли, персистентность,
эталоны, запреты, состояния §48).

## 6. Проверка

```bash
npx tsc --noEmit     # типы
npx vite build       # сборка
npx vite preview     # посмотреть
```

Дальше: деплой — скилл `deploy`; прод-готовность (env, хардкод-аудит) —
скилл `production`; полный список входов ядра — README.md → «Субпути
пакета».
