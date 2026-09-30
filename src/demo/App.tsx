import { Shell, UnauthenticatedError } from "shell-kit/core";
import type { ModuleConfig } from "shell-kit/core";
import { authHandler, errorBus, networkHandler, toastHandler } from "shell-kit/errors";
import {
  ModuleRenderer,
  ShellProvider,
  ShellGate,
  useActiveModules,
  useShell,
  useShellStatus,
} from "shell-kit/react";
import { SCOPES, useDemoState } from "./state";
import type { DemoState } from "./state";
import { pushToast, useToasts } from "./toasts";
import "./App.css";

// Модуль E падает при первой загрузке, чтобы показать Retry в Error Boundary
let moduleEFailed = false;

// as const выводит литеральные id — из них складывается union ModuleId
const modules = [
  {
    id: "module-a",
    load: () => import("./modules/ModuleA/ModuleA"),
    preload: true,
  },
  {
    id: "module-b",
    load: () => import("./modules/ModuleB/ModuleB"),
    enabled: ({ scope }) => scope === "user" || scope === "admin",
  },
  {
    id: "module-c",
    load: () => import("./modules/ModuleC/ModuleC"),
    enabled: ({ scope }) => scope === "admin",
  },
  // Один модуль «Отчёт»: варианты full/lite — внутри модуля,
  // отдельные lazy-чанки; грузится только нужный при текущем scope
  {
    id: "report",
    load: () => import("./modules/ModuleReport/ModuleReport"),
  },
  {
    id: "module-d",
    // имитация медленного чанка: Suspense-fallback виден ~2 секунды
    load: () =>
      new Promise<void>((resolve) => setTimeout(resolve, 2000)).then(() =>
        import("./modules/ModuleD/ModuleD"),
      ),
  },
  {
    id: "module-e",
    load: () => {
      if (!moduleEFailed) {
        moduleEFailed = true;
        return Promise.reject(new Error("имитация сбоя сети (попытка 1)"));
      }
      return import("./modules/ModuleE/ModuleE");
    },
  },
  {
    // Сервисный модуль: без экрана — активируется и загружается
    // preload'ом, добраться до него можно программно (shell.loadModule)
    id: "module-s",
    load: () => Promise.resolve({ ping: () => "pong" }),
    preload: true,
  },
  {
    // Полный services-стек: диспетчер defineService (mock/api стратегии),
    // контроллер на useServiceQuery, чистая вьюха на пропсах
    id: "module-f",
    load: () => import("./modules/ModuleF/ModuleF"),
  },
] as const satisfies readonly ModuleConfig<DemoState>[];

/**
 * Флаги моков services-конфига. Диспетчер читает объект на каждом вызове —
 * тумблер «моки» в тулбаре меняет значения на лету, без перезагрузки
 * (источники URL/localStorage/env — этап D, runtime-mock).
 */
const mockFlags: Record<string, boolean> = { orders: true };

/** Union id всех зарегистрированных модулей — типизирует выбор модуля. */
type ModuleId = (typeof modules)[number]["id"];

const shell = new Shell<DemoState, typeof modules>({
  // безопасное «доинициализационное» состояние — финальное применит bootstrap
  initialState: { scope: "guest", activeModule: null, mockOrders: true },
  modules,
  // Конфиг services-слоя: источник ResolveContext для диспетчеров
  // defineService. baseUrl заведомо недоступен — переключение тумблера
  // мока на api демонстрирует путь сетевой ошибки (fetch → NetworkError →
  // classify → шина → тост + локальный error с Retry).
  services: {
    baseUrl: "https://orders.demo.invalid",
    getToken: () => "demo-token",
    mockFlags,
  },
});

// Хендлеры шины ошибок — подписка один раз на старте приложения:
// тосты для мягких видов (validation/business/conflict/notFound),
// networkHandler — колбэк поднимает тост и для сетевых сбоев
// (сам toastHandler сеть не слушает — это разные реакции по порту)
errorBus.subscribe(
  toastHandler({
    showToast: (message, severity) => pushToast(message, severity),
  }),
);
errorBus.subscribe(authHandler({}));
errorBus.subscribe(
  networkHandler({
    onOffline: () => pushToast("Сеть недоступна — источник api не отвечает", "warn"),
  }),
);

// Bootstrap: восстановление сессии имитацией запросов к «API» —
// каждый шаг и смена статуса печатаются в консоль (см. кейс
// «Bootstrap в консоли»). Пока идёт — активация модулей подавлена
// и виден splash (ShellGate); резолв — патч состояния.
// С ?fail в URL первая попытка /api/session падает — Retry перезапускает bootstrap.
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Псевдо-fetch для демо: логирует запрос и ответ в консоль. */
async function fakeRequest<T>(
  url: string,
  payload: T,
  delay = 400,
): Promise<T> {
  console.info(`[shell] → GET ${url}`);
  await wait(delay);
  console.info(`[shell] ← 200 ${url}`, payload);
  return payload;
}

let bootstrapFailedOnce = false;
let sessionAuthorized = false;
const restoreSession = async (): Promise<Partial<DemoState>> => {
  const params = new URLSearchParams(window.location.search);
  const mustFail = !bootstrapFailedOnce && params.has("fail");
  const anonymous = !sessionAuthorized && params.has("anon");
  console.info("[shell] → GET /api/session");
  await wait(2000);
  if (anonymous) {
    console.error("[shell] ← 401 /api/session (сессии нет)");
    throw new UnauthenticatedError();
  }
  if (mustFail) {
    bootstrapFailedOnce = true;
    console.error("[shell] ← 500 /api/session (имитация сбоя сети)");
    throw new Error("не удалось восстановить сессию (имитация сбоя)");
  }
  console.info("[shell] ← 200 /api/session", { scope: "user" });
  await fakeRequest("/api/feature-flags", { experimental: false }, 2000);
  // entryModule — стартовый экран по результату восстановления сессии
  return { scope: "user", entryModule: "module-b" };
};

/** Имитация входа: после неё /api/session «отвечает» сессией. */
async function login(): Promise<void> {
  console.info("[shell] → POST /api/session (вход)");
  await wait(800);
  console.info("[shell] ← 200 /api/session (вход выполнен)");
  sessionAuthorized = true;
}

// Жизненный цикл инициализации — в консоль. Подписка регистрируется
// ДО вызова bootstrap: переход в bootstrapping происходит синхронно.
shell.onStatusChange((status) => {
  if (status === "ready") {
    console.info(
      "[shell] status: ready — активация включена, активны:",
      shell.getActiveModules().map((m) => m.id),
    );
  } else if (status === "error") {
    console.error("[shell] status: error — доступен retryBootstrap()");
  } else if (status === "unauthenticated") {
    console.info(
      "[shell] status: unauthenticated — вход, затем retryBootstrap()",
    );
  } else {
    console.info(`[shell] status: ${status}`);
  }
});
void shell.bootstrap(restoreSession);

// Подписи кнопок и состав навигации — забота layout'а, не ядра
const TITLES: Record<string, string> = {
  "module-a": "Каталог",
  "module-b": "Аналитика",
  "module-c": "Настройки",
  report: "Отчёт",
  "module-d": "Медленный",
  "module-e": "Нестабильный",
  "module-f": "Заказы",
};

// Сервисный модуль: активен и загружен, но в навигации не нужен
const HIDDEN = new Set(["module-s"]);

// Типизированная обёртка над useShell (паттерн сужения как useDemoState):
// setState и setActiveModule знают DemoState и литеральные id модулей
const useDemoShell = () =>
  useShell() as unknown as Shell<DemoState, typeof modules>;

const ScopeSwitcher = () => {
  const shellInstance = useDemoShell();
  const { scope } = useDemoState();

  return (
    <div className="toolbar-group" role="group" aria-label="Scope">
      <span className="toolbar-label">scope</span>
      {SCOPES.map((s) => (
        <button
          key={s}
          type="button"
          className="toolbar-btn"
          aria-pressed={scope === s}
          onClick={() => shellInstance.setState({ scope: s })}
        >
          {s}
        </button>
      ))}
    </div>
  );
};

/**
 * Тумблер мока заказов: пишет в два места одним действием — флаг в
 * services-конфиге (его per-call читает диспетчер) и реактивное зеркало
 * в shell state (на нём держится reloadOn контроллера). Переключение
 * мгновенное: следующий вызов сервиса уйдёт уже новой стратегии.
 */
const MockSwitcher = () => {
  const shellInstance = useDemoShell();
  const { mockOrders } = useDemoState();

  return (
    <div className="toolbar-group" role="group" aria-label="Моки сервисов">
      <span className="toolbar-label">моки</span>
      <button
        type="button"
        className="toolbar-btn"
        aria-pressed={mockOrders}
        title="Переключить источник данных сервиса заказов"
        onClick={() => {
          const next = !mockOrders;
          mockFlags.orders = next;
          shellInstance.setState({ mockOrders: next });
        }}
      >
        заказы: {mockOrders ? "mock" : "api"}
      </button>
    </div>
  );
};

/** Лента тостов — приёмник toastHandler'а шины ошибок. */
const ToastBar = () => {
  const toasts = useToasts();

  if (toasts.length === 0) return null;
  return (
    <div className="toast-bar" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.severity}`} role="status">
          {t.message}
        </div>
      ))}
    </div>
  );
};

interface NavItem {
  id: ModuleId;
  label: string;
}

const Nav = ({
  items,
  selected,
}: {
  items: NavItem[];
  selected: string | null;
}) => {
  const shellInstance = useDemoShell();

  return (
    <nav className="toolbar-group" aria-label="Модули">
      <span className="toolbar-label">модули</span>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="toolbar-btn"
          aria-current={selected === item.id ? "true" : undefined}
          onClick={() => shellInstance.setActiveModule(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
};

const StatusBar = ({ moduleId }: { moduleId: string | null }) => {
  const activeModules = useActiveModules();
  const status = useShellStatus();

  return (
    <footer className="app-status">
      <span>
        bootstrap: <code>{status}</code>
      </span>
      <span>
        модуль: <code>{moduleId ?? "—"}</code>
      </span>
      <span className="status-chips">
        {activeModules.map((m) => (
          <span
            key={m.id}
            className={`status-chip ${m.loaded ? "is-loaded" : "is-loading"}`}
          >
            {m.id}
            {m.loaded ? " ✓" : " …"}
          </span>
        ))}
      </span>
    </footer>
  );
};

const CASES = [
  {
    title: "Bootstrap и проверка сессии",
    text: "При старте на долю секунды виден splash: идёт shell.bootstrap, активация модулей подавлена, затем применяется scope=user. Откройте демо с ?fail в URL — инициализация упадёт, Retry перезапустит её, вторая попытка успешна.",
  },
  {
    title: "Auth-ветка: unauthenticated",
    text: "Откройте демо с ?anon: /api/session «отвечает» 401, init бросает UnauthenticatedError — статус unauthenticated, а не error: активация модулей подавлена, ShellGate показывает auth-слот. Кнопка «Войти» имитирует логин и вызывает retryBootstrap — init прогоняется заново и завершается ready.",
  },
  {
    title: "Bootstrap в консоли: статусы и запросы",
    text: "Откройте DevTools → Console и перезагрузите страницу: onStatusChange печатает переходы bootstrapping → ready (со списком активных модулей), а шаги инициализации — имитированные запросы /api/session и /api/feature-flags. С ?fail первый запрос «отвечает» 500, статус — error, Retry запускает попытку заново.",
  },
  {
    title: "Стартовый модуль из состояния",
    text: "bootstrap патчит entryModule = module-b — первым экраном открывается Аналитика, а не первый модуль реестра. Entry действует, только пока модуль активен: не нажимая кнопки, переключите scope на guest — module-b деактивируется, и layout вернётся к первому активному (Каталог).",
  },
  {
    title: "Контракт модуля: defineModule",
    text: "module-a собран по контракту: CatalogPage — чистая вьюха на пропсах (без сервисов и состояния), useCatalogProps — контроллер (бизнес-часть), defineModule собирает их в view, который и рендерит ModuleRenderer. Сменить верстку = подменить component, не трогая бизнес-часть.",
  },
  {
    title: "Активация по scope",
    text: "Переключайте scope: guest → user → admin. Модули B и C появляются в навигации и исчезают из неё, статус-бар обновляется.",
  },
  {
    title: "Деактивация выбранного модуля",
    text: "Выберите «Настройки» при scope = admin и смените scope на user: activeModule указывает на деактивированный модуль, рендерер покажет заглушку notFound — явный выбор не подменяется fallback'ом.",
  },
  {
    title: "Неактивный модуль",
    text: "Кнопка «неактивный» выбирает module-c: при scope без прав рендерер показывает notFound — выбор модуля и видимость разделены.",
  },
  {
    title: "Ленивая загрузка",
    text: "Модуль D грузится около 2 секунд — всё это время виден Suspense-fallback «Загрузка модуля…».",
  },
  {
    title: "Ошибка загрузки и Retry",
    text: "Модуль E падает при первой загрузке. Кнопка Retry в Error Boundary повторяет запрос и модуль загружается.",
  },
  {
    title: "Preload",
    text: "module-a помечен preload и загружается сразу после старта — в статус-баре у него ✓, рендер без задержки.",
  },
  {
    title: "Выбор модуля — состояние Shell",
    text: "Показанный модуль — обязательное поле state.activeModule: выбор виден любому подписчику (статус-бар обновляется) и переживает размонтирование layout'а (например, retryBootstrap). Запись — shell.setActiveModule: id типизированы конфигом модулей и проверяются по реестру (опечатка — предупреждение в консоли). Ядро поле не интерпретирует — только несёт через состояние.",
  },
  {
    title: "Общее состояние",
    text: "Каждый модуль читает scope через useShellState и обновляется на лету, без перезагрузки.",
  },
  {
    title: "Сервисный модуль",
    text: "module-s не показываем в навигации (фильтр layout'а), но он активен и загружен — виден в статус-баре. Обратиться к нему можно программно, через shell.loadModule.",
  },
  {
    title: "Варианты внутри модуля",
    text: "«Отчёт» — один модуль с вариантами: полный при scope = admin, облегчённый при остальных. Варианты — отдельные lazy-чанки: грузится только нужный, лишнее в кеш не попадает. Выберите «Отчёт» и переключайте scope — вариант подменяется на лету, навигация всегда показывает одну кнопку.",
  },
  {
    title: "Сервис на стратегиях: mock ↔ api",
    text: "«Заказы» — модуль на полном services-стеке: интерфейс сервиса описан руками, диспетчер defineService выбирает реализацию из стратегий. Тумблер «заказы: mock/api» переключает источник на лету: диспетчер резолвит стратегию на каждом вызове, а источник входит в ключ запроса — без перезагрузки страницы и пересоздания сервиса (в консоли видно «orders → стратегия …»). В mock-режиме кнопка статуса переводит заказ по lifecycle'у — данные правдоподобные, с задержкой сети.",
  },
  {
    title: "Ошибка сети: полный путь с Retry",
    text: "Переключите тумблер на api: baseUrl демо указывает на недоступный хост, fetch падает → TransportError (network) → classify → шина ошибок → networkHandler (лог + тост «Сеть недоступна»), а вьюха — локальный error с кнопкой Retry. Retry перечитывает тот же ключ; возврат тумблера на mock восстанавливает данные мгновенно — запись кеша mock-источника и инстанс стратегии не вытеснялись.",
  },
  {
    title: "Мутация и инвалидация кеша",
    text: "Кнопка «→ оплачен» — мутация useServiceMutation: после успеха контроллер инвалидирует префикс [\"orders\"] и перечитывает список (reloadOn) — статус заказа обновляется в таблице. В api-режиме мутация падает по сети: ошибка классифицируется, тост показывает сообщение, состояние таблицы не ломается.",
  },
] as const;

const Cases = () => (
  <section className="app-cases" aria-labelledby="cases-title">
    <h2 id="cases-title">Кейсы для проверки</h2>
    <div className="cases-grid">
      {CASES.map((c) => (
        <article key={c.title} className="case">
          <h3>{c.title}</h3>
          <p>{c.text}</p>
        </article>
      ))}
    </div>
  </section>
);

const ShellDemo = () => {
  const shellInstance = useDemoShell();
  const activeModules = useActiveModules();
  const { scope, entryModule, activeModule } = useDemoState();

  const navItems: NavItem[] = [
    ...activeModules
      .filter((m) => !HIDDEN.has(m.id))
      // id из реестра демо сужается до ModuleId для типизированного выбора
      .map((m) => ({ id: m.id as ModuleId, label: TITLES[m.id] ?? m.id })),
  ];

  // Entry из состояния действует, только пока модуль активен; явный выбор
  // (activeModule) залипает: модуль деактивировался — ModuleRenderer
  // покажет notFound, fallback не подхватывается
  const entryId =
    entryModule && activeModules.some((m) => m.id === entryModule)
      ? entryModule
      : undefined;
  const shownId = activeModule ?? entryId ?? navItems[0]?.id ?? null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>shell-kit</h1>
        <span className="app-tag">демо модульного Shell</span>
      </header>

      <div className="app-toolbar">
        <ScopeSwitcher />
        <MockSwitcher />
        <Nav items={navItems} selected={shownId} />
        <div className="toolbar-group" role="group" aria-label="Прочее">
          <span className="toolbar-label">прочее</span>
          <button
            type="button"
            className="toolbar-btn toolbar-btn--ghost"
            onClick={() => shellInstance.setActiveModule("module-c")}
            title="Модуль, неактивный при текущем scope"
          >
            неактивный
          </button>
        </div>
      </div>

      <main className="app-main">
        <ModuleRenderer
          moduleId={shownId ?? ""}
          fallback={<div className="module-placeholder">Загрузка модуля…</div>}
          notFound={
            <div className="module-placeholder">
              Модуль не активен при текущем состоянии (scope = {scope}) —
              смените scope или выберите другой модуль.
            </div>
          }
        />
      </main>

      <Cases />

      <ToastBar />
      <StatusBar moduleId={shownId} />
    </div>
  );
};

const BootstrapSplash = () => (
  <div className="app-splash">
    <div className="app-splash-card">
      <span className="app-splash-spinner" aria-hidden />
      Восстановление сессии…
    </div>
  </div>
);

const BootstrapError = ({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) => (
  <div className="app-splash">
    <div className="app-splash-card app-splash-card--error" role="alert">
      <b>Инициализация не удалась</b>
      <p>{error.message}</p>
      <button type="button" className="toolbar-btn" onClick={retry}>
        Retry
      </button>
    </div>
  </div>
);

const AuthScreen = ({ onLogin }: { onLogin: () => void }) => (
  <div className="app-splash">
    <div className="app-splash-card" role="alert">
      <b>Требуется вход</b>
      <p>
        GET /api/session ответил 401 — bootstrap перешёл в статус
        unauthenticated, активация модулей подавлена.
      </p>
      <button type="button" className="toolbar-btn" onClick={onLogin}>
        Войти
      </button>
    </div>
  </div>
);

export default function App() {
  return (
    <ShellProvider shell={shell}>
      <ShellGate
        fallback={<BootstrapSplash />}
        error={(error, retry) => (
          <BootstrapError error={error} retry={retry} />
        )}
        unauthenticated={(retry) => (
          <AuthScreen
            onLogin={() => {
              void login().then(() => retry());
            }}
          />
        )}
      >
        <ShellDemo />
      </ShellGate>
    </ShellProvider>
  );
}
