/** Чистая вьюха каталога: только пропсы, без бизнес-привязок. */

export interface CatalogPageProps {
  scope: string;
  items: { title: string; note: string }[];
}

export default function CatalogPage({ scope, items }: CatalogPageProps) {
  return (
    <section className="module-panel module-a" aria-labelledby="module-a-title">
      <header className="module-header">
        <span className="module-badge">A</span>
        <div>
          <h2 id="module-a-title">Модуль A · Каталог</h2>
          <p>активен при любом scope · preload</p>
        </div>
      </header>

      <ul className="module-items">
        {items.map((item) => (
          <li key={item.title}>
            <span className="module-dot" />
            <span>{item.title}</span>
            <code>{item.note}</code>
          </li>
        ))}
      </ul>

      <p className="module-state">
        scope = <code>{scope}</code>
      </p>
    </section>
  );
}
