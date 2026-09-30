# shell-kit: отделение ядра, publish-ready рефакторинг, вынос проектов

> **ВЫПОЛНЕН 2026-09-30.** Phase A (A1–A7) — коммиты 31e1e88…b6d8933, тег
> `v0.1.0`. Phase B: u-kon → github.com/Termin89/u-kon (e6c2856),
> partner-portal → github.com/Termin89/partner-portal (ebdee4d)
> — оба приватные, ядро — git-зависимость `#v0.1.0`; чистка ядра от
> PROJECT_APP/`project:*`/VitePWA/tailwind — этим же числом. Phase C
> (потребитель/плагин/обновления) — прогнана по факту выноса: гейты
> install/tsc/build/dev-smoke зелёные в обоих репо. Ниже — исходный план
> (историческая запись).

> План утверждён, выполнение отложено. Пересобран 2026-09-28 — сверен с текущим
> состоянием репо, дрейф за три недели учтён ниже (блок «Сверка»). Рабочее дерево
> чистое, Phase A не стартовала: в `package.json` нет `exports`/`prepare`,
> нет `tsconfig.lib.json`/`.claude-plugin/`/`GETTING-STARTED.md`/`ci.yml`.

## Сверка 2026-09-28 (дрейф с 7 сентября)

- **Скилы: 5 → 10.** Добавились components, deploy, doc-sync, improvements,
  module-pass, product-analysis, production, storybook. Плагин пакует все 10;
  аудит в A5 расширен (см. пункт про монорепо-команды).
- **Проекты выросли:** импортов `from "@/` в `projects/` было 183/151 файлов —
  стало **305/247** (u-kon: плановые проходы по модулям). Миграция та же
  механическая замена, объём больше.
- **PWA u-kon:** в корневом `vite.config.ts` появился VitePWA-блок (манифест,
  workbox-прекэш, base-логика) и devDep `vite-plugin-pwa`. На момент плана его
  не было: блок переносится в u-kon (Phase B), из ядра удаляется (чистка).
- **deploy-u-kon.yml** живёт в `.github/workflows/deploy-u-kon.yml` (в плане
  был указан корень) — путь уточнён в B9.
- **WIP FeedCard.tsx** закоммичен (88fe4b4) — блокирующей незакоммиченной
  правки больше нет.
- **Скилы завязаны на монорепо-механику:** `PROJECT_APP`-сборка и `project:*`-
  скрипты упоминаются в module-pass, deploy, production; `@/ui` — в components,
  feature, storybook. После Phase B этих команд в проектах нет (у них свои
  `npm run build`) — правки в A5.
- Проверено, не изменилось: 10 слоёв со своими `index.ts` (+ корневой
  `src/index.ts`); `@/` в ядре — только `react/context.ts` и `react/hooks.ts`;
  динамических `import("@/` в проектах нет; `theme.css` обоих проектов тянет
  `../../../../src/ui/components.css`; git 2.14.1 (`git restore` нет).

## Context

Репо `~/projects/shell-kit` (remote: `github:Termin89/shell-kit`) — монорепо: ядро (`src/`), два проекта-потребителя (`projects/u-kon`, `projects/partner-portal` — без своих package.json, собираются корневым vite.config через `PROJECT_APP`), 10 скилов (`skills/`). Цель: репо = чистая библиотека + скилы, publish-ready; проекты — отдельные репо на git-зависимости; скилы видны в проектах через Claude Code плагин (project-scope); обновления обоих каналов проверены.

**Единственная связка сегодня:** alias `@ → ./src` в корневом `vite.config.ts`. Проекты импортируют `@/core`, `@/react`, `@/module`, `@/service`, `@/storage`, `@/ui`, `@/router` и т.д.

## Решения (зафиксированы)

1. Дистрибуция — git-зависимость (`"shell-kit": "github:Termin89/shell-kit#<tag>"`), npm publish отложен.
2. Проекты — свежие репо без истории.
3. `src/demo` остаётся как витрина (ест публичный API пакета); `src/practice` — удалить.
4. Экспорты — субпуты по слоям: `shell-kit/core` … `shell-kit/router` + корень `.`. Миграция = замена `@/` → `shell-kit/`.
5. Скилы дополнительно пакуются как плагин: `.claude-plugin/plugin.json` + `marketplace.json`; потребитель ставит `zai plugin install shell-kit --scope project`; MEMORY.md-фолбэк (§I) остаётся вторым каналом.

## Ключевой архитектурный ход

**Git-зависимость + `prepare`-скрипт.** Экспорты указывают на `dist/`; `"prepare": "npm run build:lib"` — npm собирает dist при установке git-зависимости (devDeps доступны). Тот же механизм работает при `npm publish` позже — один канал на оба сценария. UMD отбрасываем (бессмыслен при мульти-входах), только ES + `preserveModules`.

---

## Phase A — shell-kit publish-ready (репо зелёное на каждом шаге)

### A1. tsconfig-сплит
- Новый `tsconfig.lib.json`: compilerOptions из `tsconfig.app.json`, убрать `noEmit`/`allowImportingTsExtensions`, добавить `declaration`, `emitDeclarationOnly`, `declarationMap`, `outDir: "./dist"`; `include: ["src"]`, `exclude: ["src/demo", "src/practice"]`.
- `tsconfig.app.json`: пока оставить `src/demo` + projects (до Phase B), убрать голый `src`.
- Корневой `tsconfig.json` — добавить reference на lib.

### A2. vite.config.ts — мульти-входовая lib-сборка
- `entry` — объект из 11 входов: `index` + 10 слоёв (`src/<layer>/index.ts`).
- `formats: ["es"]`, `preserveModules: true`, `preserveModulesRoot: "src"`, `entryFileNames: "[name].js"` → dist повторяет структуру src, межслойные импорты относительные.
- `external`: react, react-dom, react/jsx-runtime; после резолва алиаса — всё из `src/` остаётся модулями (preserveModules), НЕ инлайнится.
- dts: `include: ["src/**/*"]`, `exclude: ["src/demo/**", "src/practice/**", "projects/**"]`, `tsconfigPath: "./tsconfig.lib.json"`, `outDir: "dist"` (проверить `entryRoot: "src"` если dts ляжет плоско).
- CSS: мини-плагин `closeBundle` → `fs.copyFileSync("src/ui/components.css", "dist/ui/components.css")`.
- Dev-режим (demo): alias `"shell-kit" → ./src` — demo догфудит публичный API без сборки.
- Удалить `PRACTICE_APP`-механику. `PROJECT_APP`/tailwind — остаются до Phase B.

### A3. package.json
- `version: "0.1.0"`, `description`, `license: "MIT"`, `sideEffects: ["**/*.css"]`.
- `exports`: `.` + 10 субпутей `{ types, import }` → `./dist/...`; `./ui/styles.css` → `./dist/ui/components.css`; `./package.json`.
- `files: ["dist", "skills", "README.md"]` (skills — для node_modules-фолбэка §I).
- `peerDependencies: { react: "^19.0.0", react-dom: "^19.0.0" }`; react/react-dom уходят из deps в devDeps.
- Скрипты: `build:lib` = `vite build --mode lib`; `build` = `build:lib`; `typecheck` = `tsc -b`; `prepare` = `npm run build:lib`; `prepack` дублём. Удалить `practice`, `practice:node`.
- `engines: { node: ">=20" }`, `repository: github:Termin89/shell-kit`.

### A4. Миграция demo + удаление practice
- `src/demo/**`: замена `@/x` → `shell-kit/x`; в `src/demo/main.tsx` — `import "shell-kit/ui/styles.css"`.
- `git rm -r src/practice`.
- Гейт: `npm run dev` работает, `npm run build` (demo) собирается.

### A5. Плагин-манифесты + правка путей в скилах
- `.claude-plugin/plugin.json`: `{ name: "shell-kit", version: "0.1.0", description, author }`.
- `.claude-plugin/marketplace.json`: `{ name: "shell-kit", owner, plugins: [{ name: "shell-kit", source: "./", version }] }`.
- `skills/prototype-to-app/SKILL.md` §I (строки ~137–155): резолв пути в 3 режимах — (а) монорепо: `<root>/skills/<name>/`; (б) плагин: относительно своего местоположения, соседние скилы — сиблинги; (в) фолбэк: `node_modules/shell-kit/skills/<name>/SKILL.md`.
- `skills/feature/SKILL.md:22,64` + `skills/feature/references/project-layer.md:11,43` — тот же трёхрежимный резолв; импорты в примерах: `@/x` → `shell-kit/x`.
- `skills/prototype-to-app/references/phases/design-system.md:122`, `hardening.md:55,57`, `docs/index.html:296` — `shell-kit/skills/<x>` → «скилл `<x>` (резолв §I)».
- Аудит всех 10 скилов на монорепо-механику (после выноса проектов `PROJECT_APP`/`project:*` в проектах не существует, у них свои `npm run build`; скилы в проектах резолвятся через плагин): `module-pass/SKILL.md:91` и `references/playbook.md:78` (PROJECT_APP-сборка), `deploy/references/targets/ssh-nginx.md:79` (`npm run project:<p>:build`), `production/references/env-contract.md:48` (`project:<p>:build:prod`), `prototype-to-app/references/phases/hardening.md:34` и `intake.md:26` (Q3 про `@/`), упоминания `@/ui` в `components/SKILL.md`, `feature/references/ui-rework.md`, `storybook/references/levels.md` — заменить на `shell-kit/ui` либо нейтральную формулировку «пакет/плагин».
- Гейт: `zai plugin validate .` в корне репо.

### A6. CI
- Новый `.github/workflows/ci.yml`: node 24 → `npm ci` → `lint` → `build:lib` → `tsc -b` → `npm pack --dry-run` (проверить список файлов: только dist/skills/README/package.json).
- Валидация манифестов в CI — node-скриптом (10 строк: parse + обязательные ключи + frontmatter у всех SKILL.md); `zai plugin validate` остаётся локальным шагом.

### A7. Доки
- `README.md` rewrite: что это (1 абзац + ссылка MAP.md) → установка (git-dep + peer react) → quickstart 5 минут (Shell + defineModule + ShellProvider + styles.css) → таблица субпутей → скилы (2 команды плагина + MEMORY-фолбэк) → demo (`npm run dev`) → структура репо → разработка (build, версионирование).
- `GETTING-STARTED.md`: end-to-end онбординг потребителя — package.json, tsconfig (`moduleResolution: "bundler"`), vite.config, установка плагина, шаблон раздела скилов для MEMORY.md, первый модуль по образцу demo.
- Коммит + тег `v0.1.0` + push.

---

## Phase B — вынос проектов (u-kon первым, partner-portal вторым)

Для каждого (`~/projects/<name>`):
1. Скопировать каталог (исключая `dist/`, `tmp/`).
2. Свой `package.json`: `private`, deps `shell-kit: "github:Termin89/shell-kit#v0.1.0"`, react, react-dom; devDeps: vite, `@vitejs/plugin-react`, typescript, `@types/*`, `tailwindcss` + `@tailwindcss/vite` (tailwind теперь у проекта); u-kon дополнительно — `vite-plugin-pwa` (PWA-блок переезжает из корневого конфига).
3. Свой `vite.config.ts` (react + tailwind + порт), свои tsconfig (`include: ["src"]`, без `paths`). u-kon: перенести из корневого конфига VitePWA-блок целиком — манифест (start_url/scope от `--base`), workbox-прекэш, иконки из `public/`.
4. Замена в `src/**`: `@/<layer>` → `shell-kit/<layer>`; `@/ui/components.css` → `shell-kit/ui/styles.css`.
5. Сохранить в корне проекта: `.app-build/` (partner-portal), `MEMORY.md` (u-kon), `skills/PROJECT.md`, prototype/, docs.
6. MEMORY.md: раздел «Скиллы платформы» (3-режимный резолв, актуальный список скилов пакета — на момент пересборки их 10).
7. `zai plugin marketplace add ~/projects/shell-kit` → `zai plugin install shell-kit --scope project`.
8. `git init` + коммит + пуш в новый GitHub-репо (создать `Termin89/u-kon`, `Termin89/partner-portal`).
9. u-kon: адаптировать `.github/workflows/deploy-u-kon.yml` (build `npm run build:prod -- --base=/u-kon/`, deploy `dist/`; SSH-секреты пересоздать в новом репо). partner-portal: скрипт `deploy` через `demo-stand deploy dist partner-portal`.

Затем чистка shell-kit:
- `git rm -r projects/`, удалить `.github/workflows/deploy-u-kon.yml`, `PROJECT_APP`-механику, скрипты `project:*`, tailwind devDeps из корня (demo tailwind не использует). Также: VitePWA-блок из корневого `vite.config.ts` и devDep `vite-plugin-pwa` (PWA теперь целиком в u-kon).
- `tsconfig.app.json`: `include: ["src/demo"]`.
- Обновить README/MAP/PLAN под новую раскладку. Коммит.

---

## Phase C — проверка

1. **Lib**: `npm run build:lib` → dist: 11 входов `.js`+`.d.ts`+maps, `ui/components.css`, без demo/practice; `grep -r '"@/' dist/` — пусто (нет незаэкстерналенных алиасов); `npm pack --dry-run` — только нужные файлы.
2. **Потребитель**: свежий vite react-ts + `"shell-kit": "file:../shell-kit"` (проверяет prepare-путь) → импорт из `shell-kit`, `shell-kit/react`, `shell-kit/ui/styles.css` → `tsc --noEmit` + `vite build` зелёные. Потом git-dep → повторить в u-kon.
3. **Плагин**: `zai plugin validate` → marketplace add (локальный путь) → install `--scope project` в partner-portal → новая сессия zai: скилы видны; «продолжи конвейер prototype-to-app» подхватывает существующий `.app-build/state.json` (§B машины).
4. **Обновления**: (а) правка исходника ядра → push → в потребителе `npm update shell-kit` → изменение видно; (б) правка текста скила + bump версии в plugin.json/marketplace.json → push → `zai plugin marketplace update` + update плагина → новая сессия видит новый текст; (в) intake-фаза пишет версию shell-kit из `node_modules/shell-kit/package.json` в `.app-build/state.json`, сессия предупреждает при расхождении с версией плагина.

## Риски

- **vite-plugin-dts + preserveModules**: если dts ложится плоско — `entryRoot: "src"` явно.
- **`@/` внутри dist** ломает потребителя — греп-гейт в C1 обязателен.
- **prepare на git-dep**: требует сеть для установки devDeps ядра при первом install — задокументировать.
- **peer react ^19**: потребители на 18 упадут (намеренно).
- **Секреты u-kon deploy**: пересоздать в новом репо до первого деплоя.
- **npm-имя `shell-kit`**: не проверено на свободность — не публикуем, к релизу проверить.

## Ключевые файлы

- `package.json` — exports, prepare, peerDeps
- `vite.config.ts` — мульти-вход, preserveModules, CSS-копия, demo-алиас
- `tsconfig.lib.json` (новый), `tsconfig.app.json`
- `skills/prototype-to-app/SKILL.md` §I; `skills/feature/SKILL.md` + references; `phases/design-system.md`, `phases/hardening.md`, `docs/index.html`
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (новые)
- `.github/workflows/ci.yml` (новый), `deploy-u-kon.yml` → в u-kon
- `README.md`, `GETTING-STARTED.md` (новый)

---

## Находки разведки (сэкономят время при выполнении)

- **Внутри ядра `@/` используют только 2 файла**: `src/react/context.ts` (`@/core/Shell`) и `src/react/hooks.ts` (`@/core/Shell`, `@/core/types`, `@/storage`). Перевести на относительные импорты до lib-сборки — снимает риск `@/` в `.d.ts` на выходе.
- **demo не использует `@/ui` вообще**, но импорт `shell-kit/ui/styles.css` в main.tsx безопасен: пересечений class names demo CSS и components.css нет (проверено). Это догфудинг css-экспорта.
- **demo имеет внутренние импорты `@/demo/state`** (9 файлов) — при миграции их нужно перевести в относительные (`../../state`), это не публичный API.
- **theme.css обоих проектов импортирует ядро относительным путём**: `@import "../../../../src/ui/components.css"` → при выносе заменить на `@import "shell-kit/ui/styles.css"`.
- **Динамических `import("@/…")` в проектах нет** — только статические (305 вхождений в 247 файлах, пересчёт 2026-09-28).
- **git старый**: `git restore` недоступен, использовать `git checkout --`.
- **WIP FeedCard.tsx** — закоммичен (88fe4b4), незакоммиченных правок нет; вынос берёт всё из git как есть.
