import type { JSX } from "@solidjs/web";

/**
 * slow — модуль с задержанным чанком (~1.5 с): загрузчик живёт не
 * меньше loadingDelay (300 мс) рендерера, а ровно столько, сколько
 * грузится чанк — задержка греет чанк, а не ждёт перед загрузкой.
 */
export default function Slow(): JSX.Element {
  return (
    <section class="module">
      <h2>Модуль slow</h2>
      <p>
        Чанк грузился ~1.5 с — всё это время был виден fallback:
        loadingDelay задаёт минимум показа, загрузка не суммируется
        с ним.
      </p>
    </section>
  );
}
