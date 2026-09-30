import type { ReportProps } from "./controller";

/** Полный вариант — отдельный чанк, запрашивается только при scope = admin. */
const ReportFull = ({ rows, scope }: ReportProps) => (
  <section
    className="module-panel module-report-full"
    aria-labelledby="report-full-title"
  >
    <header className="module-header">
      <span className="module-badge">RF</span>
      <div>
        <h2 id="report-full-title">Отчёт · полный</h2>
        <p>вариант внутри модуля · детализация при scope = admin</p>
      </div>
    </header>

    <ul className="module-items">
      {rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          <code>{row.value}</code>
        </li>
      ))}
    </ul>

    <p className="module-state">
      вы видите полный вариант: scope = <code>{scope}</code>
    </p>
  </section>
);

export default ReportFull;
