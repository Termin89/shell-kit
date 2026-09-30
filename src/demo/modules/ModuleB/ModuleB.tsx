import { useDemoState } from "../../state";

const stats = [
  { value: "1 284", label: "визитов за неделю" },
  { value: "18%", label: "конверсия" },
  { value: "4.7", label: "средняя оценка" },
];

const ModuleB = () => {
  const { scope } = useDemoState();

  return (
    <section className="module-panel module-b" aria-labelledby="module-b-title">
      <header className="module-header">
        <span className="module-badge">B</span>
        <div>
          <h2 id="module-b-title">Модуль B · Аналитика</h2>
          <p>активен при scope = user или admin</p>
        </div>
      </header>

      <div className="module-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="module-stat">
            <b>{stat.value}</b>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <p className="module-state">
        модуль видит состояние Shell: scope = <code>{scope}</code>
      </p>
    </section>
  );
};

export default ModuleB;
