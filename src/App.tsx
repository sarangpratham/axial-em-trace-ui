import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getRunSummary, getRuns, getTraceDetail, getTraces } from './lib/api';
import type { TraceSummary } from './types';
import { CandidateInspector } from './components/CandidateInspector';
import { DecisionPipeline } from './components/DecisionPipeline';
import { StatusBadge } from './components/StatusBadge';
import { TraceList } from './components/TraceList';

// ── JSON syntax highlighting ──────────────────────────────────────────────
function JsonHighlight({ data }: { data: unknown }) {
  const highlighted = JSON.stringify(data, null, 2)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span style="color:#86efac">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span style="color:#fde68a">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span style="color:#a78bfa">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:#f9a8d4">$1</span>');

  return (
    <pre dangerouslySetInnerHTML={{ __html: highlighted }} />
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get('q') ?? '');
  const [jsonOpen, setJsonOpen] = useState(false);
  const deferredSearch = useDeferredValue(searchInput);

  const runsQuery = useQuery({ queryKey: ['runs'], queryFn: getRuns });
  const selectedRunId = params.get('run_id') ?? runsQuery.data?.[0] ?? '';
  const moduleFilter = params.get('module') ?? '';
  const statusFilter = params.get('final_status') ?? '';
  const originFilter = params.get('winner_origin') ?? '';
  const selectedModule = params.get('selected_module') ?? '';
  const selectedUniqueId = params.get('selected_unique_id') ?? '';

  // Auto-select first run
  useEffect(() => {
    if (!selectedRunId && runsQuery.data?.[0]) {
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set('run_id', runsQuery.data[0]);
        return next;
      });
    }
  }, [runsQuery.data, selectedRunId, setParams]);

  // Sync search param
  useEffect(() => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (searchInput) next.set('q', searchInput);
      else next.delete('q');
      return next;
    });
  }, [searchInput, setParams]);

  const summaryQuery = useQuery({
    queryKey: ['summary', selectedRunId],
    queryFn: () => getRunSummary(selectedRunId),
    enabled: Boolean(selectedRunId),
  });

  const tracesQuery = useQuery({
    queryKey: ['traces', selectedRunId, moduleFilter, statusFilter, originFilter, deferredSearch],
    queryFn: () =>
      getTraces({
        runId: selectedRunId,
        module: moduleFilter || undefined,
        finalStatus: statusFilter || undefined,
        winnerOrigin: originFilter || undefined,
        query: deferredSearch || undefined,
      }),
    enabled: Boolean(selectedRunId),
  });

  const selectedTrace = useMemo(() => {
    return (
      tracesQuery.data?.find(
        (t) => t.source_module === selectedModule && t.source_unique_id === selectedUniqueId,
      ) ?? tracesQuery.data?.[0]
    );
  }, [selectedModule, selectedUniqueId, tracesQuery.data]);

  // Auto-select first trace
  useEffect(() => {
    if (!selectedTrace) return;
    if (
      selectedTrace.source_module === selectedModule &&
      selectedTrace.source_unique_id === selectedUniqueId
    ) {
      return;
    }
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('selected_module', selectedTrace.source_module);
      next.set('selected_unique_id', selectedTrace.source_unique_id);
      return next;
    });
  }, [selectedModule, selectedTrace, selectedUniqueId, setParams]);

  const detailQuery = useQuery({
    queryKey: [
      'trace-detail',
      selectedRunId,
      selectedTrace?.source_module,
      selectedTrace?.source_unique_id,
    ],
    queryFn: () =>
      getTraceDetail(
        selectedRunId,
        selectedTrace!.source_module,
        selectedTrace!.source_unique_id,
      ),
    enabled: Boolean(selectedRunId && selectedTrace),
  });

  const traces = tracesQuery.data ?? [];

  const updateParam = (key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const selectTrace = (trace: TraceSummary) => {
    setJsonOpen(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('run_id', selectedRunId);
      next.set('selected_module', trace.source_module);
      next.set('selected_unique_id', trace.source_unique_id);
      return next;
    });
  };

  const summary = summaryQuery.data;
  const detail = detailQuery.data;
  const enr = detail?.pre_match_enrichment as Record<string, unknown> | null | undefined;
  const isMatch =
    detail?.final_status === 'master_match' ||
    detail?.final_status === 'incoming_second_pass_match';
  const isNew = detail?.final_status === 'new_entity_created';
  const outcome = detail?.trace_payload.final_outcome as Record<string, unknown> | null | undefined;

  const selectedTraceKey = selectedTrace
    ? `${selectedTrace.source_module}::${selectedTrace.source_unique_id}`
    : undefined;

  return (
    <div className="shell">
      {/* ── Topbar ──────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo">
          <div className="topbar-logo-icon">⚡</div>
          <div className="topbar-logo-text">
            <span className="topbar-wordmark">Decision Tracer</span>
            <span className="topbar-sub">Entity Matching</span>
          </div>
        </div>

        <div className="topbar-controls">
          <span className="topbar-filter-label">Run</span>
          <select
            className="topbar-select"
            value={selectedRunId}
            onChange={(e) => updateParam('run_id', e.target.value)}
          >
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
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="entity name or ID..."
          />

          <span className="topbar-filter-label">Module</span>
          <select
            className="topbar-select"
            value={moduleFilter}
            onChange={(e) => updateParam('module', e.target.value)}
          >
            <option value="">all</option>
            <option value="news">news</option>
            <option value="linkedin">linkedin</option>
            <option value="portfolio">portfolio</option>
          </select>

          <span className="topbar-filter-label">Outcome</span>
          <select
            className="topbar-select"
            value={statusFilter}
            onChange={(e) => updateParam('final_status', e.target.value)}
          >
            <option value="">all</option>
            <option value="master_match">master_match</option>
            <option value="incoming_second_pass_match">second_pass</option>
            <option value="new_entity_created">new_entity</option>
            <option value="no_match">no_match</option>
          </select>
        </div>

        {/* Stats */}
        {summary && (
          <div className="topbar-stats">
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
          </div>
        )}
      </header>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
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
            onSelect={selectTrace}
          />
        )}
      </aside>

      {/* ── Main Panel ──────────────────────────────────────────────── */}
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
            {/* Header */}
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

            {/* Metrics */}
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
                <div className="metric-value">
                  {detail.trace_payload.searches?.length ?? 0}
                </div>
                <div className="metric-sub">query types run</div>
                <div className="metric-bar" style={{ background: 'var(--blue-dim)' }} />
              </div>
              <div className="metric-block">
                <div className="metric-label">Confidence</div>
                <div
                  className="metric-value"
                  style={{ color: isMatch ? 'var(--green)' : isNew ? 'var(--purple)' : 'var(--red)' }}
                >
                  {outcome?.confidence != null
                    ? `${(Number(outcome.confidence) * 100).toFixed(0)}%`
                    : '—'}
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

            {/* Decision Pipeline */}
            <div className="section">
              <div className="section-title">
                <span className="section-title-text">⟶ Decision Pipeline</span>
                <span className="section-hint">click a stage to inspect</span>
              </div>
              <DecisionPipeline detail={detail} />
            </div>

            {/* Outcome Details */}
            <div className="section">
              <div className="section-title">
                <span className="section-title-text">◎ Outcome Details</span>
              </div>
              <div className="outcome-grid">
                {/* Winner */}
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

                {/* Enrichment */}
                <div className="enrichment-card">
                  <span className="enrichment-icon">{enr?.eligible ? '🔗' : '⊘'}</span>
                  <div>
                    <div className="enrichment-title">Pre-match Enrichment</div>
                    <div className="enrichment-sub">
                      {String(enr?.reason ?? 'No enrichment captured')}
                    </div>
                    <span className={`enrichment-url${!enr?.eligible ? ' enrichment-url--none' : ''}`}>
                      {String(enr?.final_matching_url ?? 'no URL derived')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Candidate Inspector */}
            <div className="section">
              <div className="section-title">
                <span className="section-title-text">≡ Candidate Inspector</span>
                <span className="section-hint">
                  {detail.ranked_candidate_results.length} candidates · click row for evidence
                </span>
              </div>
              <CandidateInspector candidates={detail.ranked_candidate_results} />
            </div>

            {/* Search Queries */}
            {(detail.trace_payload.searches ?? []).length > 0 && (
              <div className="section">
                <div className="section-title">
                  <span className="section-title-text">⊛ Search Queries</span>
                </div>
                <div className="search-cards">
                  {(detail.trace_payload.searches ?? []).map((s, i) => (
                    <div key={i} className="search-card">
                      <div className="search-card-head">
                        <span className="search-kind">{String(s.search_kind ?? `search_${i}`)}</span>
                        <span className="search-count">
                          {Array.isArray(s.potential_candidates)
                            ? s.potential_candidates.length
                            : 0}{' '}
                          results
                        </span>
                      </div>
                      <pre className="search-query">
                        {String(s.redis_query ?? 'no query captured')}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw JSON */}
            <button
              className={`json-toggle${jsonOpen ? ' json-toggle--open' : ''}`}
              onClick={() => setJsonOpen((v) => !v)}
            >
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
  );
}