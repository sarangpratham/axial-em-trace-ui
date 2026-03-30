import { AppTopbar } from '../components/AppTopbar';
import { CandidateInspector } from '../components/CandidateInspector';
import { DecisionPipeline } from '../components/DecisionPipeline';
import { StatusBadge } from '../components/StatusBadge';
import { TraceList } from '../components/TraceList';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';

const MODULE_OPTIONS = ['news', 'linkedin', 'portfolio'];

function JsonHighlight({ data }: { data: unknown }) {
  const highlighted = JSON.stringify(data, null, 2)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span style="color:#86efac">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span style="color:#fde68a">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span style="color:#a78bfa">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:#f9a8d4">$1</span>');

  return <pre dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

function ExplorerToolbar({ explorer }: { explorer: TraceExplorerState }) {
  const { runsQuery, selectedRunId, updateParam, searchInput, setSearchInput, moduleFilter, statusFilter, summary } = explorer;

  return (
    <section className="explorer-toolbar">
      <div className="explorer-toolbar-main">
        <div className="explorer-toolbar-copy">
          <div className="explorer-toolbar-title">Explorer Filters</div>
          {/* <div className="explorer-toolbar-sub">Deterministic trace controls stay here so Analysis can keep a cleaner, chat-first shell.</div> */}
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
          <select className="topbar-select" value={statusFilter} onChange={(event) => updateParam('final_status', event.target.value)}>
            <option value="">all</option>
            <option value="master_match">master_match</option>
            <option value="incoming_second_pass_match">second_pass</option>
            <option value="new_entity_created">new_entity</option>
            <option value="no_match">no_match</option>
          </select>
        </div>
      </div>

      {summary && (
        <div className="explorer-toolbar-stats">
          <div className="stat-pill stat-pill--total">
            <span className="num">{summary.total_traces}</span> total
          </div>
          <div className="stat-divider" />
          <div className="stat-pill stat-pill--match">
            <span className="stat-dot" />
            <span className="num">{summary.matched_count}</span> matched
          </div>
          <div className="stat-pill stat-pill--new">
            <span className="stat-dot" />
            <span className="num">{summary.new_entity_count}</span> new
          </div>
          <div className="stat-pill stat-pill--none">
            <span className="stat-dot" />
            <span className="num">{summary.no_match_count}</span> no match
          </div>
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
    outcome,
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
        search={window.location.search}
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
            <TraceList traces={traces} selectedTraceId={selectedTraceKey} onSelect={selectTrace} />
          )}
        </aside>

        <main className="main">
          {!selectedTrace ? (
            <div className="empty-state">
              <span className="empty-icon">⬡</span>
              <p>Select an entity to inspect its decision story</p>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              loading trace detail…
            </div>
          ) : detailQuery.isError ? (
            <div className="error-state">
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
                  <StatusBadge label={detail.final_status} />
                  {detail.winner_origin && <StatusBadge label={detail.winner_origin} />}
                </div>
              </div>

              <div className="metrics-row">
                <div className="metric-block">
                  <div className="metric-label">Candidates</div>
                  <div className="metric-value">{detail.candidate_count}</div>
                  <div className="metric-sub">total evaluated</div>
                  <div className="metric-bar" style={{ background: 'var(--blue-dim)' }} />
                </div>
                <div className="metric-block">
                  <div className="metric-label">Positive</div>
                  <div className="metric-value" style={{ color: 'var(--green)' }}>
                    {detail.matched_candidate_count}
                  </div>
                  <div className="metric-sub">passed threshold</div>
                  <div className="metric-bar" style={{ background: 'var(--green-dim)' }} />
                </div>
                <div className="metric-block">
                  <div className="metric-label">Searches</div>
                  <div className="metric-value">{detail.trace_payload.searches?.length ?? 0}</div>
                  <div className="metric-sub">query types run</div>
                  <div className="metric-bar" style={{ background: 'var(--blue-dim)' }} />
                </div>
                <div className="metric-block">
                  <div className="metric-label">Confidence</div>
                  <div className="metric-value" style={{ color: isMatch ? 'var(--green)' : isNew ? 'var(--purple)' : 'var(--red)' }}>
                    {outcome?.confidence != null ? `${(Number(outcome.confidence) * 100).toFixed(0)}%` : '—'}
                  </div>
                  <div className="metric-sub">final outcome score</div>
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
                  <span className="section-title-text">⟶ Decision Pipeline</span>
                  <span className="section-hint">click a stage to inspect</span>
                </div>
                <DecisionPipeline detail={detail} />
              </div>

              <div className="section">
                <div className="section-title">
                  <span className="section-title-text">◎ Outcome Details</span>
                </div>
                <div className="outcome-grid">
                  {detail.winner_entity_name ? (
                    <div className="winner-strip">
                      <span className="winner-icon">🏆</span>
                      <div>
                        <div className="winner-label">Winner</div>
                        <div className="winner-name">{detail.winner_entity_name}</div>
                        <div className="winner-id">
                          {detail.winner_entity_id} · {detail.winner_origin}
                        </div>
                      </div>
                    </div>
                  ) : isNew ? (
                    <div className="winner-strip winner-strip--new">
                      <span className="winner-icon">✦</span>
                      <div>
                        <div className="winner-label winner-label--new">New Entity</div>
                        <div className="winner-name" style={{ color: 'var(--text2)' }}>
                          {detail.winner_entity_id ?? 'Queued for creation'}
                        </div>
                        <div className="winner-id">No existing match found</div>
                      </div>
                    </div>
                  ) : (
                    <div className="winner-strip winner-strip--empty">
                      <span className="winner-icon" style={{ filter: 'grayscale(1)' }}>🚫</span>
                      <div>
                        <div className="winner-label winner-label--empty">No Winner</div>
                        <div className="winner-name" style={{ color: 'var(--text2)' }}>
                          All candidates rejected
                        </div>
                        <div className="winner-id">Score below threshold</div>
                      </div>
                    </div>
                  )}

                  <div className="enrichment-card">
                    <span className="enrichment-icon">{enrichment?.eligible ? '🔗' : '⊘'}</span>
                    <div>
                      <div className="enrichment-title">Pre-match Enrichment</div>
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
                  <span className="section-title-text">≡ Candidate Inspector</span>
                  <span className="section-hint">
                    {detail.ranked_candidate_results.length} candidates · click row for evidence
                  </span>
                </div>
                <CandidateInspector candidates={detail.ranked_candidate_results} />
              </div>

              {(detail.trace_payload.searches ?? []).length > 0 && (
                <div className="section">
                  <div className="section-title">
                    <span className="section-title-text">⊛ Search Queries</span>
                  </div>
                  <div className="search-cards">
                    {(detail.trace_payload.searches ?? []).map((search, index) => (
                      <div key={index} className="search-card">
                        <div className="search-card-head">
                          <span className="search-kind">{String(search.search_kind ?? `search_${index}`)}</span>
                          <span className="search-count">
                            {Array.isArray(search.potential_candidates) ? search.potential_candidates.length : 0} results
                          </span>
                        </div>
                        <pre className="search-query">{String(search.redis_query ?? 'no query captured')}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className={`json-toggle${jsonOpen ? ' json-toggle--open' : ''}`} onClick={() => setJsonOpen((value) => !value)}>
                <span className={`json-chevron${jsonOpen ? ' json-chevron--open' : ''}`}>▶</span>
                Raw Payload JSON
                <span className="json-hint">trace_payload</span>
              </button>
              {jsonOpen && (
                <div className="json-body">
                  <JsonHighlight data={detail.trace_payload} />
                </div>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
