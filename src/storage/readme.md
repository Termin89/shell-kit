# Storage (локальная персистентность)

Порт локального хранилища для стратегий сервисов: **данные — localStorage,
медиа — IndexedDB, программный сброс — `clearStorage`**. Решает три задачи:

1. mock-демо с состоянием — мутации write-through переживают перезагрузку
   («создал заявку → F5 → заявка на месте»);
2. медиа без сети — сиды лежат в бандле проекта, при первом старте
   копируются в IndexedDB, дальше стенд работает оффлайн;
3. гигиена — программный сброс (`clearStorage`, `PersistentMock.reset()`)
   и автоматический пересев при смене версии схемы.

Эталонный потребитель — feed в репо u-kon
(github.com/Termin89/u-kon): `src/ui/pages/feed/`.

## Структура

```
src/storage/
  configure.ts   # идентичность приложения: configureStorage({ project })
  data.ts        # JSON-коллекции сервисов в localStorage
  media.ts       # Blob-стор в IndexedDB + MediaRef → objectURL
  clear.ts       # clearStorage: сброс по гранулярности
  persistent.ts  # PersistentMock — база персистентной mock-стратегии
  index.ts       # публичные экспорты слоя
```

Публичный API слоя:

| Экспорт | Назначение |
| --- | --- |
| `configureStorage` / `getStorageConfig` | идентичность приложения |
| `dataCollection` / `clearServiceData` | JSON-коллекции в LS |
| `putMedia` / `getMedia` / `deleteMedia` / `seedMedia` | записи media-стора |
| `resolveMediaUrl` / `peekMediaUrl` | MediaRef → objectURL (кеш на процесс) |
| `clearMediaByPrefix` / `dropMediaDb` / `listMediaProjects` | точечные сбросы (внутрь `clearStorage`) |
| `clearStorage` | программный сброс по гранулярности |
| `PersistentMock` | база персистентной mock-стратегии |

## Модель

Два хранилища — по природе контента:

| | localStorage | IndexedDB |
| --- | --- | --- |
| Что | JSON-коллекции сервисов | Blob'ы (картинки) |
| Объём | килобайты (мок-наборы) | мегабайты |
| Доступ | синхронный | асинхронный |
| Ключ | `<project>:<service>:<collection>` | база `shell-kit-media:<project>`, store `media`, keyPath `id` |

Пространство имён задаёт `configureStorage({ project })` — один раз на
старте приложения (module scope App.tsx, до первого обращения сервисов).
Паттерн — как у `configureQuery`: module-private синглтон; без конфигурации
первое обращение кидает внятную ошибку, замена в рантайме — предупреждение.

Сервисный scope (`<project>:<service>`) несёт версию схемы (`__v`) и
маркер сеяния (`__seeded`): несовпадение версии → автоматический сброс
данных scope и пересев. Инкремент `schemaVersion` при изменении сидов или
структуры — и старые данные у всех сбросятся сами, без ручных миграций.

## API

### configureStorage({ project })

```ts
// App.tsx, до создания сервисов
configureStorage({ project: "u-kon" });
```

### dataCollection(service, collection, schemaVersion)

Коллекция — один ключ LS целиком: мок-наборы малы, атомарная запись проще
per-record ключей. Побочный эффект первого открытия scope с новой версией —
сброс данных scope.

```ts
const cards = dataCollection<readonly FeedCard[]>("feed", "cards", 1);
cards.read();                                    // T | undefined
cards.write(next);                               // JSON.stringify целиком
cards.update((cur) => [...(cur ?? []), item]);   // read-modify-write
cards.clear();
```

Прямой потребитель — `PersistentMock`; вручную в сервисе можно, но обычно
не нужно.

### Медиа

```ts
putMedia({ id, blob, name? });    // → MediaRecord
getMedia(id);                     // → MediaRecord | undefined
deleteMedia(id);                  // + revoke objectURL
seedMedia([{ id, url, name? }]);  // fetch → IDB; существующие id пропускаются
```

**MediaRef** — строка-id записи, конвенция `<service>/<имя>`
(`feed/cover-1`), **или готовый URL** (`http://…`, `https://…`,
`data:…`): URL резолвится насквозь, синхронно и без хранения —
api-стратегия может отдавать прямые ссылки, не скачивая (кеш в IDB
остаётся опцией для офлайна). Префикс сервисного scope используют
точечные сбросы. В доменных данных сервисов медиа хранится именно
MediaRef, а не URL: откуда байты (бандл-сид, сеть, генерация) знает
только storage.

### resolveMediaUrl / peekMediaUrl

MediaRef → objectURL с кешем на процесс: повторные монтирования не мерцают
и не текут — revoke только при delete/clear. `peekMediaUrl` — синхронный
взгляд в кеш (начальный стейт `useMedia`). Несуществующий id → undefined.

### clearStorage(options?)

| Вызов | Что сносит |
| --- | --- |
| `clearStorage({ service })` | LS-ключи scope + медиа по префиксу `<service>/` (текущий проект) |
| `clearStorage({ project })` | все LS-ключи проекта + media-база целиком |
| `clearStorage()` | все проекты (по media-базам + текущий) |

### PersistentMock

База персистентной mock-стратегии для `defineService`:

```ts
super({
  service: "feed",         // тот же id, что в defineService
  schemaVersion: 1,        // инкремент при изменении сидов/структуры
  collections: { cards: () => CARDS_SEED, posts: () => POSTS_SEED },
  media: () => MEDIA_SEED, // [{ id: "feed/…", url: BASE_URL + "media/feed/…" }]
});
```

Наследник дёргает защищённые методы в методах интерфейса сервиса:

```ts
protected ready(): Promise<void>                        // ленивый init: версия → пересев
protected list<T extends { id: string }>(name): MockList<T>
async reset(): Promise<void>                            // полный сброс + пересев
```

`MockList`: `all / get / put (upsert) / remove / replaceAll` — все ждут
`ready()` и пишут в LS сразу (write-through). Инициализация идемпотентна:
промис `ready()` кешируется, повторные вызовы не пересеивают. Смена версии
между запусками вычищает хвосты, включая медиа (`clearMediaByPrefix`),
и сеет заново.

### useMedia (react-слой)

```tsx
const cover = useMedia(post.cover); // string | undefined
<img src={cover} alt={post.title} … />
```

Первый рендер — синхронный peek (нет мерцания при повторных монтированиях),
дальше асинхронный резолв кадром позже. `undefined` и для несуществующего
id — картинки «догружаются», вьюха решает, что показать вместо.

## Полный пример (паттерн feed)

```ts
// service.ts — фрагмент
const BASE = import.meta.env.BASE_URL;

class FeedMockService extends PersistentMock implements FeedService {
  constructor() {
    super({
      service: "feed",
      schemaVersion: 1,
      collections: { cards: () => CARDS, posts: () => POSTS },
      media: () => MEDIA_SEED, // cover-…/section-…/logo-…/av-… — SVG в public/media/feed/
    });
  }
  async listCards() { return this.list<FeedCardData>("cards").all(); }
  async getPost(id: string) { return this.list<FeedPostData>("posts").get(id); }
  async putCard(card: FeedCardData) { await this.list<FeedCardData>("cards").put(card); }
}

export const feedService: FeedService = defineService<FeedService>({
  id: "feed",
  strategies: [
    { id: "mock", mock: "feed",
      available: (ctx) => ctx.mockFlags.feed === true,
      create: () => new FeedMockService() },
    { id: "api", available: () => true,
      create: (ctx) => new FeedApiService(ctx.baseUrl) },
  ],
});
```

Вьюха:

```tsx
function FeedCard({ card }: { card: FeedCardData }) {
  const cover = useMedia(card.cover);
  return <img src={cover} alt={card.title} loading="lazy" />;
}
```

Сценарий «демо оффлайн»: первый старт (сеть есть) → сиды скопированы в
IndexedDB → дальше стенд работает без сети, мутации переживают F5,
`reset()` возвращает исходное состояние.

## Не только мок: тот же механизм — кеш продакшена

`PersistentMock` — один потребитель слоя, и «Mock» в имени — про сиды,
не про хранение. Сам механизм персистентности нейтрален и рассчитан на
продакшен-использование:

- **Медиа** — готово как есть, двумя путями: api-стратегия либо
  отдаёт прямые URL (MediaRef с `http(s)://` — `useMedia` проводит их
  насквозь), либо кладёт скачанные байты в стор через `putMedia`
  (офлайн-кеш, мгновенные повторные показы, меньше трафика). Вьюхи и
  `useMedia` не меняются вовсе.
- **Данные** — `dataCollection` работает как read/write-through кеш
  ответов API. Отличие от мока — в семантике: для мока LS и есть
  источник правды, для кеша правда на сервере — нужны правила
  инвалидации (TTL или invalidate по мутациям, порт queries уже
  оперирует ключами). Авто-сброс по `schemaVersion` — бонус кешу:
  деплой новой версии сам чистит устаревшее.

Когда api-кеш появится по-настоящему (этап C, transport), из
`PersistentMock` выделится нейтральная база (scope + версия + `list`),
а мок станет надстройкой с сидами и пересевом. До второго потребителя
абстракцию не режем.

## Инварианты и границы

- В storage ходят **только стратегии сервисов** — mock сейчас, api-кэш
  потом. Pages/hooks/controllers не знают ни ключей LS, ни IndexedDB.
- Вьюхи не резолвят медиа сами: MediaRef → src только через `useMedia`
  react-слоя (вне React — `resolveMediaUrl`).
- LS — малые JSON; всё тяжёлое — Blob'ы в IDB. Картинку в LS не кладём.
- Сервису медиа не нужны → storage не трогается вовсе.
- Слой браузерный (localStorage/IndexedDB), SSR не предполагает.

## См. также

- `../service` — диспетчер стратегий, куда встаёт персистентный мок;
- `../react` — хук `useMedia` (MediaRef → src для `<img>`);
- эталон миграции — репо u-kon (github.com/Termin89/u-kon):
  `src/ui/pages/feed/service/` и `docs/modules/feed.md`.
