import { For } from "solid-js";
import { Shell } from "shell-kit/core";
import type { ModuleConfig } from "shell-kit/core";
import {
  ModuleRenderer,
  RouterProvider,
  ShellGate,
  ShellProvider,
  configureQuery,
  connectRouter,
  createBrowserHistory,
  useNavigate,
  usePath,
  SelfRolledAdapter,
} from "shell-kit/solid";
import type { JSX } from "@solidjs/web";

interface DemoState {
  activeModule: string | null;
}

// Модуль broken падает при первой загрузке: Retry в Errored
// пересоздаёт поддерево (keyed <Show> по attempt) и заново зовёт
// loadModule — ошибка загрузки не кешируется ни ядром, ни module-lazy.
let brokenLoadFailed = false;

// as const выводит литеральные id — из них складывается union ModuleId
const modules = [
  { id: "ok", load: () => import("./modules/Ok") },
  {
    id: "broken",
    load: () => {
      if (!brokenLoadFailed) {
        brokenLoadFailed = true;
        return Promise.reject(new Error("имитация сбоя сети (попытка 1)"));
      }
      return import("./modules/Broken");
    },
  },
  {
    // имитация медленного чанка: загрузчик живёт ≥ loadingDelay,
    // в демо — все 1.5 секунды
    id: "slow",
    load: () =>
      new Promise<void>((resolve) => setTimeout(resolve, 1500)).then(() =>
        import("./modules/Slow"),
      ),
  },
] as const satisfies readonly ModuleConfig<DemoState>[];

const shell = new Shell<DemoState, typeof modules>({
  initialState: { activeModule: null },
  modules,
});

// query-порт для useServiceQuery в модуле ok
configureQuery(new SelfRolledAdapter());

// Петля activeModule ↔ первый сегмент URL: push/back/F5 меняют модуль
const router = connectRouter(shell, createBrowserHistory());

const NAV: readonly { id: string; label: string }[] = [
  { id: "ok", label: "ok · query + хвост маршрута" },
  { id: "broken", label: "broken · retry" },
  { id: "slow", label: "slow · loadingDelay" },
];

function Layout(): JSX.Element {
  const navigate = useNavigate();
  const path = usePath();
  return (
    <div class="app">
      <header class="app-header">
        <strong>shell-kit · Solid 2 демо</strong>
        <nav class="app-nav">
          <For each={NAV}>
            {(item) => (
              <button type="button" onClick={() => navigate(`/${item.id}`)}>
                {item.label}
              </button>
            )}
          </For>
        </nav>
        <code class="app-path">{path()}</code>
      </header>
      <main class="app-main">
        <ModuleRenderer
          loadingDelay={300}
          pageTransition="fade"
          notFound={
            <p class="hint">
              Модуль не выбран: активный модуль — состояние ядра, URL —
              опциональный слой. Кликни по кнопке выше.
            </p>
          }
        />
      </main>
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <ShellProvider shell={shell}>
      <RouterProvider port={router.port}>
        <ShellGate>
          <Layout />
        </ShellGate>
      </RouterProvider>
    </ShellProvider>
  );
}
