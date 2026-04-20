import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../theme';

export function AppTopbar({
  currentView,
  statusSlot,
  runIds,
  selectedRunId,
  onRunChange,
}: {
  currentView: 'explorer' | 'anomalies' | 'chat' | 'review';
  statusSlot?: ReactNode;
  runIds?: string[];
  selectedRunId?: string;
  onRunChange?: (runId: string) => void;
}) {
  const { mode, toggleMode } = useTheme();

  return (
    <header className={`topbar topbar--${currentView}`}>
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
          <NavLink className={({ isActive }) => `mode-tab${isActive ? ' mode-tab--active' : ''}`} to="/anomalies">
            Anomalies
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
        {runIds && runIds.length > 0 && onRunChange && (
          <label className="topbar-run-picker">
            <span className="topbar-run-picker-label">Run</span>
            <select
              className="topbar-run-picker-select"
              value={selectedRunId ?? ''}
              onChange={(event) => onRunChange(event.target.value)}
              aria-label="Select run"
            >
              {!selectedRunId && <option value="">Select run…</option>}
              {runIds.map((runId) => (
                <option key={runId} value={runId}>
                  {runId}
                </option>
              ))}
            </select>
          </label>
        )}
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
        {statusSlot}
      </div>
    </header>
  );
}
