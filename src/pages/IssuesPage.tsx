import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppTopbar } from '../components/AppTopbar';
import { JsonHighlight } from '../components/JsonHighlight';
import { StatusBadge } from '../components/StatusBadge';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
import { getIssues } from '../lib/api';
import { humanizeToken } from '../lib/sourceResolution';
import type { IssueRecord } from '../types';

const SCOPE_OPTIONS = ['all', 'main', 'parent'] as const;
const SEVERITY_OPTIONS = ['all', 'low', 'medium', 'high', 'critical'] as const;
const STATUS_OPTIONS = ['all', 'open', 'resolved', 'blocked', 'pending'] as const;
const GROUP_OPTIONS = ['source', 'component', 'type'] as const;

function issueLabel(value?: string | null) {
  return humanizeToken(value, 'issue');
}

function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function sourceLabel(issue: IssueRecord) {
  if (issue.source_entity_name) return issue.source_entity_name;
  if (issue.source_module && issue.source_unique_id) {
    return `${issue.source_module} · ${issue.source_unique_id}`;
  }
  return issue.source_trace_id || 'Run-level issue';
}

function componentLabel(issue: IssueRecord) {
  return issue.component_key || 'No component';
}

function groupIssues(items: IssueRecord[], mode: (typeof GROUP_OPTIONS)[number]) {
  const groups = new Map<string, IssueRecord[]>();
  for (const issue of items) {
    const key =
      mode === 'component'
        ? componentLabel(issue)
        : mode === 'type'
          ? issue.issue_type
          : sourceLabel(issue);
    const bucket = groups.get(key);
    if (bucket) bucket.push(issue);
    else groups.set(key, [issue]);
  }
  return [...groups.entries()].sort(
    (left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]),
  );
}

export function IssuesPage({ explorer }: { explorer: TraceExplorerState }) {
  const navigate = useNavigate();
  const { selectedRunId, summary, openSourceRecord, selectReviewCase, setReviewTab } = explorer;
  const [inputScope, setInputScope] = useState<(typeof SCOPE_OPTIONS)[number]>('all');
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number]>('all');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [groupMode, setGroupMode] = useState<(typeof GROUP_OPTIONS)[number]>('source');

  const issuesQuery = useQuery({
    queryKey: ['issues-tab', selectedRunId, inputScope, severity, status, typeFilter],
    queryFn: () =>
      getIssues({
        runId: selectedRunId,
        inputScope: inputScope === 'all' ? undefined : inputScope,
        severity: severity === 'all' ? undefined : severity,
        status: status === 'all' ? undefined : status,
        issueType: typeFilter || undefined,
        limit: 5000,
      }),
    enabled: Boolean(selectedRunId),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });

  const issues = issuesQuery.data ?? [];
  const availableTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of issues) {
      counts.set(issue.issue_type, (counts.get(issue.issue_type) || 0) + 1);
    }
    return [...counts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    );
  }, [issues]);
  const groupedIssues = useMemo(() => groupIssues(issues, groupMode), [groupMode, issues]);
  const linkedReviewCount = issues.filter((issue) => Boolean(issue.review_case_id)).length;

  return (
    <div className="shell shell--anomalies">
      <AppTopbar
        currentView="issues"
        runIds={explorer.runsQuery.data ?? []}
        selectedRunId={explorer.selectedRunId}
        onRunChange={(runId) => explorer.updateParam('run_id', runId)}
      />

      <div className="anomalies-page-shell">
        <section className="anomalies-toolbar">
          <div className="anomalies-toolbar-main">
            <div className="explorer-toolbar-copy">
              <div className="explorer-toolbar-title">Issues Workspace</div>
              <div className="explorer-toolbar-sub">
                Read-only diagnostics grouped by source, component, or issue type. Review cases remain the human-action surface.
              </div>
            </div>

            <div className="explorer-toolbar-controls">
              <span className="topbar-filter-label">Scope</span>
              <select className="topbar-select" value={inputScope} onChange={(event) => setInputScope(event.target.value as typeof inputScope)}>
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{issueLabel(option)}</option>
                ))}
              </select>

              <span className="topbar-filter-label">Severity</span>
              <select className="topbar-select" value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}>
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{issueLabel(option)}</option>
                ))}
              </select>

              <span className="topbar-filter-label">Status</span>
              <select className="topbar-select" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{issueLabel(option)}</option>
                ))}
              </select>

              <span className="topbar-filter-label">Group</span>
              <select className="topbar-select" value={groupMode} onChange={(event) => setGroupMode(event.target.value as typeof groupMode)}>
                {GROUP_OPTIONS.map((option) => (
                  <option key={option} value={option}>{issueLabel(option)}</option>
                ))}
              </select>

              <span className="topbar-filter-label">Type</span>
              <select className="topbar-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">all issue types</option>
                {availableTypes.map(([type, count]) => (
                  <option key={type} value={type}>
                    {issueLabel(type)} ({count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="anomaly-summary-strip">
            <div className="anomaly-summary-pill">
              <span className="anomaly-summary-number">{summary?.issue_count ?? issues.length}</span>
              <span>open issues in run</span>
            </div>
            <div className="anomaly-summary-pill">
              <span className="anomaly-summary-number">{issues.length}</span>
              <span>visible after filters</span>
            </div>
            <div className="anomaly-summary-pill anomaly-summary-pill--warn">
              <span className="anomaly-summary-number">{linkedReviewCount}</span>
              <span>linked review cases</span>
            </div>
          </div>
        </section>

        <div className="anomalies-page-grid anomalies-page-grid--single">
          <section className="section">
            <div className="section-title">
              <span className="section-title-text">Grouped Issues</span>
              <span className="section-hint">{groupedIssues.length} groups</span>
            </div>
            {issuesQuery.isLoading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
                loading issues…
              </div>
            ) : groupedIssues.length === 0 ? (
              <div className="empty-state anomaly-empty-state">No issues matched the current filters.</div>
            ) : (
              <div className="anomaly-group-list">
                {groupedIssues.map(([groupKey, groupItems]) => (
                  <article key={groupKey} className="anomaly-group-card">
                    <div className="anomaly-group-head">
                      <div>
                        <div className="anomaly-group-title">{groupKey}</div>
                        <div className="anomaly-group-meta">
                          {groupItems.length} issue{groupItems.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    <div className="anomaly-card-grid">
                      {groupItems.map((issue) => (
                        <div key={issue.id} className="anomaly-card-surface">
                          <div className="anomaly-card-head">
                            <div>
                              <div className="anomaly-card-title">
                                {issue.display_name || issueLabel(issue.issue_type)}
                              </div>
                              <div className="anomaly-card-reason">{issue.plain_meaning || issue.reason}</div>
                            </div>
                            <div className="anomaly-card-badges">
                              <span className={`badge anomaly-severity-badge anomaly-severity-badge--${issue.severity}`}>
                                {issue.severity}
                              </span>
                              <StatusBadge label={issue.status} />
                            </div>
                          </div>
                          <div className="anomaly-card-meta anomaly-card-meta--stack">
                            <span>Scope: {issue.input_scope || 'main'}</span>
                            <span>Source: {sourceLabel(issue)}</span>
                            <span>Component: {componentLabel(issue)}</span>
                            <span>{formatTimestamp(issue.created_at)}</span>
                          </div>
                          <div className="anomaly-group-actions">
                            {issue.source_module && issue.source_unique_id && (
                              <button
                                type="button"
                                className="anomaly-open-link"
                                onClick={() => {
                                  openSourceRecord(issue.source_module || '', issue.source_unique_id || '');
                                  navigate('/explorer');
                                }}
                              >
                                Open Explorer
                              </button>
                            )}
                            {issue.review_case_id && (
                              <button
                                type="button"
                                className="anomaly-open-link"
                                onClick={() => {
                                  setReviewTab('needs_review');
                                  selectReviewCase(issue.review_case_id || '');
                                  navigate('/review');
                                }}
                              >
                                Open Review
                              </button>
                            )}
                          </div>
                          <details className="payload-disclosure">
                            <summary>Issue payload</summary>
                            <div className="json-body json-body--embedded">
                              <JsonHighlight data={issue.issue_payload} />
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
