// oxlint-disable react-hooks/rules-of-hooks, react/only-export-components
// (правила React не про Solid: setupOkProps — не хук, а setup-функция
// контракта defineModule — вызывается один раз во вьюхе модуля)
import { For, Match, Switch } from "solid-js";
import type { JSX } from "@solidjs/web";
import { defineModule, useModuleRoute, useServiceQuery } from "shell-kit/solid";
import type { ModuleRoute, QueryResult } from "shell-kit/solid";

interface Note {
  id: number;
  title: string;
}

/** Пропсы чистой вьюхи: только данные-аксессоры, без бизнес-логики. */
interface OkProps {
  route: ModuleRoute;
  query: QueryResult<Note[]>;
}

// Тумблер «сломать источник»: следующий фетч кидает → error-ветка
// хука (classifyError → errorBus), reload чинит показ. Чтение в JSX
// и запись в клике — plain let, реактивность тут не нужна.
let sourceBroken = false;

const fetchNotes = async (): Promise<Note[]> => {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (sourceBroken) {
    throw new Error("источник данных недоступен");
  }
  return [
    { id: 1, title: "Модуль — единица чанка: load() возвращает import()" },
    { id: 2, title: "Хвост маршрута читается useModuleRoute, URL — петля connectRouter" },
    { id: 3, title: "useServiceQuery: кеш + дедуп через query-порт" },
  ];
};

/**
 * ok — «обычный» модуль демо, собран по контракту ShellModule:
 * OkPage — чистая вьюха на пропсах, setupOkProps — контроллер-setup
 * (вызывается один раз в owned scope: хуки адаптера, query).
 */
function OkPage(props: OkProps): JSX.Element {
  return (
    <section class="module">
      <h2>Модуль ok</h2>
      <p>
        Хвост маршрута: <code>{props.route.path() || "«корень модуля»"}</code>{" "}
        <button type="button" onClick={() => props.route.navigate("/post/42")}>
          открыть /ok/post/42
        </button>
      </p>
      <Switch>
        <Match when={props.query.loading()}>
          <p role="status">Загрузка данных…</p>
        </Match>
        <Match when={props.query.error() !== undefined}>
          <p role="alert">Ошибка: {props.query.error()?.message}</p>
          <button type="button" onClick={() => void props.query.reload()}>
            Перезагрузить
          </button>
        </Match>
        <Match when={props.query.data() !== undefined}>
          <ul>
            <For each={props.query.data()}>
              {(note) => <li>{note.title}</li>}
            </For>
          </ul>
        </Match>
      </Switch>
      <p class="row">
        <button type="button" onClick={() => void props.query.reload()}>
          Перезагрузить
        </button>
        <button
          type="button"
          onClick={() => {
            sourceBroken = !sourceBroken;
            void props.query.reload();
          }}
        >
          {sourceBroken ? "Починить источник" : "Сломать источник"}
        </button>
      </p>
    </section>
  );
}

/** Контроллер без сервиса: () => Props, вызывается один раз во вьюхе. */
function setupOkProps(): OkProps {
  return {
    route: useModuleRoute("ok"),
    query: useServiceQuery<Note[]>(["notes", "list"], fetchNotes),
  };
}

export default defineModule({ page: { component: OkPage, controller: setupOkProps } });
