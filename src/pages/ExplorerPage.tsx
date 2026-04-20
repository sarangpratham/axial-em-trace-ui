import { AppTopbar } from '../components/AppTopbar';
import { CandidateInspector } from '../components/CandidateInspector';
import { DecisionPipeline } from '../components/DecisionPipeline';
import { JsonHighlight } from '../components/JsonHighlight';
import { StatusBadge } from '../components/StatusBadge';
import { TraceList } from '../components/TraceList';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
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

function ExplorerToolbar({ explorer }: { explorer: TraceExplorerState }) {
  const {
    runsQuery,
    selectedRunId,
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
          <span className="topbar-filter-label">Run</span>
          <select className="topbar-select" value={selectedRunId} onChange={(event) => updateParam('run_id', event.target.value)}>
            {(runsQuery.data ?? []).map((runId) => (
              <option key={runId} value={runId}>
                {runId}
              </option>
            ))}
          </select>

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
                <span className="num">{summary.anomaly_total}</span> anomalies
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

  return (
    <div className="shell shell--explorer">
      <AppTopbar
        currentView="explorer"
        statusSlot={<span className="topbar-status-chip" title={explorer.selectedRunId}>Run {explorer.selectedRunId || 'not selected'}</span>}
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
                  <div className="metric-value">{String(detail.retrieval_summary?.candidate_count ?? detail.candidate_count ?? 0)}</div>
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

                  <div className="enrichment-card">
                    <span className="enrichment-icon">{enrichment?.eligible ? '🔗' : '⊘'}</span>
                    <div>
                      <div className="enrichment-title">Derived Enrichment</div>
                      <div className="enrichment-sub">{String(enrichment?.reason ?? 'No enrichment captured')}</div>
                      <span className={`enrichment-url${!enrichment?.eligible ? ' enrichment-url--none' : ''}`}>
                        {String(enrichment?.final_matching_url ?? 'no URL derived')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-title">
                  <span className="section-title-text">≡ Candidate Evaluations</span>
                  <span className="section-hint">
                    {detail.candidate_evaluations.length} candidates · click a row for evidence
                  </span>
                </div>
                <CandidateInspector candidates={detail.candidate_evaluations} />
              </div>

              {Object.keys(detail.retrieval_summary ?? {}).length > 0 && (
                <div className="section">
                  <div className="section-title">
                    <span className="section-title-text">⊛ Candidate Retrieval</span>
                  </div>
                  <div className="json-body">
                    <JsonHighlight data={detail.retrieval_summary} />
                  </div>
                </div>
              )}

              <button className={`json-toggle${jsonOpen ? ' json-toggle--open' : ''}`} onClick={() => setJsonOpen((value) => !value)}>
                <span className={`json-chevron${jsonOpen ? ' json-chevron--open' : ''}`}>▶</span>
                Raw Source JSON
                <span className="json-hint">original module row</span>
              </button>
              {jsonOpen && (
                <div className="json-body">
                  <JsonHighlight data={detail.source} />
                </div>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
