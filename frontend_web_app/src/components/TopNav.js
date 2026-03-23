import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { TOP_TABS, getContextFromPathname, getDefaultModulePathForContext } from '../navigation/navConfig';

// PUBLIC_INTERFACE
export default function TopNav() {
  /** Top navigation bar: brand + top-level context tabs (Backend Configuration / Health / WS). */
  const location = useLocation();
  const activeContext = useMemo(() => getContextFromPathname(location.pathname), [location.pathname]);

  const tabs = useMemo(() => {
    // Each top tab links to the default module page for that context.
    return TOP_TABS.map((t) => ({
      ...t,
      to: getDefaultModulePathForContext(t.key)
    }));
  }, []);

  return (
    <div className="topNav" role="banner">
      <div className="brand" aria-label="Application brand">
        <div className="brandMark" aria-hidden="true">
          SIV
        </div>

        <div className="brandTitle brandTitleInline">
          <strong>IEC 61850 SIV-Tool</strong>

          <nav className="topTabs" aria-label="Top navigation">
            {tabs.map((t) => (
              <NavLink
                key={t.key}
                to={t.to}
                className={() => `topTab${activeContext === t.key ? ' topTabActive' : ''}`}
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="topActions">
        <a className="btn btnGhost" href="https://iec.ch/" target="_blank" rel="noreferrer">
          IEC
        </a>
      </div>
    </div>
  );
}
