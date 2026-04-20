import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppTopbar } from '../components/AppTopbar';
import { JsonHighlight } from '../components/JsonHighlight';
import { StatusBadge } from '../components/StatusBadge';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
import { getAnomalies } from '../lib/api';
import { humanizeToken } from '../lib/sourceResolution';
import type { AnomalyRecord } from '../types';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All scopes' },
  { value: 'source_linked', label: 'Source-linked' },
  { value: 'run_master_level', label: 'Run/master-level' },
] as const;

const SIGNAL_OPTIONS = [
  { value: 'all', label: 'All signals' },
  { value: 'informational', label: 'Informational' },
  { value: 'investigate', label: 'Investigate' },
  { value: 'requires_human_resolution', label: 'Needs human resolution' },
] as const;

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All severities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

type SourceLinkedGroup = {
  sourceTraceId: string;
  sourceModule?: string | null;
  sourceUniqueId?: string | null;
  sourceEntityName?: string | null;
  anomalies: AnomalyRecord[];
};

function formatAnomalyLabel(value?: string | null) {
  return humanizeToken(value, 'anomaly');
}

function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function signalPriority(value?: string | null) {
  switch (value) {
    case 'requires_human_resolution':
      return 3;
    case 'investigate':
      return 2;
    case 'informational':
      return 1;
    default:
      return 0;
  }
}

function highestSignal(items: AnomalyRecord[]) {
  return [...items].sort(
    (left, right) => signalPriority(right.operator_signal) - signalPriority(left.operator_signal),
  )[0]?.operator_signal || null;
}

function groupSourceLinkedAnomalies(items: AnomalyRecord[]) {
  const groups = new Map<string, SourceLinkedGroup>();
  for (const anomaly of items) {
    const key = anomaly.source_trace_id;
    if (!key) continue;
    const existing = groups.get(key);
    if (existing) {
      existing.anomalies.push(anomaly);
      if (!existing.sourceEntityName && anomaly.source_entity_name) {
        existing.sourceEntityName = anomaly.source_entity_name;
      }
      continue;
    }
    groups.set(key, {
      sourceTraceId: key,
      sourceModule: anomaly.source_module,
      sourceUniqueId: anomaly.source_unique_id,
      sourceEntityName: anomaly.source_entity_name,
      anomalies: [anomaly],
    });
  }
  return [...groups.values()].sort(
    (left, right) => right.anomalies.length - left.anomalies.length || left.sourceTraceId.localeCompare(right.sourceTraceId),
  );
}

function buildTypeCounts(items: AnomalyRecord[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.display_name || formatAnomalyLabel(item.anomaly_type);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function deriveScopeLabel(group: SourceLinkedGroup) {
  if (group.sourceEntityName) return group.sourceEntityName;
  if (group.sourceModule && group.sourceUniqueId) {
    return `${group.sourceModule} · ${group.sourceUniqueId}`;
  }
  return group.sourceTraceId;
}

function deriveGroupKey(anomaly: AnomalyRecord) {
  if (anomaly.group_key) return anomaly.group_key;
  const details = anomaly.anomaly_details || {};
  const standardizedUrl = typeof details.standardized_url === 'string' ? details.standardized_url : null;
  const groupKey = typeof details.group_key === 'string' ? details.group_key : null;
  return standardizedUrl || groupKey || null;
}

export function AnomaliesPage({ explorer }: { explorer: TraceExplorerState }) {
  const navigate = useNavigate();
  const { selectedRunId, summary, openSourceRecord } = explorer;
  const [scopeFilter, setScopeFilter] = useState<(typeof SCOPE_OPTIONS)[number]['value']>('all');
  const [signalFilter, setSignalFilter] = useState<(typeof SIGNAL_OPTIONS)[number]['value']>('all');
  const [severityFilter, setSeverityFilter] = useState<(typeof SEVERITY_OPTIONS)[number]['value']>('all');
  const [typeFilter, setTypeFilter] = useState('');

  const anomaliesQuery = useQuery({
    queryKey: ['anomalies-tab', selectedRunId],
    queryFn: () => getAnomalies({ runId: selectedRunId, limit: 5000 }),
    enabled: Boolean(selectedRunId),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });

  const anomalies = anomaliesQuery.data ?? [];

  const availableTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const anomaly of anomalies) {
      const key = anomaly.anomaly_type;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }, [anomalies]);

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((anomaly) => {
      if (scopeFilter !== 'all' && anomaly.anomaly_scope !== scopeFilter) return false;
      if (signalFilter !== 'all' && anomaly.operator_signal !== signalFilter) return false;
      if (severityFilter !== 'all' && anomaly.anomaly_severity !== severityFilter) return false;
      if (typeFilter && anomaly.anomaly_type !== typeFilter) return false;
      return true;
    });
  }, [anomalies, scopeFilter, signalFilter, severityFilter, typeFilter]);

  const sourceLinkedGroups = useMemo(
    () => groupSourceLinkedAnomalies(filteredAnomalies.filter((item) => item.anomaly_scope === 'source_linked')),
    [filteredAnomalies],
  );
  const runMasterLevelAnomalies = useMemo(
    () => filteredAnomalies.filter((item) => item.anomaly_scope === 'run_master_level'),
    [filteredAnomalies],
  );

  const needsHumanResolutionCount = anomalies.filter(
    (item) => item.operator_signal === 'requires_human_resolution',
  ).length;

  return (
    <div className="shell shell--anomalies">
      <AppTopbar
        currentView="anomalies"
        runIds={explorer.runsQuery.data ?? []}
        selectedRunId={explorer.selectedRunId}
        onRunChange={(runId) => explorer.updateParam('run_id', runId)}
      />

      <div className="anomalies-page-shell">
        <section className="anomalies-toolbar">
          <div className="anomalies-toolbar-main">
            <div className="explorer-toolbar-copy">
              <div className="explorer-toolbar-title">Anomaly Explorer</div>
              <div className="explorer-toolbar-sub">
                Understand which anomaly signals were tied to source records and which ones are run/master-level overlap warnings.
              </div>
            </div>

            <div className="explorer-toolbar-controls">
              <span className="topbar-filter-label">Scope</span>
              <select className="topbar-select" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)}>
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <span className="topbar-filter-label">Signal</span>
              <select className="topbar-select" value={signalFilter} onChange={(event) => setSignalFilter(event.target.value as typeof signalFilter)}>
                {SIGNAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <span className="topbar-filter-label">Severity</span>
              <select className="topbar-select" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)}>
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <span className="topbar-filter-label">Type</span>
              <select className="topbar-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">all anomaly types</option>
                {availableTypes.map(([type, count]) => (
                  <option key={type} value={type}>
                    {formatAnomalyLabel(type)} ({count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="anomaly-summary-strip">
            <div className="anomaly-summary-pill">
              <span className="anomaly-summary-number">{summary?.anomaly_total ?? anomalies.length}</span>
              <span>total anomaly signals</span>
            </div>
            <div className="anomaly-summary-pill">
              <span className="anomaly-summary-number">{summary?.source_linked_anomaly_total ?? 0}</span>
              <span>source-linked</span>
            </div>
            <div className="anomaly-summary-pill">
              <span className="anomaly-summary-number">{summary?.run_master_level_anomaly_total ?? 0}</span>
              <span>run/master-level</span>
            </div>
            <div className="anomaly-summary-pill anomaly-summary-pill--warn">
              <span className="anomaly-summary-number">{needsHumanResolutionCount}</span>
              <span>needs human resolution</span>
            </div>
          </div>
        </section>

        <section className="anomaly-glossary-card">
          <div className="section-title">
            <span className="section-title-text">What these signals mean</span>
            <span className="section-hint">plain-language interpretation for the run</span>
          </div>
          <div className="anomaly-glossary-grid">
            <div className="anomaly-glossary-item">
              <div className="anomaly-glossary-label">Source-linked anomalies</div>
              <p>
                These are attached to a specific source record’s resolution path. They explain things like agent routing,
                unresolved candidates, or source-level consolidation risk.
              </p>
            </div>
            <div className="anomaly-glossary-item">
              <div className="anomaly-glossary-label">Run/master-level signals</div>
              <p>
                These are overlap or consolidation warnings across the resolved master set for the run. They are not the same
                as unresolved source records.
              </p>
            </div>
          </div>
        </section>

        <div className="anomalies-page-grid">
          <section className="section">
            <div className="section-title">
              <span className="section-title-text">Source-linked anomalies</span>
              <span className="section-hint">{sourceLinkedGroups.length} source groups</span>
            </div>
            {sourceLinkedGroups.length === 0 ? (
              <div className="empty-state anomaly-empty-state">No source-linked anomalies matched the current filters.</div>
            ) : (
              <div className="anomaly-group-list">
                {sourceLinkedGroups.map((group) => {
                  const signal = highestSignal(group.anomalies);
                  const typeCounts = buildTypeCounts(group.anomalies);
                  return (
                    <article key={group.sourceTraceId} className="anomaly-group-card">
                      <div className="anomaly-group-head">
                        <div>
                          <div className="anomaly-group-title">{deriveScopeLabel(group)}</div>
                          <div className="anomaly-group-meta">
                            {group.sourceModule || 'source'} · {group.sourceUniqueId || group.sourceTraceId}
                          </div>
                        </div>
                        <div className="anomaly-group-actions">
                          {signal && <StatusBadge label={signal} />}
                          <button
                            type="button"
                            className="anomaly-open-link"
                            onClick={() => {
                              if (group.sourceModule && group.sourceUniqueId) {
                                openSourceRecord(group.sourceModule, group.sourceUniqueId);
                              }
                              navigate('/explorer');
                            }}
                          >
                            Open in Explorer
                          </button>
                        </div>
                      </div>

                      <div className="anomaly-pill-row">
                        {typeCounts.map(([label, count]) => (
                          <span key={label} className="anomaly-type-pill">
                            {label} ({count})
                          </span>
                        ))}
                      </div>

                      <div className="anomaly-card-grid">
                        {group.anomalies.map((anomaly) => (
                          <div key={anomaly.id} className="anomaly-card-surface">
                            <div className="anomaly-card-head">
                              <div>
                                <div className="anomaly-card-title">
                                  {anomaly.display_name || formatAnomalyLabel(anomaly.anomaly_type)}
                                </div>
                                <div className="anomaly-card-reason">{anomaly.plain_meaning || anomaly.anomaly_reason}</div>
                              </div>
                              <div className="anomaly-card-badges">
                                <span className={`badge anomaly-severity-badge anomaly-severity-badge--${anomaly.anomaly_severity}`}>
                                  {anomaly.anomaly_severity}
                                </span>
                                {anomaly.operator_signal && <StatusBadge label={anomaly.operator_signal} />}
                              </div>
                            </div>
                            <div className="anomaly-card-meta">
                              <span>{formatTimestamp(anomaly.created_at)}</span>
                              {anomaly.winner_entity_name && <span>Winner: {anomaly.winner_entity_name}</span>}
                            </div>
                            <details className="payload-disclosure">
                              <summary>Raw anomaly details</summary>
                              <div className="json-body json-body--embedded">
                                <JsonHighlight data={anomaly.anomaly_details} />
                              </div>
                            </details>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="section">
            <div className="section-title">
              <span className="section-title-text">Run/master-level signals</span>
              <span className="section-hint">{runMasterLevelAnomalies.length} anomaly rows</span>
            </div>
            {runMasterLevelAnomalies.length === 0 ? (
              <div className="empty-state anomaly-empty-state">No run/master-level signals matched the current filters.</div>
            ) : (
              <div className="anomaly-card-grid">
                {runMasterLevelAnomalies.map((anomaly) => {
                  const groupKey = deriveGroupKey(anomaly);
                  return (
                    <article key={anomaly.id} className="anomaly-card-surface anomaly-card-surface--run-level">
                      <div className="anomaly-card-head">
                        <div>
                          <div className="anomaly-card-title">
                            {anomaly.display_name || formatAnomalyLabel(anomaly.anomaly_type)}
                          </div>
                          <div className="anomaly-card-reason">{anomaly.plain_meaning || anomaly.anomaly_reason}</div>
                        </div>
                        <div className="anomaly-card-badges">
                          <span className={`badge anomaly-severity-badge anomaly-severity-badge--${anomaly.anomaly_severity}`}>
                            {anomaly.anomaly_severity}
                          </span>
                          {anomaly.operator_signal && <StatusBadge label={anomaly.operator_signal} />}
                        </div>
                      </div>
                      <div className="anomaly-card-meta anomaly-card-meta--stack">
                        {anomaly.winner_entity_name && <span>Affected winner: {anomaly.winner_entity_name}</span>}
                        {groupKey && <span>Group key: {groupKey}</span>}
                        <span>{formatTimestamp(anomaly.created_at)}</span>
                      </div>
                      <details className="payload-disclosure">
                        <summary>Raw anomaly details</summary>
                        <div className="json-body json-body--embedded">
                          <JsonHighlight data={anomaly.anomaly_details} />
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
