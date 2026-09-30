import type { ReportProps } from "./controller";

/** Облегчённый вариант — отдельный чанк, запрашивается при scope ≠ admin. */
const ReportLite = ({ totals, scope }: ReportProps) => (
  <section
    className="module-panel module-report-lite"
    aria-labelledby="report-lite-title"
  >
    <header className="module-header">
      <span className="module-badge">RL</span>
      <div>
        <h2 id="report-lite-title">Отчёт · облегчённый</h2>
        <p>вариант внутри модуля · итог без деталей (scope ≠ admin)</p>
      </div>
    </header>

    <div className="module-stats">
      <div className="module-stat">
        <b>{totals}</b>
        <span>
          итог периода — детали доступны в полной версии (scope = admin)
        </span>
      </div>
    </div>

    <p className="module-state">
      вы видите облегчённый вариант: scope = <code>{scope}</code>
    </p>
  </section>
);

export default ReportLite;
