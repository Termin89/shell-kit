# React-адаптер

Слой, связывающий независимое ядро `core/Shell` с React. Не содержит
бизнес-логики и UI-компонентов — только провайдер, хуки и рендерер модулей.
Всё, что умеет адаптер, делегируется ядру: он лишь переводит событийную модель
Shell в реактивную модель React.

## Структура

```
src/react/
  context.ts          # React-контекст с экземпляром Shell
  ShellProvider.tsx   # Провайдер: помещает Shell в контекст
  hooks.ts            # Хуки доступа к ядру + useMedia (медиа storage-слоя)
  ModuleRenderer.tsx  # Рендер модуля по маршруту (Suspense + Error Boundary)
  ShellGate.tsx       # Гейт инициализации: splash/ошибка до ready
  module-lazy.ts      # Внутренний кеш lazy-компонентов модулей
  index.ts            # Публичные экспорты адаптера
```

## Контракт модуля

React-адаптер понимает три формы экспорта из `load()`:

```tsx
export default ModuleA;          // 1. default — рекомендуемый способ
export const Component = ModuleA; // 2. именованный Component
export default () => <div/>;      // 3. сам модуль является компонентом
export default defineModule({     // 4. контракт ShellModule — берётся view
  page: { component: CatalogPage, controller: useCatalogProps },
});
```

Форма 4 — рекомендуемая для полноценных модулей: она разделяет чистую
вьюху и бизнес-часть, см. [../module/readme.md](../module/readme.md).

Если экспорт не похож на компонент, загрузка завершается ошибкой
`Module "id" did not export a React component`.

## API

### ShellProvider

Принимает **готовый** экземпляр `Shell` (созданием занимается приложение) и
делает его доступным всем хукам ниже по дереву.

```tsx
const shell = new Shell({ initialState: { scope: "user" }, modules });
root.render(
  <ShellProvider shell={shell}>
    <App />
  </ShellProvider>,
);
```

### useShell()

Экземпляр ядра — для вызовов, у которых нет отдельного хука
(`setState`, `registerModule`, `loadModule`…). Бросает ошибку вне провайдера.

```tsx
const shell = useShell();
shell.setState({ scope: "admin" });
```

### useShellState()

Глобальное состояние приложения. Под капотом `useSyncExternalStore`:
компонент перерендеривается только при изменении состояния.

```tsx
const { scope } = useShellState();
```

Важно: активность модулей вычисляется ядром из состояния (`enabled(state)`),
поэтому хуки, зависящие от набора модулей, подписаны именно на состояние.

### useRoute() / useNavigate()

Текущий путь и программная навигация. Роутинг остаётся событийным —
синхронизация с History API — задача приложения или отдельного плагина.

```tsx
const route = useRoute();
const navigate = useNavigate();
<button onClick={() => navigate("/b")}>/b</button>;
```

### useActiveModules()

Активные модули в виде проекции `{ id, routes, loaded }` — без внутренних
полей ядра (`exports`, `error`, `load`). Удобно для навигации и статус-баров.
У модулей без `routes` (сервисных) поле нормализуется в пустой массив —
в навигацию они не попадают.

```tsx
const routes = useActiveModules().flatMap((m) => m.routes);
```

### useActiveModuleComponent(path)

Lazy-компонент активного модуля, владеющего путём, либо `null`.
Обычно используется не напрямую, а через `ModuleRenderer`.

### useShellStatus()

Статус инициализации ядра: `idle | bootstrapping | ready | error`.
Если приложение не вызывает `shell.bootstrap(...)`, статус навсегда `idle`
и хук ничего не меняет. Подписка — на `onStatusChange` ядра.

### useMedia(ref)

Медиа из storage-слоя → URL для `<img src>`. Принимает `MediaRef` —
непрозрачную ссылку на запись media-стора (IndexedDB), возвращает
objectURL либо `undefined`, пока URL не готов.

```tsx
import { useMedia } from "@/react";

function FeedCard({ card }: { card: FeedCardData }) {
  const cover = useMedia(card.cover);
  return <img src={cover} alt={card.title} loading="lazy" />;
}
```

Механика в два такта:

- **первый рендер — синхронный peek** в процессный кеш objectURL:
  повторные монтирования (возврат на экран, смена фильтров) не мерцают;
- **при промахе кеша** — эффект асинхронно резолвит запись из IndexedDB
  (blob → `createObjectURL`, кеш на процесс) и обновляет стейт кадром
  позже; размонтирование отменяет запись (`active`-флаг), `undefined`
  в пропе сбрасывает стейт.

`undefined` — нормальное значение: и пока картинка догружается, и для
несуществующего id — вьюха решает, что показать вместо (плейсхолдер,
пустой alt). Готовые URL (`http(s)://`, `data:`) в MediaRef проходят
насквозь синхронно, стора не требуют. Кеш живёт на процесс, а не на
компонент: revoke objectURL только при удалении записи или сбросе
хранилища, поэтому повторные монтирования не отбирают URL у показанных
картинок и не текут.

Инвариант: вьюха не знает, откуда байты (бандл-сид, сеть, генерация) —
она знает токен; кто кладёт байты в стор, решает стратегия сервиса
(`PersistentMock`-сид или api). Хранилище целиком — в
[../storage/readme.md](../storage/readme.md).

### ShellGate

Ворота инициализации: решают, что показывать, пока `bootstrap` работает или
упал. `idle`/`ready` пропускают детей без изменений, `bootstrapping`
показывает `fallback`, `error` — рендер-проп `error(error, retry)` (кнопка
Retry перезапускает инициализацию через `retryBootstrap`).

```tsx
const shell = new Shell({
  initialState: { scope: "guest" }, // доинициализационное состояние
  modules,
  initialPath: "/catalog",
});
shell.bootstrap(restoreSession); // асинхронная проверка сессии

root.render(
  <ShellProvider shell={shell}>
    <ShellGate
      fallback={<Splash />} // пока идёт инициализация
      error={(error, retry) => (
        <BootError error={error} onRetry={retry} />
      )}
    >
      <App /> {/* idle / ready */}
    </ShellGate>
  </ShellProvider>,
);
```

Оба пропа опциональны — есть нейтральные дефолты (текст + кнопка
«Повторить»). Пока статус `bootstrapping`, ядро держит активный набор
модулей пустым, поэтому весь UI приложения за гейтом в это время
в любом случае «пустой».

## ModuleRenderer

Рендерит модуль текущего (или переданного) пути и закрывает два состояния:

- **загрузка** — `React.lazy` + `Suspense`, показывается `fallback`;
- **ошибка** — Error Boundary, показывается `errorFallback(error, retry)`.

### pageTransition — появление страницы (enter-only)

Смена модуля может проигрывать CSS-анимацию появления: рендерер ставит
`data-page-enter="<имя>"` на обёртку контента, анимирует CSS. Реализация
варианта — компонентные классы ядра (`fade`, `fade-up`, `scale` —
components.css) или своя (правило по атрибуту в theme.css проекта);
длительность/кривая — токены `--page-enter-duration/--page-enter-easing`.
Только transform/opacity (композитор), `prefers-reduced-motion` отключает
анимацию на уровне CSS. Первый вход в приложение не анимируется; смена
модуля пересоздаёт поддерево по ключу — анимация перезапускается сама.
Без пропа обёртка не рендерится (ноль накладных расходов).

```tsx
// Один вариант на все модули
<ModuleRenderer pageTransition="fade-up" />

// Резолвер per-module: свой вариант у отдельных модулей + дефолт
<ModuleRenderer
  pageTransition={(id) => overrides[id] ?? "fade"}
/>
```

### loadingDelay — минимальное время показа загрузчика

Демо/UX-режим: при смене модуля `fallback` (загрузчик) показывается
не меньше `loadingDelay` мс, контент — по истечении задержки. Чанк
нового модуля греется сразу (`shell.loadModule` в фоне), поэтому
задержка не суммируется с реальной загрузкой: на медленной сети
загрузчик просто живёт дольше. Действует только на переключения между
показами модулей — первый показ (вход в приложение, включая
асинхронное появление activeModule после bootstrap), retry и уход
в notFound идут без задержки. `0` / `undefined` — механизм выключен,
накладных расходов нет.

```tsx
<ModuleRenderer fallback={<BrandLoader />} loadingDelay={350} />
```

```tsx
<ModuleRenderer
  path={optionalCustomPath}
  fallback={<div>Загрузка модуля…</div>}
  notFound={<div>Маршрут не обслуживается ни одним модулем</div>}
  errorFallback={(error, retry) => (
    <div role="alert">
      {error.message}
      <button onClick={retry}>Retry</button>
    </div>
  )}
/>
```

Как работает Retry: `React.lazy` кеширует rejected promise, поэтому простой
сброс границы ошибки не помог бы. Адаптер при ошибке удаляет модуль из кеша
`module-lazy`, а `ModuleRenderer` пересоздаёт Error Boundary по ключу —
следующая попытка заново вызывает `loadModule`. Ядро неудачные попытки не
кеширует, так что Retry действительно перезагружает модуль.

## Внутреннее устройство: module-lazy.ts

- Кеш lazy-компонентов — `WeakMap<Shell, Map<id, LazyComponent>>`:
  стабильная идентичность компонента между рендерами (без лишних
  пересозданий и повторных suspend), кеш не переживает инстанс Shell.
- Резолвер экспортов модуля — три формы контракта (см. выше).

## Полный пример

```tsx
// modules.ts — конфигурация модулей приложения
const modules: ModuleConfig[] = [
  {
    id: "catalog",
    load: () => import("./modules/Catalog"), // код-сплит чанк
    routes: ["/catalog"],
    preload: true,
  },
  {
    id: "admin",
    load: () => import("./modules/Admin"),
    routes: ["/admin"],
    enabled: ({ scope }) => scope === "admin",
  },
];

// App.tsx
const shell = new Shell({
  initialState: { scope: "user" },
  modules,
  initialPath: "/catalog",
});

export default function App() {
  return (
    <ShellProvider shell={shell}>
      <Layout />
    </ShellProvider>
  );
}

function Layout() {
  const navigate = useNavigate();
  const routes = useActiveModules().flatMap((m) => m.routes);

  return (
    <div>
      <nav>
        {routes.map((r) => (
          <button key={r} onClick={() => navigate(r)}>{r}</button>
        ))}
      </nav>
      <main>
        <ModuleRenderer notFound={<p>Маршрут неизвестен</p>} />
      </main>
    </div>
  );
}
```

Модуль — обычный React-компонент, которому доступны все хуки адаптера:

```tsx
// modules/Catalog/Catalog.tsx
import { useShellState } from "@/react";

export default function Catalog() {
  const { scope } = useShellState();
  return <p>Каталог. Текущий scope: {scope}</p>;
}
```

## Заметки и ограничения

- Экземпляр `Shell` создаётся приложением (один на приложение), провайдер
  только раздаёт его через контекст.
- Типизация расширенного состояния: ядро поддерживает `Shell<S>`, хуки
  адаптера работают с базовым `AppState` — приложение сужает тип одной
  обёрткой (`useAppShellState`), см. [../core/state.md](../core/state.md).
- `useShellState` и `useRoute` передают серверный снапшот в
  `useSyncExternalStore`, так что базовая SSR-совместимость есть;
  синхронизацию состояния клиент/сервер адаптер не навязывает.
- Деактивация модуля на текущем маршруте — не ошибка: `ModuleRenderer`
  покажет `notFound`.
- Адаптер не синхронизируется с History API и не заменяет роутер:
  навигация через `useNavigate` меняет путь в ядре, а работает ли при этом
  кнопка «назад» — решает интеграция уровня приложения.
