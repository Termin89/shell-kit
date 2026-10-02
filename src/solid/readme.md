# solid — Solid 2-адаптер

Связки headless-ядра Shell для Solid 2 (`solid-js@2.0.0-rc.*`, dist-tag
`next`). Логика — вся в framework-free ядре (`src/core`, `src/router`,
`src/queries`); этот слой — только идиоматика Solid: провайдер контекста,
гейт, рендерер модулей и хуки. Один вход — `shell-kit/solid` (реэкспортирует
и router/queries-ядра, React не тянется).

## Установка

Solid — optional peer: React-потребители библиотеку не ставят,
Solid-приложение ставит само (стабильного 2.x нет — сидим на RC):

```bash
npm install github:Termin89/shell-kit#vX.Y.Z solid-js@next @solidjs/web@next
```

В `tsconfig.json` приложения: `"jsx": "preserve"`,
`"jsxImportSource": "@solidjs/web"` (JSX-типы и DOM-рендер в 2.0 —
в `@solidjs/web`).

## Провайдер

```tsx
import { render } from "@solidjs/web";
import { Shell } from "shell-kit/core";
import {
  ModuleRenderer,
  RouterProvider,
  ShellGate,
  ShellProvider,
  connectRouter,
  createBrowserHistory,
} from "shell-kit/solid";

const shell = new Shell({ initialState, modules });
const router = connectRouter(shell, createBrowserHistory());

render(
  () => (
    <ShellProvider shell={shell}>
      <RouterProvider port={router.port}>
        <ShellGate>
          <ModuleRenderer loadingDelay={300} pageTransition="fade" />
        </ShellGate>
      </RouterProvider>
    </ShellProvider>
  ),
  document.getElementById("root")!,
);
```

## Хуки

| Хук | Что даёт |
|---|---|
| `useShell()` | экземпляр Shell (setState, setActiveModule, …) |
| `useShellState()` | `Accessor<AppState>` глобального состояния |
| `useShellStatus()` | `Accessor<ShellStatus>` статуса bootstrap |
| `useActiveModules()` | `Accessor<{ id, loaded }[]>` активных модулей |
| `useMedia(() => ref)` | `Accessor<string \| undefined>`: MediaRef → URL (синхронный peek, без мерцания) |
| `useNavigate()` | `(path, { replace? }) => void` — полный путь |
| `usePath()` | `Accessor<string>` текущий путь |
| `useModuleRoute(id)` | `{ path: Accessor<string> (хвост), navigate(tail) }` |
| `useServiceQuery(key, fetcher, opts?)` | `{ data, error, loading, reload }` — аксессоры |
| `useServiceMutation(mutator)` | `{ mutate(args), loading, error }` |

## ModuleRenderer

Семантика — паритет с React-версией:

- `fallback` / `notFound` / `errorFallback(error, retry)` — те же ветки;
  в Solid ошибка приходит аксессором (`error().message` в JSX).
- `pageTransition` — `data-page-enter="<имя>"` на обёртке, CSS ядра
  (`fade`/`fade-up`/`scale`). Пересоздание поддерева keyed-`<Show>` само
  перезапускает анимацию; первый вход в приложение не анимируется.
- `loadingDelay` — минимальное время показа загрузчика при смене модуля:
  чанк греется сразу (задержка не суммируется с загрузкой), первый показ,
  retry и уход в notFound — без задержки.
- Retry пересоздаёт поддерево целиком (attempt-счётчик в keyed-`<Show`>):
  solid-`lazy` кеширует промис внутри себя, одного reset boundary
  недостаточно.

## defineModule — контракт модуля

`shell-kit/solid` экспортирует Solid-редакцию `defineModule`: тот же
контракт (вьюха/варианты/контроллер/сервис), что и React-версия, но типы
локальные (`Component` из solid-js, `JSX` из @solidjs/web) — react
в solid-дист не тянется. module-lazy резолвит `default.view`, рендерер
не меняется; прямые экспорты компонента тоже поддерживаются.

```tsx
import { defineModule } from "shell-kit/solid";

export default defineModule({
  page: {
    component: OkPage,        // чистая вьюха: только пропсы
    controller: setupOkProps, // (service: OkService) => OkProps
  },
  service: { id: "ok", instance: okService }, // опционально
});
```

- **Контроллер — setup-функция** `(service) => props`: вызывается ровно
  один раз в теле собранной вьюхи (owned scope) — можно звать
  `useModuleRoute`/`useServiceQuery`, создавать мемо и сигналы. Это
  аналог хука `useXxxProps` из React-версии; по конвенции имени —
  `setupXxxProps`. Сервис передаётся аргументом от модуля, не из
  замыкания; модуль без сервиса объявляет контроллер `() => P`.
- **Пропсы — аксессоры** (getter-in / accessor-out): реактивные значения
  контроллер отдаёт функциями, вьюха читает `props.query.loading()`,
  `props.route.path()`.
- **Варианты**: резолв — первый подходящий `when(props)`; предикат читает
  аксессоры, смена условия реактивно пересчитывает вариант (`createMemo`).
  Рендер — keyed `<Show>` по identity варианта: смена варианта
  пересоздаёт поддерево, lazy-вариант грузит свой чанк (suspense ловит
  внешний `<Loading>`/`<Errored>` в ModuleRenderer). Вариант без `when` —
  дефолт, ставится последним; нет матча — warn + пустой рендер
  (ошибка конфигурации).
- **Предупреждение о scope.** `when` — compute: только читает, ничего
  не пишет. Запись сигналов в теле контроллера (owned/compute scope)
  запрещена — записи живут в колбэках, `.then`-продолжениях и apply-фазе
  эффектов.

Живой пример — `src/demo-solid/modules/Ok.tsx` (контроллер-setup +
чистая вьюха + defineModule-экспорт).

## Заметки Solid 2

- **Getter-in / accessor-out.** Реактивные аргументы — функциями
  (`useMedia(() => card.cover)`, `useServiceQuery(() => ["orders", scope()])`),
  возврат — аксессоры, читаются на JSX-границе (`query.data()?.title`).
- **Контекст кидает сам.** `useShell()`/`useRouter()` вне провайдера
  бросают типизированную `ContextNotFoundError` (default-less контекст —
  каноника Solid 2), rethrow-обёрток нет.
- **Props — значения.** Компоненты адаптера читают `props.x`; на стороне
  приложения аксессоры коллапсируются при передаче (`<Comp id={active()}/>`),
  не деструктурируются.
- **Flush-семантика чтений.** Запись сигнала не видна чтению до микротаска
  (`flush()` в тестах); хуки адаптера это учитывают — начальные значения
  снимаются синхронным untrack-peek, записи живут в колбэках подписок,
  `.then`-продолжениях, таймерах и apply-фазе эффектов (запись в owned
  scope — тело компонента/compute — запрещена).
