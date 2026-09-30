import type { AppState, Shell } from "../core";
import { createBrowserHistory } from "./history";
import type { RouterPort } from "./port";

/**
 * connectRouter — петля синхронизации activeModule ↔ первый сегмент
 * URL (конвенция `/:module/*`). Роутер — «ещё один подписчик» ядра,
 * построен только на публичном API стора (getState/setActiveModule/
 * subscribe): ядро про URL не знает и отличить его от клика по
 * навигации не может.
 *
 * Владение: первый сегмент — shell (синхронизируется здесь), хвост —
 * модуль (читает сам через useModuleRoute, в AppState не попадает).
 * Поэтому петель нет: смена хвоста не меняет первый сегмент, смена
 * модуля не порождает popstate.
 *
 * Гейт-сегменты (options.gate) — первые сегменты вне реестра модулей:
 * экраны «до приложения» (классический пример — /login и /register
 * auth-гейта). Петля их не резолвит в activeModule (иначе unknown-модуль
 * с notFound), а shell→URL молчит, пока адрес — гейт-сегмент: URL
 * принадлежит гейту, состояние приложения меняется и так (bootstrap,
 * logout). Переходы на гейт и обратно — забота приложения: гейт-экран
 * читает адрес usePath'ом и навигейтил useNavigate'ом.
 *
 * Подключать до shell.bootstrap: deep-link применяется к состоянию
 * до резолва сессии (патч bootstrap мержится поверх, activeModule
 * не затирает).
 */

/** Опции connectRouter. */
export interface RouterOptions {
  /**
   * Первые сегменты URL, принадлежащие гейту (auth-роуты и т.п.), —
   * не резолвятся в activeModule и не перетираются петлёй.
   */
  readonly gate?: readonly string[];
}

export interface RouterConnection {
  readonly port: RouterPort;
  disconnect(): void;
}

const firstSegment = (path: string): string | null => {
  const [segment] = path.split("?")[0].split("/").filter((s) => s !== "");
  return segment ?? null;
};

export function connectRouter<S extends AppState>(
  shell: Shell<S>,
  port: RouterPort = createBrowserHistory(),
  options: RouterOptions = {},
): RouterConnection {
  const gate = new Set(options.gate ?? []);

  // URL → shell: back/forward браузера, ввод адреса, старт приложения.
  // Гейт-сегменты пропускаем: URL гейта не является выбором модуля.
  const applyPath = (path: string): void => {
    const id = firstSegment(path);
    if (
      id !== null &&
      !gate.has(id) &&
      shell.getState().activeModule !== id
    ) {
      // Неизвестный id — предупреждение ядра + notFound от рендерера
      // (выбор и видимость разделены): URL и состояние согласованы.
      shell.setActiveModule(id);
    }
  };
  const offUrl = port.subscribe(applyPath);
  applyPath(port.path);

  // shell → URL: клики по навигации, кросс-модульные переходы.
  // На гейт-сегменте молчим: адрес принадлежит гейту, вернёт приложение
  // (вход/выход), а не каждое изменение состояния.
  const offState = shell.subscribe((state) => {
    const id = state.activeModule;
    const urlId = firstSegment(port.path);
    if (id !== null && urlId !== null && urlId !== id && !gate.has(urlId)) {
      port.push(`/${id}`);
    }
  });

  return {
    port,
    disconnect: () => {
      offUrl();
      offState();
    },
  };
}
