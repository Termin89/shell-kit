# Сервисы (service)

Слой доменных сервисов между транспортными деталями (`../transport`) и
контроллерами модулей. Отвечает на вопрос «какая реализация обслуживает
этот вызов»: живой API или мок — и переключает её **на лету**.

## Состав

| Файл | Что в нём |
| --- | --- |
| `types.ts` | `ServiceStrategy`, `ResolveContext`, опции `defineService` |
| `context.ts` | мост к Shell: источник контекста из services-конфига конструктора |
| `defineService.ts` | фабрика ленивых синглтон-диспетчеров (per-call резолв) |
| `registry.ts` | реестр мок-стратегий (для MockPanel, этап D) |

## Контекст

Источник контекста — **services-конфиг конструктора Shell** (решение
в [плане](../../PLAN.md)): никаких глобальных конфиг-модулей, как было
в gemba-walks. Shell с конфигом `services` регистрирует функцию-источник,
диспетчеры дёргают её на каждом вызове:

```ts
const shell = new Shell<AppState, typeof modules>({
  initialState,
  modules,
  services: {
    baseUrl: "https://api.example.com",
    getToken: () => tokenStore.get(),
    mockFlags, // Record<string, boolean>, значения меняются на лету
  },
});
```

`ResolveContext` = `baseUrl` + `getToken` + `mockFlags` + текущее
`state`. Всё, кроме `state`, — примитивы и функции: ядро остаётся
headless, про React слой не знает.

## Диспетчер

`defineService({ id, strategies })` возвращает Proxy, типизированный
интерфейсом сервиса (интерфейс описывается руками):

- **per-call резолв**: каждый вызов метода строит свежий контекст и берёт
  первую стратегию с `available(ctx) === true`. Смена флага мока действует
  со следующего вызова — без перезагрузки и пересоздания сервисов;
- **кеш инстансов не трогается**: инстанс создаётся один раз на стратегию,
  возврат к api переиспользует существующий клиент;
- **пустой список стратегий** — ошибка на этапе описания; «ни одна не
  подошла» — внятная ошибка в рантайме (перечисляет id и текущие флаги);
- мок-стратегии (с полем `mock: "<флаг>"`) попадают в реестр — его читает
  MockPanel этапа D.

```ts
export const ordersService: OrdersService = defineService<OrdersService>({
  id: "orders",
  strategies: [
    {
      id: "mock",
      mock: "orders",
      available: (ctx) => ctx.mockFlags.orders === true,
      create: () => new OrdersMockService(),
    },
    {
      id: "api",
      available: () => true, // безусловный fallback последним
      create: (ctx) => new OrdersApiService(ctx.baseUrl),
    },
  ],
});
```

## См. также

- `../transport` — доставка запросов (тупая труба);
- `../errors` — классификация сбоев, шина, хендлеры;
- `../queries` — кеширующие хуки поверх сервисов.
