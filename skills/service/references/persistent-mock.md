# Ядро service-слоя: семантика PersistentMock и defineService

Семантика ядра, на которой стоит канон скилла — по исходникам
shell-kit (не по памяти): `src/service/defineService.ts`,
`src/service/types.ts`, `src/service/registry.ts`,
`src/service/context.ts`, `src/storage/persistent.ts`. Зачем читать:
mock.ts и service.ts пишутся против этих контрактов, а грабли
(«правки не появляются», «мутация не видна после F5») почти всегда
— неверная ментальная модель ядра. Живой эталон использования —
сервисы u-kon (organizations, requests, notifications).

## Слои

```
App (services-конфиг: baseUrl, getToken, mockFlags)
  └─ bindServiceContextSource()          ← src/service/context.ts
       └─ getResolveContext() — per-call   свежесть флагов
defineService({ id, strategies })         ← src/service/defineService.ts
  ├─ стратегия mock: XMockService         extends PersistentMock
  └─ стратегия api: XApiService           заглушка NOT_CONNECTED
PersistentMock                            ← src/storage/persistent.ts
  └─ list(): MockList → LS `u-kon:<service>:*` (+ IndexedDB медиа)
```

Ядро знает о service-слое только одну функцию биндинга контекста;
слой не импортирует ядро в рантайме — только типы.

## Контекст (ResolveContext)

Конструктор Shell с конфигом `services` регистрирует источник
контекста (`bindServiceContextSource(provider)`, context.ts);
повторный бинд — предупреждение, последний побеждает. Диспетчеры
дёргают `getResolveContext()` **на каждом вызове метода** — значения
свежие, а не снятые при инициализации: на этом держится мгновенное
переключение моков без reload. Без бинда любой вызов падает:
«передайте services-конфиг (baseUrl, getToken, mockFlags) в
конструктор Shell».

```ts
// src/service/types.ts
export interface ResolveContext<S extends AppState = AppState> {
  readonly baseUrl: string;                       // этап C: REST
  readonly getToken: () => string | undefined;    // этап C: auth
  readonly mockFlags: Readonly<Record<string, boolean>>;
  readonly state: S;                              // scope, права
}
```

Крючки этапа C — `baseUrl` и `getToken`: api-стратегия возьмёт их
в `create(ctx)` для SmartyClient (заголовок авторизации). Моки их
не читают. `state` — текущее состояние Shell (права, окружение).
Сторона App (эталон u-kon App.tsx): `mockFlags` — литерал по
сервису + `...env.mockFlags` (прод/демо-сборки выключают моки
переменными окружения).

## Диспетчер (defineService)

```ts
// src/service/types.ts
export interface ServiceStrategy<TService extends object> {
  readonly id: string;          // "mock" | "api" | ...
  readonly mock?: string;       // ключ флага → реестр (MockPanel)
  available(ctx: ResolveContext): boolean;
  create(ctx: ResolveContext): TService;   // лениво, один раз
}
```

`defineService<TService>` возвращает Proxy, типизированный
интерфейсом сервиса (опечатка в методе ловит компилятором — при
явной аннотации, см. playbook.md). Семантика резолва:

- **Per-call**: каждый вызов метода — свежий `getResolveContext()`
  → первая стратегия с `available() === true`. Смена флага меняет
  реализацию со следующего же вызова.
- **Инстансы кешируются** по id стратегии (Map) и переживают
  переключения: возврат к моку не пересоздаёт класс (LS у мока,
  клиент у api — как застали, так и живёт).
- **`create(ctx)` — лениво, один раз на стратегию**: тяжёлый
  конструктор (сидирование, медиа) не выполняется, пока метод
  не позвали.
- Смена стратегии логируется (`console.info`); пустой список
  стратегий и «ни одна не подошла» — throw с дампом mockFlags.
- Методы оборачиваются прокси: резолв в момент вызова, не доступа;
  чтение свойства (не функции) тоже резолвит — обращение к полю
  инстанса идёт через тот же диспетчер.

## Реестр моков (MockPanel, этап D)

Стратегия с полем `mock: "<ключ>"` при `defineService` попадает в
реестр (`_registerMockStrategy`, registry.ts; дедуп по паре id).
`getMockRegistry()` отдаёт снимок `{serviceId, strategyId, flag}` —
его читает MockPanel этапа D: список сервисов с моками + тумблер,
пишущий `mockFlags[flag]`; диспетчер подхватывает на следующем
вызове. Реестр — единственный автоматический побочный эффект
объявления стратегий.

## PersistentMock: персистентность и пересев

```ts
// src/storage/persistent.ts
export interface PersistentMockOptions {
  readonly service: string;      // тот же id, что в defineService
  readonly schemaVersion: number; // инкремент = сброс + пересев
  readonly collections?: Readonly<
    Record<string, () => readonly object[]>
  >;
  readonly media?: () =>
    readonly MediaSeedEntry[] | Promise<readonly MediaSeedEntry[]>;
}
```

- **Готовность — ленивая и мемоизированная**: первый `ready()`
  запускает init, промис кешируется; все операции MockList ждут его.
  Конструктор синхронный — сидирование выполняется при первом
  обращении к данным, не при создании стратегии.
- **Пересев по версии**: маркер `<project>:<service>:__seeded`
  в LS сравнивается с `String(schemaVersion)`. Не совпал →
  `clearServiceData` + `clearMediaByPrefix("<service>/")` (вычистить
  хвосты, включая медиа) → запись сидов коллекций → `seedMedia` →
  маркер обновлён. Совпал → ничего: пользовательские правки LS
  переживают reload. Отсюда правило канона: изменил сиды/структуру —
  `schemaVersion++`, иначе LS хранит старое (грабли №6 playbook).
- Версия одна на **весь сервис**: инкремент пересеивает все
  коллекции и медиа сразу, точечно пересеять коллекцию нельзя.
- `reset()` — полный сброс (LS + медиа) и пересев заново:
  сбрасывает кеш готовности и ждёт `ready()`.

## MockList: контракт коллекции

```ts
// src/storage/persistent.ts
export interface MockList<T extends { id: string }> {
  all(): Promise<readonly T[]>;          // в порядке записи
  get(id: string): Promise<T | undefined>;
  put(item: T): Promise<void>;           // upsert по id
  remove(id: string): Promise<void>;
  replaceAll(items: readonly T[]): Promise<void>;
}
```

- `put` — **upsert**: существующая запись с тем же id заменяется,
  новая дописывается в конец. Порядок — «в порядке записи»:
  обновлённая запись уезжает в конец; нужный порядок списка
  потребитель задаёт сортировкой сам (requests сортирует по номеру,
  organizations — по рангу + алфавиту). Детерминированные id
  события + upsert = повтор продюсера обновляет, не дублирует.
- `put`/`remove`/`replaceAll` — write-through: пишут в LS сразу
  («создал → F5 → на месте»), никакого диффируемого батчинга.
- `list<T>(name)` типизируется на call-site: `this.list<RequestData>
  ("requests")`; контракт `{ id: string }` обязателен — без id
  upsert невозможен.
- Пустая коллекция без сидов — ленивый паттерн
  `collections: { items: () => [] }`: записи создаёт первая мутация
  (эталон notifications).

## Медиа

`media?: () => MediaSeedEntry[]` — сиды блобов: бандл-URL →
IndexedDB, существующие id **не перекачиваются** (стабильный ref
`<service>/seed-<id>` не плодит дубли при перезапусках). Удаление —
только пересевом по префиксу сервиса; ref может делиться между
записями, GC отдельного блоба ядро не умеет (точка роста, SKILL.md
«D»). Запись хранит MediaRef-строку, не blob — LS остаётся лёгким.
Эталон генерации блобов сидов — messenger/service/seedMedia.ts
(guard ленивой генерации: блобы гарантируются перед отдачей detail —
после ready(), поэтому чистый IDB при живом LS покрыт тем же
гвардом).

## Чекпойнты ядра на один взгляд

| Вопрос | Ответ ядра |
|---|---|
| Когда создаётся инстанс стратегии? | Лениво, при первом вызове метода; один на стратегию |
| Когда читаются флаги моков? | На каждом вызове (per-call) |
| Когда сеются данные? | При первом обращении к данным (ready) |
| Когда происходит пересев? | Маркер `__seeded` ≠ schemaVersion |
| Что пишет put? | Upsert по id, запись в конец, сразу в LS |
| Кто чистит медиа? | Пересев и reset (по префиксу сервиса) |
