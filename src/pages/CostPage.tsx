import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ExternalLink, FilterX, Search } from 'lucide-react';
import { JsonHighlight } from '@/components/JsonHighlight';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EmptyState, ErrorState, FilterBar, FilterField, LoadingState, MetricCard, PageContainer, PageHeader, WorkspacePanel } from '@/components/workbench/layout';
import type { TraceExplorerState } from '@/hooks/useTraceExplorerState';
import { getCostCallDetail, getCostCalls, getCostSummary } from '@/lib/api';
import { humanizeToken } from '@/lib/sourceResolution';
import type { CostCallRow, CostCallType, CostSummary } from '@/types';

const PAGE_SIZE = 20;
const TYPE_OPTIONS: CostCallType[] = ['all', 'llm', 'web'];
const SORT_OPTIONS = [['created_desc', 'Newest'], ['cost_desc', 'Highest cost'], ['tokens_desc', 'Highest tokens'], ['latency_desc', 'Slowest']] as const;
const SUCCESS_OPTIONS = [['all', 'All outcomes'], ['success', 'Success only'], ['failure', 'Failures only']] as const;
const DEBUG_TABS = ['request', 'response', 'usage', 'error'] as const;
const controlClass = 'h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

function formatMoney(value?: number | null) { if (value == null || !Number.isFinite(value)) return '$0.0000'; return `$${value.toFixed(value >= 1 ? 2 : 4)}`; }
function formatNumber(value?: number | null) { return new Intl.NumberFormat().format(value ?? 0); }
function formatPct(value?: number | null) { return `${Math.round((value ?? 0) * 100)}%`; }
function formatTimestamp(value?: string | null) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString(); }
function formatLatency(value?: number | null) { if (value == null || !Number.isFinite(value)) return '—'; const s = value / 1000; return `${s >= 10 ? s.toFixed(1) : s.toFixed(2)}s`; }
function callTitle(row: CostCallRow) { return row.call_type === 'llm' ? row.agent_name || row.capability || 'LLM call' : row.capability || 'Web search'; }
function callSubtitle(row: CostCallRow) { return `${row.provider || 'Provider unknown'}${row.model_name ? ` / ${row.model_name}` : ''}`; }
function topAgentLabel(summary?: CostSummary) { const top = summary?.top_agents?.[0]; return top ? String(top.agent_name || top.capability || 'Unknown agent') : '—'; }
function rowKey(row: CostCallRow) { return `${row.call_type}:${row.id}`; }

export function CostPage({ explorer }: { explorer: TraceExplorerState }) {
  const navigate = useNavigate();
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

  const summaryQuery = useQuery({ queryKey: ['cost-summary', selectedRunId], queryFn: () => getCostSummary(selectedRunId), enabled: Boolean(selectedRunId), staleTime: 20_000 });
  const callsQuery = useQuery({ queryKey: ['cost-calls', selectedRunId, callType, sort, success, provider, agent, cacheSource, query, page], queryFn: () => getCostCalls({ runId: selectedRunId, type: callType, sort, success, provider: provider || undefined, agent: agent || undefined, cacheSource: cacheSource || undefined, query: query || undefined, page, pageSize: PAGE_SIZE }), enabled: Boolean(selectedRunId), staleTime: 10_000 });
  const rows = callsQuery.data?.items ?? [];
  const expandedRow = useMemo(() => rows.find((row) => rowKey(row) === expandedKey) ?? null, [rows, expandedKey]);
  const detailQuery = useQuery({ queryKey: ['cost-call-detail', selectedRunId, expandedRow?.call_type, expandedRow?.id], queryFn: () => getCostCallDetail({ runId: selectedRunId, callType: expandedRow!.call_type, id: expandedRow!.id, includeDebug: true }), enabled: Boolean(selectedRunId && expandedRow), staleTime: 60_000 });
  const summary = summaryQuery.data; const totals = summary?.totals;
  const totalPages = Math.max(1, Math.ceil((callsQuery.data?.total ?? 0) / PAGE_SIZE));
  const updateFilter = (update: () => void) => { update(); setPage(1); setExpandedKey(''); };
  const resetFilters = () => { setCallType('all'); setSort('created_desc'); setSuccess('all'); setProvider(''); setAgent(''); setCacheSource(''); setQuery(''); setPage(1); };

  return (
    <PageContainer>
      <PageHeader eyebrow="Usage and spend" title="Understand where model cost comes from" description="Exact audit values stay primary; charts reveal concentration while call-level payloads remain one click away." />
      <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Estimated spend" value={formatMoney(totals?.total_estimated_cost_usd)} tone="primary" detail={`${formatNumber(totals?.llm_call_count)} LLM calls`} />
        <MetricCard label="Total tokens" value={formatNumber(totals?.llm_total_tokens)} detail={`Top agent: ${topAgentLabel(summary)}`} />
        <MetricCard label="Web cache hit rate" value={formatPct(totals?.web_cache_hit_rate)} tone="success" detail="Across captured web calls" />
        <MetricCard label="Needs attention" value={formatNumber((totals?.failed_call_count ?? 0) + (totals?.uncaptured_cost_count ?? 0))} tone={(totals?.failed_call_count ?? 0) ? 'warning' : 'neutral'} detail={`${formatNumber(totals?.failed_call_count)} failed · ${formatNumber(totals?.uncaptured_cost_count)} uncosted`} />
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-2"><BreakdownCard title="Cost by agent" rows={summary?.top_agents ?? []} primary="agent_name" /><BreakdownCard title="Cost by provider and model" rows={summary?.top_models ?? []} primary="model_name" /></div>

      <FilterBar>
        <FilterField label="Call type"><select className={controlClass} value={callType} onChange={(e) => updateFilter(() => setCallType(e.target.value as CostCallType))}>{TYPE_OPTIONS.map((v) => <option key={v} value={v}>{humanizeToken(v)}</option>)}</select></FilterField>
        <FilterField label="Outcome"><select className={controlClass} value={success} onChange={(e) => updateFilter(() => setSuccess(e.target.value as typeof success))}>{SUCCESS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></FilterField>
        <FilterField label="Sort"><select className={controlClass} value={sort} onChange={(e) => updateFilter(() => setSort(e.target.value))}>{SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></FilterField>
        <FilterField label="Agent"><input className={controlClass} value={agent} onChange={(e) => updateFilter(() => setAgent(e.target.value))} placeholder="Any agent" /></FilterField>
        <FilterField label="Provider"><input className={controlClass} value={provider} onChange={(e) => updateFilter(() => setProvider(e.target.value))} placeholder="Any provider" /></FilterField>
        <FilterField label="Cache"><input className={controlClass} value={cacheSource} onChange={(e) => updateFilter(() => setCacheSource(e.target.value))} placeholder="Any source" /></FilterField>
        <FilterField label="Search" className="min-w-[220px] flex-1"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input className={`${controlClass} w-full pl-9`} value={query} onChange={(e) => updateFilter(() => setQuery(e.target.value))} placeholder="Source, evaluation, provider…" /></div></FilterField>
        <Button variant="ghost" onClick={resetFilters}><FilterX />Reset</Button>
      </FilterBar>

      <WorkspacePanel>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><div><h3 className="text-sm font-semibold">Call explorer</h3><p className="text-[11px] text-muted-foreground">{formatNumber(callsQuery.data?.total)} matching audit rows</p></div><span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span></div>
        {callsQuery.isLoading ? <LoadingState label="Loading cost calls" /> : callsQuery.isError ? <ErrorState message={callsQuery.error instanceof Error ? callsQuery.error.message : 'Cost calls could not be loaded.'} onRetry={() => void callsQuery.refetch()} /> : !rows.length ? <EmptyState title="No calls match these filters" action={<Button variant="outline" onClick={resetFilters}>Clear filters</Button>} /> : <div className="overflow-x-auto"><table className="compact-data-table w-full min-w-[980px] text-left text-xs"><thead className="bg-muted/80 text-[11px] text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Call</th><th className="px-3 py-2.5 font-medium">Provider</th><th className="px-3 py-2.5 font-medium">Cost</th><th className="px-3 py-2.5 font-medium">Tokens / results</th><th className="px-3 py-2.5 font-medium">Latency</th><th className="px-3 py-2.5 font-medium">Outcome</th><th className="px-3 py-2.5 font-medium">When</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={rowKey(row)} className="cursor-pointer border-b border-border/70 hover:bg-accent/60" onClick={() => { setExpandedKey(rowKey(row)); setDebugTab('request'); }}><td className="max-w-sm px-4 py-2.5"><div className="font-medium">{callTitle(row)}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.source_label || row.evaluation_key || row.source_trace_id || 'Run-level call'}</div></td><td className="px-3 py-2.5 text-muted-foreground">{callSubtitle(row)}</td><td className="px-3 py-2.5 font-mono text-[11px]">{formatMoney(row.cost_usd)}</td><td className="px-3 py-2.5 tabular-nums">{row.call_type === 'llm' ? formatNumber(row.total_tokens) : `${formatNumber(row.result_count)} results`}</td><td className="px-3 py-2.5 tabular-nums">{formatLatency(row.latency_ms)}</td><td className="px-3 py-2.5"><StatusBadge label={row.success ? 'success' : 'failed'} />{row.cache_source && <div className="mt-0.5 text-[10px] text-muted-foreground">{row.cache_source}</div>}</td><td className="px-3 py-2.5 text-[11px] text-muted-foreground">{formatTimestamp(row.created_at)}</td><td className="px-3 py-2.5"><Button size="sm" variant="ghost">Inspect</Button></td></tr>)}</tbody></table></div>}
        <div className="flex items-center justify-between border-t border-border p-3"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>Previous</Button><span className="text-xs text-muted-foreground">{PAGE_SIZE} rows per page</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>Next</Button></div>
      </WorkspacePanel>

      <Sheet open={Boolean(expandedRow)} onOpenChange={(open) => { if (!open) setExpandedKey(''); }}><SheetContent side="right" className="overflow-y-auto sm:max-w-2xl">{expandedRow && <><SheetHeader><div className="mb-2 flex items-center gap-2"><StatusBadge label={expandedRow.success ? 'success' : 'failed'} /><span className="font-mono text-xs text-muted-foreground">{expandedRow.call_type} · {expandedRow.id}</span></div><SheetTitle>{callTitle(expandedRow)}</SheetTitle><SheetDescription>{expandedRow.decision || expandedRow.summary_text || callSubtitle(expandedRow)}</SheetDescription></SheetHeader><div className="grid grid-cols-2 gap-4 rounded-xl bg-muted p-4 text-sm sm:grid-cols-4"><div><div className="text-xs text-muted-foreground">Cost</div><div className="mt-1 font-mono">{formatMoney(expandedRow.cost_usd)}</div></div><div><div className="text-xs text-muted-foreground">Latency</div><div className="mt-1 font-mono">{formatLatency(expandedRow.latency_ms)}</div></div><div><div className="text-xs text-muted-foreground">Provider</div><div className="mt-1">{expandedRow.provider || '—'}</div></div><div><div className="text-xs text-muted-foreground">When</div><div className="mt-1">{formatTimestamp(expandedRow.created_at)}</div></div></div>{expandedRow.source_module && expandedRow.source_unique_id && <Button className="mt-4" size="sm" variant="outline" onClick={() => navigate(`/explorer?${new URLSearchParams({ run_id: selectedRunId, selected_module: expandedRow.source_module!, selected_unique_id: expandedRow.source_unique_id! })}`)}><ExternalLink />Open source record</Button>}<div className="mt-6 flex gap-1 border-b border-border">{DEBUG_TABS.map((tab) => <button key={tab} type="button" className={`border-b-2 px-3 py-2 text-sm capitalize ${debugTab === tab ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground'}`} onClick={() => setDebugTab(tab)}>{tab}</button>)}</div>{detailQuery.isLoading ? <LoadingState label="Loading payload" /> : <JsonHighlight className="json-body json-body--embedded mt-4" data={debugTab === 'request' ? detailQuery.data?.request_payload : debugTab === 'response' ? detailQuery.data?.response_payload : debugTab === 'usage' ? detailQuery.data?.usage_payload : detailQuery.data?.error_payload} />}</>}</SheetContent></Sheet>
    </PageContainer>
  );
}

function BreakdownCard({ title, rows, primary }: { title: string; rows: Array<Record<string, unknown>>; primary: string }) {
  const data = rows.slice(0, 5).map((row) => ({ label: String(row[primary] || row.capability || row.provider || 'Unknown'), cost: Number(row.total_cost_usd ?? 0) }));
  return <WorkspacePanel className="p-4"><div className="mb-2.5 flex items-center justify-between"><div><h3 className="text-sm font-semibold">{title}</h3><p className="text-[11px] text-muted-foreground">Top five by estimated cost</p></div><strong className="font-mono text-xs">{formatMoney(data.reduce((sum, row) => sum + row.cost, 0))}</strong></div>{data.length ? <div className="h-40" role="img" aria-label={title}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 4 }}><XAxis type="number" hide /><YAxis type="category" dataKey="label" width={112} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={(v: string) => v.length > 18 ? `${v.slice(0, 17)}…` : v} /><Tooltip cursor={{ fill: 'var(--accent)' }} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border-new)', borderRadius: 8, fontSize: 12 }} formatter={(value) => formatMoney(Number(value))} /><Bar dataKey="cost" fill="var(--primary)" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No cost data yet" />}</WorkspacePanel>;
}
