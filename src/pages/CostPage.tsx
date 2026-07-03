import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppTopbar } from '../components/AppTopbar';
import { JsonHighlight } from '../components/JsonHighlight';
import { StatusBadge } from '../components/StatusBadge';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
import { getCostCallDetail, getCostCalls, getCostSummary } from '../lib/api';
import { humanizeToken } from '../lib/sourceResolution';
import type { CostCallRow, CostCallType, CostSummary } from '../types';

const PAGE_SIZE = 20;
const TYPE_OPTIONS: CostCallType[] = ['all', 'llm', 'web'];
const SORT_OPTIONS = [
  ['created_desc', 'Newest'],
  ['cost_desc', 'Highest cost'],
  ['tokens_desc', 'Highest tokens'],
  ['latency_desc', 'Slowest'],
] as const;
const SUCCESS_OPTIONS = [
  ['all', 'All outcomes'],
  ['success', 'Success only'],
  ['failure', 'Failures only'],
] as const;
const DEBUG_TABS = ['request', 'response', 'usage', 'error'] as const;

function formatMoney(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '$0.0000';
  return `$${value.toFixed(value >= 1 ? 2 : 4)}`;
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatPct(value?: number | null) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatLatencySeconds(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  const seconds = value / 1000;
  return `${seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2)}s`;
}

function callTitle(row: CostCallRow) {
  return row.call_type === 'llm'
    ? row.agent_name || row.capability || 'LLM call'
    : row.capability || 'web search';
}

function callSubtitle(row: CostCallRow) {
  const provider = row.provider || 'provider unknown';
  const model = row.model_name ? ` / ${row.model_name}` : '';
  return `${provider}${model}`;
}

function topAgentLabel(summary?: CostSummary) {
  const top = summary?.top_agents?.[0];
  if (!top) return '—';
  return top.agent_name || top.capability || 'unknown agent';
}

function topModelLabel(summary?: CostSummary) {
  const top = summary?.top_models?.[0];
  if (!top) return '—';
  return `${top.provider || 'provider'} / ${top.model_name || 'model'}`;
}

function rowKey(row: CostCallRow) {
  return `${row.call_type}:${row.id}`;
}

export function CostPage({ explorer }: { explorer: TraceExplorerState }) {
  const { selectedRunId } = explorer;
  const [callType, setCallType] = useState<CostCallType>('all');
  const [sort, setSort] = useState('created_desc');
  const [success, setSuccess] = useState<(typeof SUCCESS_OPTIONS)[number][0]>('all');
  const [provider, setProvider] = useState('');
  const [agent, setAgent] = useState('');
  const [cacheSource, setCacheSource] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState('');
  const [debugTab, setDebugTab] = useState<(typeof DEBUG_TABS)[number]>('request');

  const summaryQuery = useQuery({
    queryKey: ['cost-summary', selectedRunId],
    queryFn: () => getCostSummary(selectedRunId),
    enabled: Boolean(selectedRunId),
    staleTime: 20_000,
  });

  const callsQuery = useQuery({
    queryKey: [
      'cost-calls',
      selectedRunId,
      callType,
      sort,
      success,
      provider,
      agent,
      cacheSource,
      query,
      page,
    ],
    queryFn: () =>
      getCostCalls({
        runId: selectedRunId,
        type: callType,
        sort,
        success,
        provider: provider || undefined,
        agent: agent || undefined,
        cacheSource: cacheSource || undefined,
        query: query || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(selectedRunId),
    staleTime: 10_000,
  });

  const expandedRow = useMemo(() => {
    const rows = callsQuery.data?.items ?? [];
    return rows.find((row) => rowKey(row) === expandedKey) ?? null;
  }, [callsQuery.data?.items, expandedKey]);

  const detailQuery = useQuery({
    queryKey: ['cost-call-detail', selectedRunId, expandedRow?.call_type, expandedRow?.id],
    queryFn: () =>
      getCostCallDetail({
        runId: selectedRunId,
        callType: expandedRow!.call_type,
        id: expandedRow!.id,
        includeDebug: true,
      }),
    enabled: Boolean(selectedRunId && expandedRow),
    staleTime: 60_000,
  });

  const summary = summaryQuery.data;
  const totals = summary?.totals;
  const rows = callsQuery.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((callsQuery.data?.total ?? 0) / PAGE_SIZE));

  function updateFilter(update: () => void) {
    update();
    setPage(1);
    setExpandedKey('');
  }

  return (
    <div className="shell shell--cost">
      <AppTopbar
        currentView="cost"
        runIds={explorer.runsQuery.data ?? []}
        selectedRunId={selectedRunId}
        onRunChange={(runId) => explorer.updateParam('run_id', runId)}
      />

      <main className="cost-workspace">
        <section className="cost-stat-grid">
          <MetricCard label="Estimated spend" value={formatMoney(totals?.total_estimated_cost_usd)} tone="hot" />
          <MetricCard label="LLM tokens" value={formatNumber(totals?.llm_total_tokens)} />
          <MetricCard label="LLM calls" value={formatNumber(totals?.llm_call_count)} />
          <MetricCard label="Web cache hit rate" value={formatPct(totals?.web_cache_hit_rate)} />
          <MetricCard label="Top agent" value={topAgentLabel(summary)} compact />
          <MetricCard label="Top model" value={topModelLabel(summary)} compact />
          <MetricCard label="Failures" value={formatNumber(totals?.failed_call_count)} tone="warn" />
          <MetricCard label="Uncosted calls" value={formatNumber(totals?.uncaptured_cost_count)} tone="warn" />
        </section>

        <section className="cost-breakdown-grid">
          <BreakdownCard title="LLM By Agent" rows={summary?.top_agents ?? []} primary="agent_name" />
          <BreakdownCard title="LLM By Model" rows={summary?.top_models ?? []} primary="model_name" />
          <BreakdownCard title="Web By Provider / Cache" rows={summary?.web_by_provider ?? []} primary="provider" />
          <TopCallsCard rows={summary?.top_expensive_calls ?? []} />
        </section>

        <section className="cost-table-panel">
          <div className="cost-table-head">
            <div>
              <div className="section-title-text">Call Explorer</div>
              <div className="section-hint">
                {formatNumber(callsQuery.data?.total)} matching audit rows · {PAGE_SIZE} per page
              </div>
            </div>
            <div className="cost-filter-grid">
              <select className="topbar-select" value={callType} onChange={(event) => updateFilter(() => setCallType(event.target.value as CostCallType))}>
                {TYPE_OPTIONS.map((option) => <option key={option} value={option}>{humanizeToken(option)}</option>)}
              </select>
              <select className="topbar-select" value={sort} onChange={(event) => updateFilter(() => setSort(event.target.value))}>
                {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select className="topbar-select" value={success} onChange={(event) => updateFilter(() => setSuccess(event.target.value as typeof success))}>
                {SUCCESS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input className="topbar-input" placeholder="agent or capability" value={agent} onChange={(event) => updateFilter(() => setAgent(event.target.value))} />
              <input className="topbar-input" placeholder="provider" value={provider} onChange={(event) => updateFilter(() => setProvider(event.target.value))} />
              <input className="topbar-input" placeholder="cache source" value={cacheSource} onChange={(event) => updateFilter(() => setCacheSource(event.target.value))} />
              <input className="topbar-input cost-filter-search" placeholder="source, evaluation, provider…" value={query} onChange={(event) => updateFilter(() => setQuery(event.target.value))} />
            </div>
          </div>

          {callsQuery.isLoading ? (
            <div className="loading-state"><div className="loading-spinner" /> loading cost calls…</div>
          ) : rows.length === 0 ? (
            <div className="empty-state">No cost calls matched the current filters.</div>
          ) : (
            <div className="cost-table-wrap">
              <table className="cost-table">
                <thead>
                  <tr>
                    <th>Call</th>
                    <th>Provider</th>
                    <th>Cost</th>
                    <th>Tokens / Results</th>
                    <th>Latency</th>
                    <th>Outcome</th>
                    <th>When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isExpanded = rowKey(row) === expandedKey;
                    return (
                      <Fragment key={rowKey(row)}>
                        <tr className={isExpanded ? 'cost-row cost-row--active' : 'cost-row'}>
                          <td>
                            <div className="cost-call-title">{callTitle(row)}</div>
                            <div className="cost-call-sub">{row.source_label || row.evaluation_key || row.source_trace_id || 'run-level call'}</div>
                          </td>
                          <td>{callSubtitle(row)}</td>
                          <td className="cost-number">{formatMoney(row.cost_usd)}</td>
                          <td>
                            {row.call_type === 'llm'
                              ? formatNumber(row.total_tokens)
                              : `${formatNumber(row.result_count)} results`}
                          </td>
                          <td>{formatLatencySeconds(row.latency_ms)}</td>
                          <td>
                            <StatusBadge label={row.success ? 'success' : 'failed'} />
                            {row.cache_source && <span className="cost-cache-pill">{row.cache_source}</span>}
                          </td>
                          <td>{formatTimestamp(row.created_at)}</td>
                          <td>
                            <button
                              type="button"
                              className="review-link-button review-link-button--inline"
                              onClick={() => {
                                setExpandedKey(isExpanded ? '' : rowKey(row));
                                setDebugTab('request');
                              }}
                            >
                              {isExpanded ? 'Hide' : 'Inspect'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${rowKey(row)}:detail`}>
                            <td colSpan={8} className="cost-detail-cell">
                              <div className="cost-detail-panel">
                                <div className="cost-detail-summary">
                                  <strong>{row.decision || row.summary_text || 'No compact summary recorded.'}</strong>
                                  <span>{row.evaluation_key || row.agent_work_key || row.source_trace_id}</span>
                                </div>
                                <div className="review-tabs">
                                  {DEBUG_TABS.map((tab) => (
                                    <button
                                      key={tab}
                                      type="button"
                                      className={`review-tab${debugTab === tab ? ' review-tab--active' : ''}`}
                                      onClick={() => setDebugTab(tab)}
                                    >
                                      {humanizeToken(tab)}
                                    </button>
                                  ))}
                                </div>
                                {detailQuery.isLoading ? (
                                  <div className="loading-state"><div className="loading-spinner" /> loading payload…</div>
                                ) : (
                                  <JsonHighlight
                                    className="json-body json-body--embedded cost-json"
                                    data={
                                      debugTab === 'request'
                                        ? detailQuery.data?.request_payload
                                        : debugTab === 'response'
                                          ? detailQuery.data?.response_payload
                                          : debugTab === 'usage'
                                            ? detailQuery.data?.usage_payload
                                            : detailQuery.data?.error_payload
                                    }
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="cost-pagination">
            <button className="review-button review-button--secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button className="review-button review-button--secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Next
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: string;
  tone?: 'hot' | 'warn';
  compact?: boolean;
}) {
  return (
    <article className={`cost-metric-card ${tone ? `cost-metric-card--${tone}` : ''}`.trim()}>
      <div className="cost-metric-label">{label}</div>
      <div className={compact ? 'cost-metric-value cost-metric-value--compact' : 'cost-metric-value'}>{value}</div>
    </article>
  );
}

function BreakdownCard({
  title,
  rows,
  primary,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  primary: string;
}) {
  return (
    <article className="cost-breakdown-card">
      <div className="cost-card-title">{title}</div>
      <div className="cost-breakdown-list">
        {rows.slice(0, 5).map((row, index) => (
          <div key={`${title}-${index}`} className="cost-breakdown-row">
            <span>{String(row[primary] || row.capability || row.mode || row.cache_source || 'unknown')}</span>
            <strong>{formatMoney(Number(row.total_cost_usd ?? 0))}</strong>
          </div>
        ))}
        {rows.length === 0 && <div className="section-hint">No records yet.</div>}
      </div>
    </article>
  );
}

function TopCallsCard({ rows }: { rows: CostCallRow[] }) {
  return (
    <article className="cost-breakdown-card">
      <div className="cost-card-title">Most Expensive Calls</div>
      <div className="cost-breakdown-list">
        {rows.slice(0, 5).map((row) => (
          <div key={rowKey(row)} className="cost-breakdown-row">
            <span>{callTitle(row)}</span>
            <strong>{formatMoney(row.cost_usd)}</strong>
          </div>
        ))}
        {rows.length === 0 && <div className="section-hint">No costed calls yet.</div>}
      </div>
    </article>
  );
}
