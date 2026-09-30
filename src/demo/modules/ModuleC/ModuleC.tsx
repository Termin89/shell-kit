import { useState } from "react";
import { useDemoState } from "../../state";

const settings = [
  { key: "beta", title: "Бета-функции", default: false },
  { key: "telemetry", title: "Телеметрия", default: true },
] as const;

const ModuleC = () => {
  const { scope } = useDemoState();
  const [values, setValues] = useState<Record<string, boolean>>(
    () => Object.fromEntries(settings.map((s) => [s.key, s.default])),
  );

  return (
    <section className="module-panel module-c" aria-labelledby="module-c-title">
      <header className="module-header">
        <span className="module-badge">C</span>
        <div>
          <h2 id="module-c-title">Модуль C · Настройки</h2>
          <p>активен только при scope = admin</p>
        </div>
      </header>

      <ul className="module-settings">
        {settings.map((setting) => (
          <li key={setting.key}>
            <span>{setting.title}</span>
            <button
              type="button"
              className="module-switch"
              aria-pressed={values[setting.key]}
              aria-label={setting.title}
              onClick={() =>
                setValues((v) => ({ ...v, [setting.key]: !v[setting.key] }))
              }
            />
          </li>
        ))}
      </ul>

      <p className="module-state">
        модуль видит состояние Shell: scope = <code>{scope}</code>
      </p>
    </section>
  );
};

export default ModuleC;
