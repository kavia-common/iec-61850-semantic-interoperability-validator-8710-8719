import React from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';

// PUBLIC_INTERFACE
export default function NotFoundPage() {
  /** 404 page. */
  return (
    <PageShell
      title="Page not found"
      subtitle="The requested route does not exist."
      actions={
        <Link className="btn btnPrimary" to="/upload">
          Go to File Upload
        </Link>
      }
    >
      <div className="subtle">
        Use the sidebar to navigate between modules.
      </div>
    </PageShell>
  );
}
