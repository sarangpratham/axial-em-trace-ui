import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export function AppTopbar({
  currentView,
  graphSearch,
  statusSlot,
}: {
  currentView: 'explorer' | 'chat' | 'graph' | 'review';
  graphSearch?: string;
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
          <NavLink className={({ isActive }) => `mode-tab${isActive ? ' mode-tab--active' : ''}`} to="/explorer">
            Explorer
          </NavLink>
          <NavLink className={({ isActive }) => `mode-tab${isActive ? ' mode-tab--active' : ''}`} to="/chat">
            Chat
          </NavLink>
          <NavLink
            className={({ isActive }) => `mode-tab${isActive ? ' mode-tab--active' : ''}`}
            to={currentView === 'graph' && graphSearch
              ? { pathname: '/graph', search: graphSearch }
              : '/graph'}
          >
            Graph
          </NavLink>
          <NavLink className={({ isActive }) => `mode-tab${isActive ? ' mode-tab--active' : ''}`} to="/review">
            Review
          </NavLink>
        </div>
      </div>

      <div className="topbar-status">
        {statusSlot ?? (
          <span className="topbar-status-chip">
            {
              currentView === 'chat'
                ? 'Chat'
                : currentView === 'graph'
                  ? 'Graph'
                  : currentView === 'review'
                    ? 'Review'
                    : 'Explorer'
            }
          </span>
        )}
      </div>
    </header>
  );
}
