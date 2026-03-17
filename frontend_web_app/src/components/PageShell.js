import React from 'react';

// PUBLIC_INTERFACE
export default function PageShell({ title, subtitle, actions, children }) {
  /** Consistent page card layout wrapper. */
  return (
    <section className="card" aria-label={title}>
      <header className="cardHeader">
        <div>
          <h1 className="h1">{title}</h1>
          {subtitle ? <div className="subtle" style={{ marginTop: 4 }}>{subtitle}</div> : null}
        </div>
        <div className="row">{actions}</div>
      </header>
      <div className="cardBody">{children}</div>
    </section>
  );
}
