import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/upload', title: 'File Upload', subtitle: 'Ingest SCL files', icon: 'U' },
  { to: '/ln-tree', title: 'LN Tree', subtitle: 'Browse Logical Nodes', icon: 'L' },
  { to: '/datasets', title: 'Dataset Viewer', subtitle: 'GOOSE/SV datasets', icon: 'D' },
  { to: '/anomaly', title: 'Anomaly Detection', subtitle: 'Excel outliers', icon: 'A' },
  { to: '/report', title: 'Validation Report', subtitle: 'Issues & recommendations', icon: 'R' },
  { to: '/interop-map', title: 'Interoperability Map', subtitle: 'Cross-vendor mapping', icon: 'M' },
  { to: '/scada', title: 'SCADA Table', subtitle: 'Points & names', icon: 'S' }
];

// PUBLIC_INTERFACE
export default function Sidebar() {
  /** Sidebar module navigation. */
  return (
    <aside className="sidebar" aria-label="Module navigation">
      <div className="navSectionTitle">Modules</div>
      <ul className="navList">
        {navItems.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              className={({ isActive }) =>
                `navItemLink${isActive ? ' navItemLinkActive' : ''}`
              }
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

      <div className="navSectionTitle" style={{ marginTop: 14 }}>
        Utilities
      </div>
      <ul className="navList">
        <li>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `navItemLink${isActive ? ' navItemLinkActive' : ''}`
            }
          >
            <span className="navIcon" aria-hidden="true">
              ⚙
            </span>
            <span className="navText">
              <strong>Settings</strong>
              <span>Environment & flags</span>
            </span>
          </NavLink>
        </li>
      </ul>
    </aside>
  );
}
