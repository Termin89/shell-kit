import { For, Match, Switch } from "solid-js";
import type { JSX } from "@solidjs/web";
import { useModuleRoute, useServiceQuery } from "shell-kit/solid";

interface Note {
  id: number;
  title: string;
}

// Тумблер «сломать источник»: следующий фетч кидает → error-ветка
// хука (classifyError → errorBus), reload чинит показ.
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
 * ok — «обычный» модуль демо: lazy-чанк, данные через useServiceQuery
 * (mock-источник с задержкой и управляемым сбоем), хвост маршрута.
 */
export default function Ok(): JSX.Element {
  const route = useModuleRoute("ok");
  const query = useServiceQuery<Note[]>(["notes", "list"], fetchNotes);

  return (
    <section class="module">
      <h2>Модуль ok</h2>
      <p>
        Хвост маршрута: <code>{route.path() || "«корень модуля»"}</code>{" "}
        <button type="button" onClick={() => route.navigate("/post/42")}>
          открыть /ok/post/42
        </button>
      </p>
      <Switch>
        <Match when={query.loading()}>
          <p role="status">Загрузка данных…</p>
        </Match>
        <Match when={query.error() !== undefined}>
          <p role="alert">Ошибка: {query.error()?.message}</p>
          <button type="button" onClick={() => void query.reload()}>
            Перезагрузить
          </button>
        </Match>
        <Match when={query.data() !== undefined}>
          <ul>
            <For each={query.data()}>
              {(note) => <li>{note.title}</li>}
            </For>
          </ul>
        </Match>
      </Switch>
      <p class="row">
        <button type="button" onClick={() => void query.reload()}>
          Перезагрузить
        </button>
        <button
          type="button"
          onClick={() => {
            sourceBroken = !sourceBroken;
            void query.reload();
          }}
        >
          {sourceBroken ? "Починить источник" : "Сломать источник"}
        </button>
      </p>
    </section>
  );
}
