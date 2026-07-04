import { useEffect, useRef, useState } from 'react';
import { animate, stagger, utils } from 'animejs';
import { AlertTriangle, Bot, ChevronLeft, ChevronRight, Database, FilterX, Hexagon, RefreshCcw, Route, Search, Sparkles, Trophy } from 'lucide-react';
import { CandidateInspector } from '../components/CandidateInspector';
import { DecisionPipeline } from '../components/DecisionPipeline';
import { JsonHighlight } from '../components/JsonHighlight';
import { StatusBadge } from '../components/StatusBadge';
import { TraceList } from '../components/TraceList';
import { Button } from '../components/ui/button';
import { EmptyState, ErrorState, FilterBar, FilterField, LoadingState, MetricCard, PageContainer, PageHeader, WorkspacePanel } from '../components/workbench/layout';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
import type { AgentActivityRecord, ResolutionTimelineEvent } from '../types';
import { humanizeToken, sourceResolutionLabel } from '../lib/sourceResolution';
import { createMotionScope, MOTION, motionDistance, motionDuration } from '../motion/anime';

const MODULE_OPTIONS = ['news', 'linkedin', 'portfolio'];
const ISSUE_PRESENCE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'with', label: 'With' },
  { value: 'clean', label: 'Clean' },
] as const;

function formatIssueLabel(value: string) {
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

function getStringValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function RetrievalSection({
  retrievalDebug,
  retrievalCount,
}: {
  retrievalDebug: Record<string, unknown>;
  retrievalCount: number;
}) {
  if (!hasObjectContent(retrievalDebug)) return null;

  const exactNameKeys = getStringValues(retrievalDebug.exact_name_keys);
  const exactCandidateIds = getStringValues(retrievalDebug.exact_candidate_ids);
  const partialQueries = getStringValues(retrievalDebug.partial_name_queries);
  const partialCandidateIds = getStringValues(retrievalDebug.partial_candidate_ids);
  const finalCandidateIds = getStringValues(retrievalDebug.candidate_ids);
  const exactUrlKey = typeof retrievalDebug.exact_url_key === 'string' && retrievalDebug.exact_url_key
    ? retrievalDebug.exact_url_key
    : null;
  const partialSearchUsed = retrievalDebug.partial_search_used === true;
  const partialSearchAvailable = retrievalDebug.partial_search_available !== false;

  const partialSummary = partialSearchUsed
    ? 'Partial-name rescue ran because exact retrieval found no usable candidates.'
    : partialSearchAvailable
      ? 'Partial-name rescue did not need to run for this record.'
      : 'Partial-name rescue is unavailable in this environment.';

  return (
    <div className="section">
      <div className="section-title">
        <span className="section-title-text"><Route aria-hidden="true" /> Candidate Retrieval</span>
        <span className="section-hint">how the retrieval pool was built before evaluation</span>
      </div>

      <div className="retrieval-grid">
        <article className="retrieval-card">
          <div className="retrieval-label">Exact name lookup</div>
          <div className="retrieval-main">{exactNameKeys.length} key{exactNameKeys.length === 1 ? '' : 's'}</div>
          <div className="retrieval-sub">
            {exactNameKeys.length > 0
              ? 'Stored exact variation keys checked for this record.'
              : 'No exact variation keys matched a stored master name surface.'}
          </div>
          {exactNameKeys.length > 0 && (
            <div className="retrieval-chip-row">
              {exactNameKeys.map((key) => (
                <span key={key} className="retrieval-chip">{key}</span>
              ))}
            </div>
          )}
          {exactCandidateIds.length > 0 && (
            <div className="retrieval-note">Exact-stage hits: {exactCandidateIds.join(', ')}</div>
          )}
        </article>

        <article className="retrieval-card">
          <div className="retrieval-label">Exact URL lookup</div>
          <div className="retrieval-main">{exactUrlKey ? 'available' : 'none'}</div>
          <div className="retrieval-sub">
            {exactUrlKey
              ? 'An exact standardized URL key was available for retrieval.'
              : 'No standardized source URL was available for an exact URL lookup.'}
          </div>
          {exactUrlKey && <div className="retrieval-note retrieval-note--mono">{exactUrlKey}</div>}
        </article>

        <article className={`retrieval-card${partialSearchUsed ? ' retrieval-card--accent' : ''}`}>
          <div className="retrieval-label">Partial-name rescue</div>
          <div className="retrieval-main">
            {partialSearchUsed ? 'used' : partialSearchAvailable ? 'not needed' : 'unavailable'}
          </div>
          <div className="retrieval-sub">{partialSummary}</div>
          {partialQueries.length > 0 && (
            <div className="retrieval-chip-row">
              {partialQueries.map((query) => (
                <span key={query} className="retrieval-chip retrieval-chip--query">{query}</span>
              ))}
            </div>
          )}
          {partialCandidateIds.length > 0 && (
            <div className="retrieval-note">Partial hits: {partialCandidateIds.join(', ')}</div>
          )}
        </article>

        <article className="retrieval-card">
          <div className="retrieval-label">Final candidate pool</div>
          <div className="retrieval-main">
            {retrievalCount} candidate{retrievalCount === 1 ? '' : 's'}
          </div>
          <div className="retrieval-sub">
            {finalCandidateIds.length > 0
              ? 'Candidates that moved forward into evaluator ranking.'
              : 'No candidates survived retrieval for this record.'}
          </div>
          {finalCandidateIds.length > 0 && (
            <div className="retrieval-chip-row">
              {finalCandidateIds.map((candidateId) => (
                <span key={candidateId} className="retrieval-chip">{candidateId}</span>
              ))}
            </div>
          )}
        </article>
      </div>

      <details className="payload-disclosure">
        <summary>Raw retrieval payload</summary>
        <JsonHighlight className="json-body json-body--embedded" data={retrievalDebug} />
      </details>
    </div>
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
            <span className="section-title-text"><RefreshCcw aria-hidden="true" /> Resolution Timeline</span>
            <span className="section-hint">what changed across the run</span>
          </div>
          <span className="timeline-toggle-count">{events.length} events</span>
        </div>
        <ChevronRight aria-hidden="true" className={`timeline-toggle-chevron${open ? ' timeline-toggle-chevron--open' : ''}`} />
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
                  <JsonHighlight className="json-body json-body--embedded" data={event.payload} />
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
        <span className="section-title-text"><Bot aria-hidden="true" /> Agent Activity</span>
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
                    <JsonHighlight className="json-body json-body--embedded" data={activity.raw_prompt_payload} />
                  </div>
                  <div>
                    <div className="payload-title">Response payload</div>
                    <JsonHighlight className="json-body json-body--embedded" data={activity.raw_response_payload} />
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
    issuePresenceFilter,
    issueTypeFilter,
    availableIssueTypes,
    setIssuePresenceFilter,
    setIssueTypeFilter,
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
            <option value="needs_review_multi_master">needs_review_multi_master</option>
            <option value="unresolved">unresolved</option>
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
          <span className="topbar-filter-label">Issues</span>
          <div className="anomaly-segmented-control" role="group" aria-label="Issue presence filter">
            {ISSUE_PRESENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`anomaly-segment${issuePresenceFilter === option.value ? ' anomaly-segment--active' : ''}${
                  option.value === 'with' ? ' anomaly-segment--warn' : option.value === 'clean' ? ' anomaly-segment--clean' : ''
                }`}
                onClick={() => setIssuePresenceFilter(option.value)}
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
            value={issueTypeFilter}
            onChange={(event) => setIssueTypeFilter(event.target.value)}
            disabled={issuePresenceFilter === 'clean' || availableIssueTypes.length === 0}
          >
            <option value="">
              {availableIssueTypes.length > 0 ? 'all issue types' : 'no issue types'}
            </option>
            {availableIssueTypes.map(([type, count]) => (
              <option key={type} value={type}>
                {formatIssueLabel(type)} ({count})
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
                <span className="num">{publishSummary.decided_review_case_count}</span> ready
              </div>
              <div className="stat-pill stat-pill--blocked">
                <span className="num">{publishSummary.publish_blocked_case_count}</span> blocked
              </div>
              <div className="stat-pill stat-pill--failed">
                <span className="num">{publishSummary.failed_publish_case_count}</span> failed
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
          {summary.issue_count && summary.issue_count > 0 && (
            <>
              <div className="stat-divider" />
              <div className="stat-pill stat-pill--anomaly">
                <span className="stat-dot" style={{ background: 'var(--red)' }} />
                <span className="num">{summary.issue_count}</span> issue signals
              </div>
              {summary.issue_by_severity &&
                Object.entries(summary.issue_by_severity).map(([severity, count]) => (
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

function LegacyExplorerPage({ explorer }: { explorer: TraceExplorerState }) {
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
  const currentSource = detail?.current_source ?? detail?.source ?? {};
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
      <div className="explorer-shell explorer-shell--workbench">
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
              <AlertTriangle aria-hidden="true" />
              Failed to load traces
            </div>
          ) : (
            <TraceList
              traces={traces}
              selectedTraceId={selectedTraceKey}
              activeIssueType={explorer.issueTypeFilter}
              onSelect={selectTrace}
            />
          )}
        </aside>

        <main className="main">
          {!selectedTrace ? (
            <div className="empty-state empty-state--panel">
              <Hexagon aria-hidden="true" className="empty-icon" />
              <p>Select an entity to inspect its decision story</p>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="loading-state loading-state--panel">
              <div className="loading-spinner" />
              loading trace detail…
            </div>
          ) : detailQuery.isError ? (
            <div className="error-state error-state--panel">
              <AlertTriangle aria-hidden="true" />
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
                  <span className="section-title-text"><Route aria-hidden="true" /> Resolution Pipeline</span>
                  <span className="section-hint">click a step to inspect</span>
                </div>
                <DecisionPipeline detail={detail} />
              </div>

              <div className="section">
                <div className="section-title">
                  <span className="section-title-text"><Hexagon aria-hidden="true" /> Outcome Details</span>
                </div>
                <div className="outcome-grid">
                  {isMatch ? (
                    <div className="winner-strip">
                      <span className="winner-icon"><Trophy aria-hidden="true" /></span>
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
                      <span className="winner-icon"><Sparkles aria-hidden="true" /></span>
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

              <RetrievalSection retrievalDebug={retrievalDebug} retrievalCount={retrievalCount} />

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
                  <ChevronRight aria-hidden="true" className={`json-chevron${jsonOpen ? ' json-chevron--open' : ''}`} />
                  Source data JSON
                  <span className="json-hint">raw vs current</span>
                </button>
                {jsonOpen && (
                  <div className="source-json-grid">
                    <div className="source-json-card">
                      <div className="source-json-title">Original Source Snapshot JSON</div>
                      <JsonHighlight className="json-body json-body--embedded" data={rawSource} />
                    </div>
                    <div className="source-json-card">
                      <div className="source-json-title">Current Written-Back Source JSON</div>
                      <JsonHighlight className="json-body json-body--embedded" data={currentSource} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>
  );
}

const EXPLORER_TABS = ['overview', 'decision path', 'candidates', 'retrieval', 'activity', 'raw data'] as const;
const explorerControlClass = 'h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

export function ExplorerPage({ explorer }: { explorer: TraceExplorerState }) {
  const [activeTab, setActiveTab] = useState<(typeof EXPLORER_TABS)[number]>('overview');
  const detailMotionRoot = useRef<HTMLDivElement>(null);
  const {
    detail, detailQuery, isMatch, isNew, selectedTraceKey, selectTrace,
    traces, tracesQuery, searchInput, setSearchInput, moduleFilter, statusFilter,
    decisionSourceFilter, updateParam, issuePresenceFilter, setIssuePresenceFilter,
    issueTypeFilter, setIssueTypeFilter, availableIssueTypes, summary,
    selectedModule, selectedUniqueId, sourcePage, hasNextSourcePage, setSourcePage,
  } = explorer;
  const retrievalDebug = detail?.retrieval_debug ?? detail?.retrieval_summary ?? {};
  const retrievalCount = typeof retrievalDebug.candidate_count === 'number'
    ? retrievalDebug.candidate_count
    : typeof retrievalDebug.final_candidate_count === 'number'
      ? retrievalDebug.final_candidate_count
      : detail?.candidate_count ?? 0;
  const rawSource = detail?.raw_source ?? detail?.source ?? {};
  const currentSource = detail?.current_source ?? detail?.source ?? {};
  const changedFields = detail?.evaluation_context?.changed_fields ?? [];
  const resetFilters = () => {
    setSearchInput(''); updateParam('module', ''); updateParam('resolution_status', '');
    updateParam('decision_source', ''); setIssuePresenceFilter('all'); setIssueTypeFilter('');
  };

  useEffect(() => {
    if (!detail || !detailMotionRoot.current) return undefined;
    const scope = createMotionScope(detailMotionRoot).add((self) => {
      if (!self) return;
      const sections = utils.$('.explorer-detail-motion > *');
      animate(sections, {
        x: { from: motionDistance(self, 7) },
        duration: motionDuration(self, MOTION.reveal),
        delay: self.matches.reduceMotion ? 0 : stagger(28),
      });
    });
    return () => scope.revert();
  }, [detail?.source_module, detail?.source_unique_id]);

  return (
    <PageContainer className="max-w-none xl:max-w-[1600px]">
      <PageHeader eyebrow="Decision evidence" title="Follow every resolution from source to outcome" description="Find a source record, understand the path the system took, and inspect supporting evidence without losing your place." />
      <FilterBar>
        <FilterField label="Search" className="min-w-[210px] flex-1"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input className={`${explorerControlClass} w-full pl-9`} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Entity name or ID" /></div></FilterField>
        <FilterField label="Module"><select className={explorerControlClass} value={moduleFilter} onChange={(e) => updateParam('module', e.target.value)}><option value="">All modules</option>{MODULE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}</select></FilterField>
        <FilterField label="Outcome"><select className={explorerControlClass} value={statusFilter} onChange={(e) => updateParam('resolution_status', e.target.value)}><option value="">All outcomes</option><option value="assigned_existing_master">Assigned existing</option><option value="created_new_master">Created new</option><option value="needs_review_multi_master">Needs review</option><option value="unresolved">Unresolved</option></select></FilterField>
        <FilterField label="Decision source"><select className={explorerControlClass} value={decisionSourceFilter} onChange={(e) => updateParam('decision_source', e.target.value)}><option value="">All sources</option><option value="deterministic">Deterministic</option><option value="url_web_agent">URL/web agent</option><option value="context_agent">Context agent</option><option value="human_review">Human review</option></select></FilterField>
        <FilterField label="Issues"><select className={explorerControlClass} value={issuePresenceFilter} onChange={(e) => setIssuePresenceFilter(e.target.value as 'all' | 'with' | 'clean')}>{ISSUE_PRESENCE_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</select></FilterField>
        <FilterField label="Issue type"><select className={explorerControlClass} value={issueTypeFilter} onChange={(e) => setIssueTypeFilter(e.target.value)} disabled={issuePresenceFilter === 'clean'}><option value="">All types</option>{availableIssueTypes.map(([type, count]) => <option key={type} value={type}>{formatIssueLabel(type)} ({count})</option>)}</select></FilterField>
        <Button variant="ghost" onClick={resetFilters}><FilterX />Reset</Button>
      </FilterBar>

      {summary && <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Processed sources" value={summary.processed_source_count} /><MetricCard label="Assigned existing" value={summary.resolved_existing_master_count} tone="success" /><MetricCard label="Created new" value={summary.created_new_master_count} tone="primary" /><MetricCard label="Needs review" value={summary.pending_review_source_count} tone={summary.pending_review_source_count ? 'warning' : 'neutral'} detail={`${summary.issue_count ?? 0} issue signals`} /></div>}

      <div className="grid min-h-[580px] items-stretch gap-3 lg:h-[calc(100dvh-240px)] lg:max-h-[820px] lg:grid-cols-[290px_minmax(0,1fr)]">
        <WorkspacePanel className="flex h-full min-h-0 flex-col">
          <div className="flex min-h-14 items-center justify-between border-b border-border px-4 py-2.5"><div><h3 className="text-sm font-semibold">Source records</h3><p className="text-[11px] text-muted-foreground">Page {sourcePage} · {traces.length} records</p></div><Database className="size-4 text-muted-foreground" /></div>
          <div className={`min-h-0 flex-1 overflow-y-auto transition-opacity ${tracesQuery.isFetching && !tracesQuery.isLoading ? 'opacity-60' : ''}`}>{tracesQuery.isLoading ? <LoadingState label="Loading records" /> : tracesQuery.isError ? <ErrorState message="Source records could not be loaded." onRetry={() => void tracesQuery.refetch()} /> : <TraceList traces={traces} selectedTraceId={selectedTraceKey} activeIssueType={issueTypeFilter} onSelect={(trace) => { selectTrace(trace); setActiveTab('overview'); }} />}</div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-2.5 py-2">
            <Button size="sm" variant="ghost" disabled={sourcePage === 1 || tracesQuery.isFetching} onClick={() => setSourcePage(sourcePage - 1)}><ChevronLeft />Previous</Button>
            <span className="text-[11px] tabular-nums text-muted-foreground">Page {sourcePage}</span>
            <Button size="sm" variant="ghost" disabled={!hasNextSourcePage || tracesQuery.isFetching} onClick={() => setSourcePage(sourcePage + 1)}>Next<ChevronRight /></Button>
          </div>
        </WorkspacePanel>

        <WorkspacePanel className="h-full min-h-0 overflow-hidden">
          {!selectedModule || !selectedUniqueId ? <EmptyState title="Choose a source record" description="Details load only after you select a record, keeping the initial Explorer view fast." /> : detailQuery.isLoading ? <LoadingState label="Loading decision evidence" /> : detailQuery.isError ? <ErrorState message="The selected source detail could not be loaded." onRetry={() => void detailQuery.refetch()} /> : detail ? (
            <div ref={detailMotionRoot} className="explorer-detail-motion flex h-full min-h-0 flex-col" key={`${detail.source_module}:${detail.source_unique_id}`}>
              <div className="shrink-0 border-b border-border p-3.5"><div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="font-mono text-[10px] text-muted-foreground">{detail.source_module} · {detail.source_unique_id}</div><h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">{detail.source_entity_name || 'Unnamed source entity'}</h2><p className="mt-1 line-clamp-2 max-w-3xl text-xs leading-5 text-muted-foreground">{detail.decision_story}</p></div><div className="flex flex-wrap gap-1.5"><StatusBadge label={detail.resolution_status} />{detail.decision_source && <StatusBadge label={detail.decision_source} />}</div></div><div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Candidates" value={detail.candidate_count} /><MetricCard label="Viable" value={detail.viable_candidate_count} tone="success" /><MetricCard label="Retrieved" value={retrievalCount} /><MetricCard label="Issue signals" value={detail.issue_count ?? 0} tone={detail.issue_count ? 'warning' : 'neutral'} /></div></div>
              <div className="shrink-0 overflow-x-auto border-b border-border px-3"><div className="flex min-w-max gap-0.5">{EXPLORER_TABS.map((tab) => <button key={tab} type="button" className={`border-b-2 px-2.5 py-2.5 text-xs capitalize transition-colors ${activeTab === tab ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div></div>
              <div className="explorer-tab-panel min-h-0 flex-1 overflow-y-auto p-3">
                {activeTab === 'overview' && <div className="grid gap-3 xl:grid-cols-2"><div className={`rounded-[10px] border p-4 ${isMatch ? 'border-success/25 bg-success/5' : isNew ? 'border-primary/25 bg-primary/5' : 'border-warning/25 bg-warning/5'}`}><div className="text-[11px] font-medium text-muted-foreground">Resolution outcome</div><div className="mt-2 flex items-start gap-2.5">{isMatch ? <Trophy className="size-5 text-success" /> : <Sparkles className="size-5 text-primary" />}<div><div className="font-semibold">{isMatch ? detail.assigned_entity_name || detail.assigned_entity_id : isNew ? 'New master created' : sourceResolutionLabel(detail.resolution_status)}</div><div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{detail.assigned_entity_id || 'Human decision required'}</div></div></div></div><div className="rounded-[10px] border border-border bg-muted/45 p-4"><div className="text-[11px] font-medium text-muted-foreground">Evaluation snapshot</div><dl className="mt-2 grid gap-2 text-xs"><div><dt className="text-muted-foreground">Source URL at evaluation</dt><dd className="mt-0.5 break-all font-mono text-[11px]">{detail.evaluation_context?.source_url_at_evaluation || 'Missing'}</dd></div><div><dt className="text-muted-foreground">Current source URL</dt><dd className="mt-0.5 break-all font-mono text-[11px]">{detail.evaluation_context?.current_source_url || 'Missing'}</dd></div></dl></div>{changedFields.length > 0 && <div className="xl:col-span-2 rounded-[10px] border border-border p-4"><h3 className="text-sm font-semibold">Changed after processing</h3><div className="mt-2 flex flex-wrap gap-1.5">{changedFields.map((field) => <span key={field} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{changeFieldLabel(field)}</span>)}</div></div>}</div>}
                {activeTab === 'decision path' && <DecisionPipeline detail={detail} />}
                {activeTab === 'candidates' && <CandidateInspector candidates={detail.candidate_evaluations} evaluationContext={detail.evaluation_context} />}
                {activeTab === 'retrieval' && <RetrievalSection retrievalDebug={retrievalDebug} retrievalCount={retrievalCount} />}
                {activeTab === 'activity' && <div className="space-y-5"><AgentActivitySection activities={detail.agent_activity} /><TimelineSection events={detail.resolution_timeline} />{!detail.agent_activity.length && !detail.resolution_timeline.length && <EmptyState title="No activity captured" />}</div>}
                {activeTab === 'raw data' && <div className="grid gap-5 xl:grid-cols-2"><div><h3 className="mb-2 font-semibold">Original source snapshot</h3><JsonHighlight className="json-body json-body--embedded" data={rawSource} /></div><div><h3 className="mb-2 font-semibold">Current written-back source</h3><JsonHighlight className="json-body json-body--embedded" data={currentSource} /></div></div>}
              </div>
            </div>
          ) : null}
        </WorkspacePanel>
      </div>
    </PageContainer>
  );
}

void LegacyExplorerPage;
