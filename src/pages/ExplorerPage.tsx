import { useState } from 'react';
import { AppTopbar } from '../components/AppTopbar';
import { CandidateInspector } from '../components/CandidateInspector';
import { DecisionPipeline } from '../components/DecisionPipeline';
import { JsonHighlight } from '../components/JsonHighlight';
import { StatusBadge } from '../components/StatusBadge';
import { TraceList } from '../components/TraceList';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
import type { AgentActivityRecord, ResolutionTimelineEvent } from '../types';
import { humanizeToken, sourceResolutionLabel } from '../lib/sourceResolution';

const MODULE_OPTIONS = ['news', 'linkedin', 'portfolio'];
const ANOMALY_PRESENCE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'with', label: 'With' },
  { value: 'clean', label: 'Clean' },
] as const;

function formatAnomalyLabel(value: string) {
  return value.split('_').join(' ');
}

function formatLabel(value?: string | null) {
  return humanizeToken(value);
}

function hasObjectContent(value: Record<string, unknown> | null | undefined) {
  return Boolean(value && Object.keys(value).length > 0);
}

function formatTimestamp(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function changeFieldLabel(value: string) {
  return value;
}

function renderAgentSubject(activity: AgentActivityRecord) {
  if (activity.scope === 'family_consolidation') {
    const url = typeof activity.subject.standardized_url === 'string'
      ? activity.subject.standardized_url
      : null;
    return url || String(activity.subject.family_key || 'same-url family');
  }
  return String(
    activity.subject.candidate_entity_name
    || activity.subject.candidate_entity_id
    || 'candidate',
  );
}

function TimelineSection({ events }: { events: ResolutionTimelineEvent[] }) {
  const [open, setOpen] = useState(false);
  if (!events.length) return null;
  return (
    <div className="section">
      <button type="button" className={`timeline-toggle${open ? ' timeline-toggle--open' : ''}`} onClick={() => setOpen((value) => !value)}>
        <div className="timeline-toggle-copy">
          <div className="section-title">
            <span className="section-title-text">↻ Resolution Timeline</span>
            <span className="section-hint">what changed across the run</span>
          </div>
          <span className="timeline-toggle-count">{events.length} events</span>
        </div>
        <span className={`timeline-toggle-chevron${open ? ' timeline-toggle-chevron--open' : ''}`}>▶</span>
      </button>
      {open && (
        <div className="timeline-list">
          {events.map((event, index) => (
            <div className="timeline-card" key={`${event.event_type}:${index}`}>
              <div className="timeline-meta">
                <StatusBadge label={event.event_type} />
                {event.occurred_at && <span className="timeline-time">{formatTimestamp(event.occurred_at)}</span>}
              </div>
              <div className="timeline-summary">{event.summary}</div>
              {hasObjectContent(event.payload) && (
                <details className="payload-disclosure">
                  <summary>Raw payload</summary>
                  <div className="json-body json-body--embedded">
                    <JsonHighlight data={event.payload} />
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentActivitySection({ activities }: { activities: AgentActivityRecord[] }) {
  if (!activities.length) return null;
  return (
    <div className="section">
      <div className="section-title">
        <span className="section-title-text">⌘ Agent Activity</span>
        <span className="section-hint">what the model actually saw and decided</span>
      </div>
      <div className="agent-list">
        {activities.map((activity, index) => (
          <div className="agent-card" key={`${activity.lane}:${activity.scope}:${index}`}>
            <div className="agent-card-head">
              <div>
                <div className="agent-lane">{humanizeToken(activity.lane)}</div>
                <div className="agent-subject">{renderAgentSubject(activity)}</div>
              </div>
              <div className="agent-meta-stack">
                <StatusBadge label={activity.decision || activity.scope} />
                {activity.confidence && <span className="agent-confidence">{activity.confidence}</span>}
              </div>
            </div>
            {activity.reason && <div className="agent-reason">{activity.reason}</div>}
            <div className="agent-foot">
              <span className="agent-scope">{humanizeToken(activity.scope)}</span>
              {activity.used_web_search && <span className="agent-web-pill">web evidence</span>}
              {activity.occurred_at && <span className="agent-time">{formatTimestamp(activity.occurred_at)}</span>}
            </div>
            {(hasObjectContent(activity.raw_prompt_payload) || hasObjectContent(activity.raw_response_payload)) && (
              <details className="payload-disclosure">
                <summary>Raw prompt + response</summary>
                <div className="payload-grid">
                  <div>
                    <div className="payload-title">Prompt payload</div>
                    <div className="json-body json-body--embedded">
                      <JsonHighlight data={activity.raw_prompt_payload} />
                    </div>
                  </div>
                  <div>
                    <div className="payload-title">Response payload</div>
                    <div className="json-body json-body--embedded">
                      <JsonHighlight data={activity.raw_response_payload} />
                    </div>
                  </div>
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExplorerToolbar({ explorer }: { explorer: TraceExplorerState }) {
  const {
    updateParam,
    searchInput,
    setSearchInput,
    moduleFilter,
    statusFilter,
    decisionSourceFilter,
    summary,
    anomalyPresenceFilter,
    anomalyTypeFilter,
    availableAnomalyTypes,
    setAnomalyPresenceFilter,
    setAnomalyTypeFilter,
    publishSummary,
  } = explorer;

  return (
    <section className="explorer-toolbar">
      <div className="explorer-toolbar-main">
        <div className="explorer-toolbar-copy">
          <div className="explorer-toolbar-title">Explorer Filters</div>
        </div>

        <div className="explorer-toolbar-controls">
          <span className="topbar-filter-label">Search</span>
          <input
            className="topbar-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="entity name or ID..."
          />

          <span className="topbar-filter-label">Module</span>
          <select className="topbar-select" value={moduleFilter} onChange={(event) => updateParam('module', event.target.value)}>
            <option value="">all</option>
            {MODULE_OPTIONS.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>

          <span className="topbar-filter-label">Outcome</span>
          <select className="topbar-select" value={statusFilter} onChange={(event) => updateParam('resolution_status', event.target.value)}>
            <option value="">all</option>
            <option value="assigned_existing_master">assigned_existing_master</option>
            <option value="created_new_master">created_new_master</option>
            <option value="pending_review">pending_review</option>
          </select>

          <span className="topbar-filter-label">Decision source</span>
          <select className="topbar-select" value={decisionSourceFilter} onChange={(event) => updateParam('decision_source', event.target.value)}>
            <option value="">all</option>
            <option value="deterministic">deterministic</option>
            <option value="url_web_agent">url_web_agent</option>
            <option value="context_agent">context_agent</option>
            <option value="human_review">human_review</option>
          </select>
        </div>
      </div>

      <div className="explorer-anomaly-rail">
        <div className="explorer-anomaly-group">
          <span className="topbar-filter-label">Anomalies</span>
          <div className="anomaly-segmented-control" role="group" aria-label="Anomaly presence filter">
            {ANOMALY_PRESENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`anomaly-segment${anomalyPresenceFilter === option.value ? ' anomaly-segment--active' : ''}${
                  option.value === 'with' ? ' anomaly-segment--warn' : option.value === 'clean' ? ' anomaly-segment--clean' : ''
                }`}
                onClick={() => setAnomalyPresenceFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="explorer-anomaly-group">
          <span className="topbar-filter-label">Type</span>
          <select
            className="topbar-select explorer-anomaly-select"
            value={anomalyTypeFilter}
            onChange={(event) => setAnomalyTypeFilter(event.target.value)}
            disabled={anomalyPresenceFilter === 'clean' || availableAnomalyTypes.length === 0}
          >
            <option value="">
              {availableAnomalyTypes.length > 0 ? 'all anomaly types' : 'no anomaly types'}
            </option>
            {availableAnomalyTypes.map(([type, count]) => (
              <option key={type} value={type}>
                {formatAnomalyLabel(type)} ({count})
              </option>
            ))}
          </select>
          </div>
        </div>

      {summary && (
        <div className="explorer-toolbar-stats">
          <div className="stat-pill stat-pill--total">
            <span className="num">{summary.processed_source_count}</span> total
          </div>
          <div className="stat-divider" />
          <div className="stat-pill stat-pill--match">
            <span className="stat-dot" />
            <span className="num">{summary.resolved_existing_master_count}</span> assigned existing
          </div>
          <div className="stat-pill stat-pill--new">
            <span className="stat-dot" />
            <span className="num">{summary.created_new_master_count}</span> created new
          </div>
          <div className="stat-pill stat-pill--none">
            <span className="stat-dot" />
            <span className="num">{summary.pending_review_source_count}</span> pending review
          </div>
          {publishSummary && (
            <>
              <div className="stat-divider" />
              <div className="stat-pill stat-pill--review">
                <span className="num">{publishSummary.open_review_case_count}</span> open review
              </div>
              <div className="stat-pill stat-pill--review">
                <span className="num">{publishSummary.reviewed_unpublished_case_count}</span> ready
              </div>
              <div className="stat-pill stat-pill--blocked">
                <span className="num">{publishSummary.publish_blocked_case_count}</span> blocked
              </div>
              <div className="stat-pill stat-pill--failed">
                <span className="num">{publishSummary.publish_failed_case_count}</span> failed
              </div>
              <div className="stat-pill stat-pill--published">
                <span className="num">{publishSummary.published_case_count}</span> published
              </div>
              <div className="stat-pill stat-pill--review">
                Parent {formatLabel(publishSummary.parent_processing_status || 'pending')}
              </div>
              {Boolean(publishSummary.deferred_parent_observation_count) && (
                <div className="stat-pill stat-pill--review">
                  <span className="num">{publishSummary.deferred_parent_observation_count}</span> parent pending
                </div>
              )}
            </>
          )}
          {summary.anomaly_total && summary.anomaly_total > 0 && (
            <>
              <div className="stat-divider" />
              <div className="stat-pill stat-pill--anomaly">
                <span className="stat-dot" style={{ background: 'var(--red)' }} />
                <span className="num">{summary.anomaly_total}</span> anomaly signals
              </div>
              {summary.anomaly_by_severity &&
                Object.entries(summary.anomaly_by_severity).map(([severity, count]) => (
                  <div key={severity} className={`stat-pill stat-pill--severity-${severity}`}>
                    <span className="num">{count}</span> {severity}
                  </div>
                ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function ExplorerPage({ explorer }: { explorer: TraceExplorerState }) {
  const {
    detail,
    detailQuery,
    enrichment,
    isMatch,
    isNew,
    jsonOpen,
    selectedTrace,
    selectedTraceKey,
    selectTrace,
    setJsonOpen,
    traces,
    tracesQuery,
  } = explorer;

  const retrievalDebug = detail?.retrieval_debug ?? detail?.retrieval_summary ?? {};
  const evaluationContext = detail?.evaluation_context;
  const resolution = (detail?.resolution ?? {}) as Record<string, unknown>;
  const sameUrlMerge = (resolution.same_url_family_merge ?? {}) as Record<string, unknown>;
  const assignedEntityRemap = (sameUrlMerge.assigned_entity_id ?? {}) as Record<string, unknown>;
  const remapPrevious = typeof assignedEntityRemap.previous === 'string' ? assignedEntityRemap.previous : null;
  const remapCurrent = typeof assignedEntityRemap.current === 'string' ? assignedEntityRemap.current : null;
  const changedFields = evaluationContext?.changed_fields ?? [];
  const changeSources = evaluationContext?.change_sources ?? {};
  const rawSource = detail?.raw_source ?? detail?.source ?? {};
  const currentSource = detail?.current_source ?? {};
  const hasSourceDiff = changedFields.length > 0;
  const retrievalCount = (() => {
    const explicitCount = typeof retrievalDebug.candidate_count === 'number'
      ? retrievalDebug.candidate_count
      : typeof retrievalDebug.final_candidate_count === 'number'
        ? retrievalDebug.final_candidate_count
        : null;
    return explicitCount ?? detail?.candidate_count ?? 0;
  })();

  return (
    <div className="shell shell--explorer">
      <AppTopbar
        currentView="explorer"
        runIds={explorer.runsQuery.data ?? []}
        selectedRunId={explorer.selectedRunId}
        onRunChange={(runId) => explorer.updateParam('run_id', runId)}
      />

      <div className="explorer-shell">
        <ExplorerToolbar explorer={explorer} />

        <aside className="sidebar">
          <div className="sidebar-head">
            <span className="sidebar-head-title">Source Entities</span>
            <span className="sidebar-head-count">{traces.length}</span>
          </div>
          {tracesQuery.isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              loading…
            </div>
          ) : tracesQuery.isError ? (
            <div className="error-state">
              <span>⚠</span>
              Failed to load traces
            </div>
          ) : (
            <TraceList
              traces={traces}
              selectedTraceId={selectedTraceKey}
              activeAnomalyType={explorer.anomalyTypeFilter}
              onSelect={selectTrace}
            />
          )}
        </aside>

        <main className="main">
          {!selectedTrace ? (
            <div className="empty-state empty-state--panel">
              <span className="empty-icon">⬡</span>
              <p>Select an entity to inspect its decision story</p>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="loading-state loading-state--panel">
              <div className="loading-spinner" />
              loading trace detail…
            </div>
          ) : detailQuery.isError ? (
            <div className="error-state error-state--panel">
              <span>⚠</span>
              Failed to load trace detail
            </div>
          ) : detail ? (
            <div className="detail-animate" key={`${detail.source_module}::${detail.source_unique_id}`}>
              <div className="detail-header">
                <div>
                  <div className="detail-eyebrow">
                    {detail.source_module} · {detail.source_unique_id}
                  </div>
                  <div className="detail-name">{detail.source_entity_name}</div>
                  <div className="detail-story">{detail.decision_story}</div>
                </div>
                <div className="detail-badges">
                  <StatusBadge label={detail.resolution_status} />
                  {detail.decision_source && <StatusBadge label={detail.decision_source} />}
                </div>
              </div>

              <div className="metrics-row">
                <div className="metric-block">
                  <div className="metric-label">Candidates</div>
                  <div className="metric-value">{detail.candidate_count}</div>
                  <div className="metric-sub">evaluated against masters</div>
                  <div className="metric-bar" style={{ background: 'var(--blue-dim)' }} />
                </div>
                <div className="metric-block">
                  <div className="metric-label">Viable</div>
                  <div className="metric-value" style={{ color: 'var(--green)' }}>
                    {detail.viable_candidate_count}
                  </div>
                  <div className="metric-sub">survived evaluation</div>
                  <div className="metric-bar" style={{ background: 'var(--green-dim)' }} />
                </div>
                <div className="metric-block">
                  <div className="metric-label">Retrieval</div>
                  <div className="metric-value">{String(retrievalCount)}</div>
                  <div className="metric-sub">retrieval pool surfaced</div>
                  <div className="metric-bar" style={{ background: 'var(--blue-dim)' }} />
                </div>
                <div className="metric-block">
                  <div className="metric-label">Decision Source</div>
                  <div className="metric-value" style={{ color: isMatch ? 'var(--green)' : isNew ? 'var(--purple)' : 'var(--red)' }}>
                    {humanizeToken(detail.decision_source, 'pending review')}
                  </div>
                  <div className="metric-sub">final resolution route</div>
                  <div
                    className="metric-bar"
                    style={{
                      background: isMatch
                        ? 'var(--green-dim)'
                        : isNew
                          ? 'var(--purple-dim)'
                          : 'var(--red-dim)',
                    }}
                  />
                </div>
              </div>

              <div className="section">
                <div className="section-title">
                  <span className="section-title-text">⟶ Resolution Pipeline</span>
                  <span className="section-hint">click a step to inspect</span>
                </div>
                <DecisionPipeline detail={detail} />
              </div>

              <div className="section">
                <div className="section-title">
                  <span className="section-title-text">◎ Outcome Details</span>
                </div>
                <div className="outcome-grid">
                  {isMatch ? (
                    <div className="winner-strip">
                      <span className="winner-icon">🏆</span>
                      <div>
                        <div className="winner-label">Assigned Master</div>
                        <div className="winner-name">{detail.assigned_entity_name || detail.assigned_entity_id || 'Assigned entity'}</div>
                        <div className="winner-id">
                          {detail.assigned_entity_id} · {humanizeToken(detail.decision_source, 'deterministic')}
                        </div>
                        {remapPrevious && remapCurrent && remapPrevious !== remapCurrent && (
                          <div className="winner-remap-note">
                            Originally created {remapPrevious}, later consolidated into {remapCurrent}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : isNew ? (
                    <div className="winner-strip winner-strip--new">
                      <span className="winner-icon">✦</span>
                      <div>
                        <div className="winner-label winner-label--new">Created New Master</div>
                        <div className="winner-name" style={{ color: 'var(--text2)' }}>
                          {detail.assigned_entity_id ?? 'Queued for creation'}
                        </div>
                        <div className="winner-id">No viable existing master remained</div>
                      </div>
                    </div>
                  ) : (
                    <div className="winner-strip winner-strip--empty">
                      <span className="winner-icon" style={{ filter: 'grayscale(1)' }}>🚫</span>
                      <div>
                        <div className="winner-label winner-label--empty">Pending Review</div>
                        <div className="winner-name" style={{ color: 'var(--text2)' }}>
                          {sourceResolutionLabel(detail.resolution_status)}
                        </div>
                        <div className="winner-id">A human decision is still required</div>
                      </div>
                    </div>
                  )}

                  <div className="enrichment-card evaluation-card">
                    <div>
                      <div className="enrichment-title">Evaluation Snapshot</div>
                      <div className="context-list">
                        <div className="context-row">
                          <span>Source URL at evaluation</span>
                          <strong>{evaluationContext?.source_url_at_evaluation || 'missing'}</strong>
                        </div>
                        <div className="context-row">
                          <span>Current source URL</span>
                          <strong>{evaluationContext?.current_source_url || 'missing'}</strong>
                        </div>
                        {evaluationContext?.url_matching_skipped_reason && (
                          <div className="context-row">
                            <span>URL context</span>
                            <strong>{humanizeToken(evaluationContext.url_matching_skipped_reason)}</strong>
                          </div>
                        )}
                      </div>
                      <span className={`enrichment-url${!enrichment?.eligible ? ' enrichment-url--none' : ''}`}>
                        {String(enrichment?.final_matching_url ?? 'no enrichment URL')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <TimelineSection events={detail.resolution_timeline} />

              <div className="section">
                <div className="section-title">
                  <span className="section-title-text">≡ Candidate Evaluations</span>
                  <span className="section-hint">
                    {detail.candidate_evaluations.length} candidates · click a row for evidence
                  </span>
                </div>
                <CandidateInspector
                  candidates={detail.candidate_evaluations}
                  evaluationContext={detail.evaluation_context}
                />
              </div>

              <AgentActivitySection activities={detail.agent_activity} />

              {hasObjectContent(retrievalDebug) && (
                <div className="section">
                  <div className="section-title">
                    <span className="section-title-text">⊛ Candidate Retrieval</span>
                    <span className="section-hint">actual retrieval debug payload</span>
                  </div>
                  <div className="json-body json-body--embedded">
                    <JsonHighlight data={retrievalDebug} />
                  </div>
                </div>
              )}

              <div className="section section--source-data">
                <div className="section-title">
                  <span className="section-title-text">⌗ Source Data</span>
                  <span className="section-hint">original raw row vs final written-back row</span>
                </div>
                {hasSourceDiff && (
                  <div className="change-summary">
                    <div className="change-summary-title">Changed after processing</div>
                    <div className="change-pill-row">
                      {changedFields.map((field) => (
                        <span key={field} className="change-pill">{changeFieldLabel(field)}</span>
                      ))}
                    </div>
                    {Object.entries(changeSources).length > 0 && (
                      <div className="change-source-list">
                        {Object.entries(changeSources).map(([field, sources]) => (
                          <div className="change-source-row" key={field}>
                            <span>{field}</span>
                            <strong>{sources.join(', ')}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button className={`json-toggle${jsonOpen ? ' json-toggle--open' : ''}`} onClick={() => setJsonOpen((value) => !value)}>
                  <span className={`json-chevron${jsonOpen ? ' json-chevron--open' : ''}`}>▶</span>
                  Source data JSON
                  <span className="json-hint">raw vs current</span>
                </button>
                {jsonOpen && (
                  <div className="source-json-grid">
                    <div className="source-json-card">
                      <div className="source-json-title">Original Raw Source JSON</div>
                      <div className="json-body json-body--embedded">
                        <JsonHighlight data={rawSource} />
                      </div>
                    </div>
                    <div className="source-json-card">
                      <div className="source-json-title">Current Written-Back Source JSON</div>
                      <div className="json-body json-body--embedded">
                        <JsonHighlight data={currentSource} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
