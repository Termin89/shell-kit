# shell-kit — план развития

Принято: shell-kit — основа библиотеки модульных приложений. Каждый слой прошёл
разбор «решает ли абстракция проблему»; решения зафиксированы ниже. Готовность
этапа = работает в `demo/`.

## Реестр решений

| Слой | Решение |
|---|---|
| Shell | headless-ядро; цель — **только резолв видимости модулей**, не роутинг |
| Навигация | выпиливается из ядра (`navigate`/`getPath`/`routes`/exact-матчинг); какой модуль рендерить решает layout/consumer |
| Скоупы | per-module `enabled(state)`; централизованный `resolveScope` не вводим |
| Активный модуль | обязательное поле `state.activeModule: string \| null`; запись — `shell.setActiveModule(id)` (union id выводится из конфига модулей: дженерик `Shell<S, TModules>` + `as const satisfies`; рантайм-проверка по реестру); `ModuleRenderer` без пропа читает из состояния; ядро поле не интерпретирует |
| Entry-модуль | state-driven: bootstrap патчит `state.entryModule`; layout — `activeModule ?? entry (если активен) ?? первый активный`. В ядре механизма нет |
| Слоты (одно место — разные модули) | в ядре механизма нет. Критерий границы модуля: модуль = домен + владение, не гранулярность вьюхи. Варианты одного домена (детализация по правам) — внутри модуля: entry-switch по состоянию + lazy-чанки, грузится только нужный. Разные домены/владельцы — отдельные записи реестра, группировка в навигации — конфиг layout'а |
| Auth | ветка `unauthenticated` в bootstrap: init бросает `UnauthenticatedError`; auth-слот — рендер-проп `unauthenticated` у ShellGate (ядро headless, компонентов не держит); после логина — `retryBootstrap()` |
| Module | `defineModule({ page: { component \| variants, controller }, service })`: варианты вьюх — резолв по пропсам контроллера (`when`, без when — дефолт) — готово |
| Services | `defineService` — ленивый синглтон-**диспетчер**: реализация выбирается per-call по текущим флагам (переключение мока мгновенное, кеш инстансов не трогаем); мок-стратегия помечается `mock: "<флаг>"` и попадает в реестр (`getMockRegistry`) для MockPanel |
| Конфиг сервисов | в конструктор Shell: `services: { baseUrl, getToken, mockFlags }` |
| SmartyClient | endpoint-map (`defineEndpoints`), интерсепторы в клиенте (транспорт — тупая труба), типы руками |
| Моки | флаги + seed **per-service**; приоритет URL > localStorage > env; `MockPanel` отдельным экспортом, монтирует consumer |
| Codegen | парсит **интерфейсы сервисов** (хуки зовут диспетчер → моки работают); `get*/find*/list*/load*` → query, остальное mutation, `@query`/`@mutation` — override; генерируются только хуки, контроллер руками |
| Хуки (runtime) | `useServiceQuery` / `useServiceMutation` — перенос из gemba-walks без изменений |
| Solid-адаптер | слой `src/solid` (2026-10-01, зеркалит react): провайдер/гейт/рендерер/хуки + router/queries-связки; framework-free ядра (router/queries) переиспользуются as-is (solid импортирует их из файлов, не из React-реэкспортирующих index-ов); queries — **ручной порт** React-версии, не createProjection — семантический паритет важнее идиоматики; UI-примитивы не портируются; вторая lib-сборка `build:lib-solid` пишет **только** `dist/solid` (чанки общих модулей отбрасываются — react-часть диста не меняется); `solid-js`/`@solidjs/web` (`2.0.0-rc.13`, стабильного 2.x нет) — optional peers: react-потребители solid не ставят |
| Errors | classifier + bus + handlers — перенос без изменений |
| Permissions | порт `computePermissions`; используются внутри `enabled`-предикатов, отдельного механизма в ядре нет |

Отложенные вопросы: apiMode (user/external/staff) — не решаем, контракт
позволяет выразить и несколькими endpoint-map'ами, и несколькими стратегиями;
слоты в ядре (`slot?` в ModuleConfig) — только если появится реальный кейс
разных владельцев на одном месте layout'а (критерий — в реестре решений);
npm-имя пакета и реестр публикации — к релизу.

## Структура после доработки

```
src/
  core/           ядро shell (чистка от навигации, auth-ветка)
  react/          адаптер (ModuleRenderer по moduleId)
  module/         defineModule — готово
  service/        defineService, диспетчер, ServiceStrategy
  transport/      порт из gemba-walks (types, errors, HttpTransport)
  errors/         порт (classifier, bus, handlers)
  queries/        порт (QueryPort, SelfRolledAdapter, hooks)
  smarty-client/  endpoint-map + интерсепторы
  runtime-mock/   createMockStore + MockPanel (панель — отдельный вход)
  permissions/    порт computePermissions
tools/codegen/    CLI автогенерации хуков (не входит в рантайм)
demo/
```

## Этапы

### Этап A — Чистка ядра

**Цель:** ядро = реестр + видимость + bootstrap, ничего про маршруты.

- Выпилить из `core/Shell.ts`: `navigate`, `getPath`, `onRouteChange`,
  `ModuleConfig.routes`, exact-матчинг в `useActiveModuleComponent`.
- `ModuleRenderer` рендерит по `moduleId` (проп). Активный модуль — состояние
  layout'а, не ядра. Сервисные модули = просто модули, которые никто не рендерит.
- Auth-ветка: `bootstrap` различает «упало» и «неавторизован»; статус
  `unauthenticated` + слот auth-компонента; после логина — продолжение
  bootstrap. `ShellGate` рендерит auth-слот.
- Демо: Nav на кнопках активных модулей; кейсы переформулировать без маршрутов.

### Этап B — Services-слой (порт из gemba-walks)

Порядок по цепочке зависимостей:

1. `transport/` — `TransportResponse<T>`, `TransportError` + подклассы
   (network/timeout/http/parse), `HttpTransport`. Без изменений.
2. `errors/` — classifier (ErrorKind, lookup-таблицы), bus, хендлеры
   (auth/toast/network). Без изменений.
3. `queries/` — QueryPort, SelfRolledAdapter, `configureQuery`,
   `useServiceQuery`/`useServiceMutation`. Без изменений.
4. `service/` — `ServiceStrategy` + `ResolveContext` с адаптацией: контекст
   берётся из `Shell` (`services` в конструкторе), не из глобального модуля.
   `defineService({ id, strategies })` → ленивый диспетчер: методы резолвят
   реализацию per-call, реестр мок-стратегий — для MockPanel.
5. Демо-модуль на полном стеке: сервис (api + mock стратегии), контроллер на
   `useServiceQuery`, чистая вьюха на пропсах.

### Этап C — SmartyClient

- `defineEndpoints({...})` — типизированный endpoint-map (ручки как данные).
- `SmartyClient({ baseUrl, transport, interceptors })`; интерцепторы
  request/response, примеры `authRequest(getToken)`, `traceRequest()`.
- Транспорт остаётся тупой трубой: TransportError уходит наверх нетронутым,
  классификация — в errors-слой.
- Демо: модуль этапа B переводим на SmartyClient (можно публичное API).

### Этап D — Runtime-mock

- `createMockStore()` — флаги + seed per-service, приоритет
  URL > localStorage > env, подписка на изменения.
- `MockPanel` — отдельный subpath-экспорт: список сервисов с мок-стратегиями
  (из реестра этапа B), тумблер, поле seed. Монтирует consumer.
- Seed-хелпер (seeded RNG) для детерминированных мок-данных.
- Демо: тумблер переключает сервис модуля без перезагрузки (диспетчер per-call).

### Этап E — Codegen

- CLI (`tools/codegen`): парсит интерфейсы сервисов (ts-morph), рядом с
  `service.ts` пишет `hooks.gen.ts`.
- Конвенции: `get*/find*/list*/load*` → query-хук с ключом
  `[serviceId, метод, ...args]`; остальное → mutation; `@query`/`@mutation` —
  override; `@invalidates team` → авто-инвалидация префикса после мутации.
- Идемпотентно; `.gen.ts` в гите — дифы видны в ревью.
- Демо: модуль полностью на сгенерированных хуках.

### Этап F — Permissions + релиз

- Порт `computePermissions` из gemba-walks; в демо — `enabled`-предикат на правах.
- README (quickstart, схема слоёв), стайлгайд в CONTRIBUTING (перенос конвенций
  из gemba-walks: JSDoc с примерами, `_`-префикс, lookup-таблицы, алфавитные
  импорты, секционные разделители).
- Решить: npm-имя, реестр публикации. v0.1.

## Порядок

A → B (1→2→3→4→5) → C → D → E → F. C зависит от B1; D — от B4; E — от B3/B4.

## Идеи (TODO)

### `widgetDefine` / `subModuleDefine` — виджеты с конфиг-видимостью и зонами

Идея (2026-08-27, из кейса ролей u-kon: «своя карточка», «входящие
запросы» сейчас зашиты в контроллеры страниц): распространить механизм
`enabled(state)` из реестра страниц на виджеты/подмодули внутри страницы.

- `widgetDefine` — регистрация виджета с конфигом видимости
  (`enabled(state)`: роль, кейс, права) — как у записей страниц.
- Страница-хост в типах объявляет **зоны** (`zones: { toolbar, aside, … }`):
  компонент модуля экстендит тип «компонент с зонами», куда фреймворк
  подсасывает включённые виджеты (lazy-чанки, порядок — конфиг).
- Отличие от отложенных «слотов» в ModuleConfig (разные владельцы на одном
  месте layout'а): здесь слот внутри одного модуля, владелец один — критерий
  границы модуля не ломается.

Критерий старта тот же, что у слотов: 2–3 реальных кейса, не раньше.
