---
name: storybook
description: Build and maintain a living component catalog (Storybook or a built-in gallery module) for a shell-kit application — primitives, shared blocks, widgets, and full pages including §48 states and role matrices. Use when the user wants to set up or generate a storybook/component gallery ("собери сторибук", "каталог компонентов", "галерея примитивов", "покрыть компоненты сторями", "показать все состояния страницы", "storybook"), to document the design system after assembly, or to add stories for new components after a feature. Stories are generated from typed props and vm-union branches; integrates with prototype-to-app (design-system phase delegates here) and feature (verify keeps catalog fresh).
---

# /storybook

Каталог компонентов проекта: примитивы → блоки → виджеты → страницы.
**Отдельный подключаемый скилл, а не фаза design-system**: каталог нужен
любому проекту (собранному и руками, и машиной), живёт дольше конвейера
и пополняется после каждой фичи. Фаза design-system лишь делегирует
сюда после сбора фонда (см. §B).

Главная механика: вьюхи платформы — **чистые, на пропсах** (vm из
контроллера), поэтому story = рендер компонента с фикстурой, без
моков контроллеров:
- примитив — props-матрица из типизированных вариантов;
- блок — данные из сидов сервисов;
- виджет — `ShellProvider` + AppState-фикстуры (матрица ролей);
- страница — **ветки vm-union**; §48-набор обязателен.

## A. Флоу: setup → generate → maintain

### 1. setup (однократно, содержательный гейт)

- Проба ФС: `.storybook/`, `**/*.stories.*`, модуль gallery — не
  дублировать существующее.
- Выбор драйвера каталога `<!-- L2: drivers.catalog -->`:
  - **storybook** (дефолт) — реальный Storybook: controls, a11y,
    визуальные тесты; цена — зависимости в проект;
  - **gallery** — встроенный dev-модуль без зависимостей.
  Файлы драйверов: `references/drivers/catalog/<name>.md`.
- Решение: есть `.app-build/` → D-запись + `state.json.drivers.catalog`;
  нет → в docs проекта (MEMORY/PROJECT).

### 2. generate — по уровням

Источник правил — `references/levels.md`: каждому уровню классификатора
— свой декоратор, источник фикстур и обязательный набор stories.
Порядок: примитивы → блоки → виджеты → страницы (от дешёвых к дорогим).

### 3. maintain

- Новые компоненты/ветки vm → stories рядом (скилл feature зовёт
  сюда в verify).
- Фикстуры — из сидов сервисов и реальных vm, не выдуманные: галерея
  не должна разъезжаться с живым приложением.
- Побочный эффект каталога: story = ранний второй потребитель.
  Компонент, который неудобно отрендерить фикстурой (20 пропсов,
  скрытые зависимости) — запах, кандидат на декомпозицию
  (предложением, не правкой в этом скилле).

## B. Интеграции

- **prototype-to-app / design-system**: после реестра DS — опциональное
  делегирование сюда (каталог фонда v1); драйвер читается из
  `state.json.drivers.catalog`.
- **feature / verify**: если каталог существует — stories для новых
  компонентов и веток vm-union.
- Секции каталога = уровни классификатора prototype-to-app.

## C. Изоляция записи

- Разрешено: конфиг каталога, `**/*.stories.*`, (gallery) модуль
  каталога в проекте.
- Запрещено: менять сами компоненты (запахи — предложением),
  state.json вне предписанного дифа.
