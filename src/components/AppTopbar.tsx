import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../theme';

export function AppTopbar({
  currentView,
  statusSlot,
}: {
  currentView: 'explorer' | 'chat' | 'review';
  statusSlot?: ReactNode;
}) {
  const { mode, toggleMode } = useTheme();

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
          <NavLink className={({ isActive }) => `mode-tab${isActive ? ' mode-tab--active' : ''}`} to="/review">
            Review
          </NavLink>
        </div>
      </div>

      <div className="topbar-status">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleMode}
          aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
          aria-pressed={mode === 'light'}
        >
          <span className="theme-toggle-label">Theme</span>
          <span className="theme-toggle-value">{mode === 'light' ? 'Light' : 'Dark'}</span>
        </button>
        {statusSlot ?? (
          <span className="topbar-status-chip">
            {
              currentView === 'chat'
                ? 'Chat'
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
