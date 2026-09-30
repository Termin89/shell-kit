import { useDemoState } from "../../state";

const bars = [42, 68, 35, 84, 58, 74];

const ModuleD = () => {
  const { scope } = useDemoState();

  return (
    <section className="module-panel module-d" aria-labelledby="module-d-title">
      <header className="module-header">
        <span className="module-badge">D</span>
        <div>
          <h2 id="module-d-title">Модуль D · Медленная загрузка</h2>
          <p>load() задерживается на 2 секунды — Suspense-fallback в действии</p>
        </div>
      </header>

      <div
        className="module-chart"
        role="img"
        aria-label="Демонстрационный график"
      >
        {bars.map((h) => (
          <span key={h} style={{ height: `${h}%` }} />
        ))}
      </div>

      <p className="module-state">
        модуль видит состояние Shell: scope = <code>{scope}</code>
      </p>
    </section>
  );
};

export default ModuleD;
