import { useDemoState } from "../../state";

const ModuleE = () => {
  const { scope } = useDemoState();

  return (
    <section className="module-panel module-e" aria-labelledby="module-e-title">
      <header className="module-header">
        <span className="module-badge">E</span>
        <div>
          <h2 id="module-e-title">Модуль E · Нестабильная загрузка</h2>
          <p>первая попытка load() всегда падает — работает Retry</p>
        </div>
      </header>

      <div className="module-steps">
        <span className="module-step module-step--fail">попытка 1 · ошибка</span>
        <span className="module-step">Retry</span>
        <span className="module-step module-step--ok">попытка 2 · успех</span>
      </div>

      <p className="module-state">
        вы видите этот экран — значит Retry сработал · scope ={" "}
        <code>{scope}</code>
      </p>
    </section>
  );
};

export default ModuleE;
