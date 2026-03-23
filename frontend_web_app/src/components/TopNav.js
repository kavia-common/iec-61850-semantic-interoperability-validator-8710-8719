import React from 'react';

// PUBLIC_INTERFACE
export default function TopNav() {
  /** Top navigation bar: brand + primary actions. (Status pills intentionally removed.) */
  return (
    <div className="topNav" role="banner">
      <div className="brand" aria-label="Application brand">
        <div className="brandMark" aria-hidden="true">
          SIV
        </div>
        <div className="brandTitle">
          <strong>IEC 61850 SIV-Tool</strong>
          <span>Semantic Interoperability Validator</span>
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
