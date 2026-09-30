# shell-kit — issues

Milestone'ы = этапы из PLAN.md. «Зависит» — номера issues ниже.

## A1 — Выпилить навигацию из ядра Shell
**метки:** core · этап A · зависит: —

Ядро отвечает только за видимость: реестр, `enabled`, bootstrap, `loadModule`.
Удалить `navigate`/`getPath`/`onRouteChange`/`ModuleConfig.routes` и exact-матчинг
`useActiveModuleComponent`. `ModuleRenderer` принимает `moduleId`; активный
модуль — состояние layout'а. Демо: Nav на кнопках активных модулей, кейсы
«неизвестный маршрут»/«один маршрут два модуля» переформулировать (выбор из
доступных, взаимоисключающие `enabled`).

- [x] ядро не содержит ни одного упоминания путей/маршрутов
- [x] `ModuleRenderer` рендерит по `moduleId`, notFound — когда модуль не активен
- [x] демо работает без routes, все кейсы переформулированы и проходят (сборка проверена)

## A2 — Auth-ветка unauthenticated в bootstrap
**метки:** core, react · этап A · зависит: —

Bootstrap различает «упало» (retry) и «неавторизован» (нужен логин): статус
`unauthenticated` + слот auth-компонента в конфиге Shell. `ShellGate` рендерит
auth-слот; успешный логин продолжает/перезапускает bootstrap.

- [x] `ShellStatus` расширен, `ShellGate` рендерит auth-слот (рендер-проп
  `unauthenticated`, не в конфиге Shell — ядро headless, компонентов не держит)
- [x] демо-кейс: сессии нет → auth-экран → «логин» → приложение (`?anon`)

## B1 — Порт transport
**метки:** services · этап B · зависит: —

Перенос `src/transport` из gemba-walks: `TransportResponse<T>`, `TransportError`
+ подклассы (network/timeout/http/parse), `HttpTransport`. Без изменений,
в стилистике shell-kit.

- [x] файлы перенесены, типы совпадают с gemba-walks
- [ ] юнит-тесты на маппинг fetch-ошибок → TransportError

  тесты отложены: тест-раннер в этапе B не вводится (решение сессии),
  поведение проверено кейсами демо

## B2 — Порт errors
**метки:** services · этап B · зависит: B1

Classifier (ErrorKind, lookup-таблицы), bus, хендлеры (auth/toast/network).
Без изменений; классификатор TransportError — прямой импорт transport.

- [x] перенесено, публичный API как в gemba-walks `core/errors`
- [ ] тест: TransportError → classify → bus → хендлер

  тесты отложены (см. B1); путь ошибки проверен кейсом демо «Заказы»

## B3 — Порт queries
**метки:** services · этап B · зависит: B2

QueryPort, SelfRolledAdapter, `configureQuery`, `useServiceQuery` /
`useServiceMutation`. Без изменений.

- [x] перенесено
- [ ] тесты: дедупликация параллельных запросов, invalidate по префиксу

  тесты отложены (см. B1); invalidate по префиксу проверен кейсом демо
  (мутация статуса → invalidate ["orders"] → перечитка)

## B4 — defineService: диспетчер + конфиг в Shell
**метки:** services · этап B · зависит: B3

`ServiceStrategy`/`ResolveContext` с адаптацией: контекст (`baseUrl`,
`getToken`, `mockFlags`, state) — из `services`-конфига конструктора Shell.
`defineService({ id, strategies })` возвращает ленивый синглтон-диспетчер:
каждый вызов метода резолвит реализацию по текущим флагам; регистрирует
мок-стратегии в реестре (для MockPanel).

- [x] `services` в конструкторе Shell прокидывается в стратегии
- [x] диспетчер per-call: смена флага меняет реализацию без пересоздания
- [ ] тесты: порядок стратегий, пустой список → внятная ошибка

  тесты отложены (см. B1); порядок стратегий и переключение на лету
  проверены кейсом демо (лог диспетчера в консоли), пустой список
  стратегий — ошибка в defineService

## B5 — Демо-модуль на полном стеке
**метки:** demo · этап B · зависит: B4

Модуль: сервис (api + mock стратегии), контроллер на `useServiceQuery`, чистая
вьюха на пропсах, ошибка проходит путь TransportError → classify → bus →
toast-хендлер + локальный `error`.

- [x] кейсы в демо: загрузка данных, ошибка сети с retry, invalidate после мутации

## C1 — SmartyClient: endpoint-map + интерсепторы
**метки:** smarty-client · этап C · зависит: B1

`defineEndpoints({...})` — ручки как данные. `SmartyClient({ baseUrl,
transport, interceptors })`: интерцепторы request/response; примеры
`authRequest(getToken)`, `traceRequest()`. Транспорт — тупая труба, TransportError
наверх нетронутым. Типы руками.

- [ ] демо-модуль B5 ходит через SmartyClient с двумя интерцепторами
- [ ] тест: интерцептор добавляет заголовок; transport не знает про интерцепторы

## D1 — createMockStore: флаги + seed per-service
**метки:** runtime-mock · этап D · зависит: B4

Стор: приоритет URL > localStorage > env, подписка на изменения, seed
per-service, seeded-RNG-хелпер для детерминированных данных.

- [ ] флаг из URL бьёт localStorage, тот бьёт env
- [ ] одинаковый seed → одинаковые мок-данные

## D2 — MockPanel отдельным экспортом
**метки:** runtime-mock · этап D · зависит: D1

Панель: список сервисов с мок-стратегиями (реестр B4), тумблер, поле seed.
Монтирует consumer (dev/QA/демо); отдельный вход в exports-map.

- [ ] тумблер в демо переключает сервис модуля без перезагрузки страницы
- [ ] панель не попадает в бандл, пока её не импортировали

## E1 — Codegen CLI
**метки:** codegen · этап E · зависит: B3, B4

CLI парсит интерфейсы сервисов (ts-morph), пишет `hooks.gen.ts` рядом с
`service.ts`. Конвенции: `get*/find*/list*/load*` → query-хук
(`[serviceId, метод, ...args]`), остальное → mutation; `@query`/`@mutation`
override; `@invalidates team` → авто-инвалидация. Идемпотентно, `.gen.ts` в гите.

- [ ] сгенерированные хуки зовут диспетчер (моки действуют)
- [ ] повторный запуск без изменений = пустой диф
- [ ] демо-модуль полностью на сгенерированных хуках

## F1 — Порт permissions
**метки:** permissions · этап F · зависит: —

`computePermissions` из gemba-walks; в демо — `enabled`-предикат на правах
(отдельного механизма в ядре нет).

- [ ] демо-кейс: модуль скрыт без права

## F2 — README + стайлгайд + релиз v0.1
**метки:** docs, release · этап F · зависит: все

Quickstart, схема слоёв, CONTRIBUTING со стайлгайдом (JSDoc с примерами,
`_`-префикс, lookup-таблицы, алфавитные импорты, секционные разделители).
Решить npm-имя и реестр.

- [ ] quickstart воспроизводится в чистом vite-приложении
