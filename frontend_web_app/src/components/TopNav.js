import React from 'react';
import { NavLink } from 'react-router-dom';

const moduleTabs = [
  { to: '/upload', label: 'File Upload' },
  { to: '/results', label: 'Results' }, // Keep Results after File Upload (routing already unchanged)
  { to: '/ln-tree', label: 'LN Tree' },
  { to: '/datasets', label: 'Dataset Viewer' },
  { to: '/report', label: 'Validation Report' },
  { to: '/interop-map', label: 'Interoperability Map' },
  { to: '/scada', label: 'SCADA Table' },
  { to: '/anomaly', label: 'Anomaly Detection' },
  { to: '/recommendations', label: 'Recommendations' },
  { to: '/settings', label: 'Settings' }
];

// PUBLIC_INTERFACE
export default function TopNav() {
  /** Top navigation bar: brand + module tabs + primary actions. (Status pills intentionally removed.) */
  return (
    <div className="topNav" role="banner">
      <div className="brand" aria-label="Application brand">
        <div className="brandMark" aria-hidden="true">
          SIV
        </div>

        <div className="brandTitle brandTitleInline">
          <strong>IEC 61850 SIV-Tool</strong>

          {/* Horizontal module navigation (tabs). Scrolls horizontally on smaller screens. */}
          <nav className="topTabs" aria-label="Module navigation">
            {moduleTabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) => `topTab${isActive ? ' topTabActive' : ''}`}
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
