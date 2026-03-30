import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export function AppTopbar({
  currentView,
  search,
  statusSlot,
}: {
  currentView: 'explorer' | 'analysis';
  search: string;
  statusSlot?: ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="topbar-logo">
          <div className="topbar-logo-icon">⚡</div>
          <div className="topbar-logo-text">
            <span className="topbar-wordmark">Decision Tracer</span>
            <span className="topbar-sub">Entity Matching</span>
          </div>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Workspace mode">
          <NavLink className={({ isActive }) => `mode-tab${isActive ? ' mode-tab--active' : ''}`} to={{ pathname: '/explorer', search }}>
            Explorer
          </NavLink>
          <NavLink className={({ isActive }) => `mode-tab${isActive ? ' mode-tab--active' : ''}`} to={{ pathname: '/analysis', search }}>
            Analysis
          </NavLink>
        </div>
      </div>

      <div className="topbar-status">
        {statusSlot ?? <span className="topbar-status-chip">{currentView === 'analysis' ? 'Analysis' : 'Explorer'}</span>}
      </div>
    </header>
  );
}
