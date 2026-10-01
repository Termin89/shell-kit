import type { JSX } from "@solidjs/web";

/**
 * broken — модуль, упавший при первой загрузке. Первая попытка load()
 * отклоняется (см. App.tsx), Errored показывает Retry; клик
 * пересоздаёт поддерево — свежий lazy снова зовёт loadModule,
 * вторая попытка доезжает до этого компонента.
 */
export default function Broken(): JSX.Element {
  return (
    <section class="module">
      <h2>Модуль broken</h2>
      <p>
        Первая загрузка упала, Retry пересоздал поддерево (keyed
        &lt;Show&gt;) — вторая попытка дошла сюда. Ошибка загрузки не
        кешируется ни ядром, ни module-lazy.
      </p>
    </section>
  );
}
