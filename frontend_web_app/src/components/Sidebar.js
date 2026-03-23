import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CONTEXT_MODULES, getContextFromPathname } from '../navigation/navConfig';

/**
 * Context-aware sidebar:
 * - Items are derived strictly from the active top tab context.
 * - No global modules are shown.
 */

// PUBLIC_INTERFACE
export default function Sidebar() {
  /** Left-side module menu that changes strictly based on active top tab context. */
  const location = useLocation();
  const contextKey = useMemo(() => getContextFromPathname(location.pathname), [location.pathname]);
  const modules = CONTEXT_MODULES[contextKey] || [];

  // Simple opacity transition on context changes to satisfy "smooth transition".
  const [fadeIn, setFadeIn] = useState(true);
  useEffect(() => {
    setFadeIn(false);
    const t = window.setTimeout(() => setFadeIn(true), 70);
    return () => window.clearTimeout(t);
  }, [contextKey]);

  return (
    <aside className="sidebar" aria-label="Module navigation">
      <div className="navSectionTitle">{contextKey === 'backend' ? 'Backend Configuration' : contextKey === 'health' ? 'Health' : 'WS'}</div>

      <ul className={`navList sidebarFade${fadeIn ? ' sidebarFadeIn' : ''}`}>
        {modules.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              className={({ isActive }) => `navItemLink${isActive ? ' navItemLinkActive' : ''}`}
            >
              <span className="navIcon" aria-hidden="true">
                {it.icon}
              </span>
              <span className="navText">
                <strong>{it.title}</strong>
                <span>{it.subtitle}</span>
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}
