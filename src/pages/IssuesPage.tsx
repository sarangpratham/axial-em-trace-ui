import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ExternalLink, FilterX, ScanSearch } from 'lucide-react';
import { JsonHighlight } from '@/components/JsonHighlight';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EmptyState, ErrorState, FilterBar, FilterField, LoadingState, MetricCard, PageContainer, PageHeader, WorkspacePanel } from '@/components/workbench/layout';
import type { TraceExplorerState } from '@/hooks/useTraceExplorerState';
import { getIssues } from '@/lib/api';
import { humanizeToken } from '@/lib/sourceResolution';
import type { IssueRecord } from '@/types';

const SCOPE_OPTIONS = ['all', 'main', 'parent'] as const;
const SEVERITY_OPTIONS = ['all', 'low', 'medium', 'high', 'critical'] as const;
const STATUS_OPTIONS = ['all', 'open', 'resolved', 'blocked', 'pending'] as const;
const GROUP_OPTIONS = ['source', 'component', 'type'] as const;
const controlClass = 'h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

function issueLabel(value?: string | null) { return humanizeToken(value, 'issue'); }
function formatTimestamp(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function sourceLabel(issue: IssueRecord) { return issue.source_entity_name || (issue.source_module && issue.source_unique_id ? `${issue.source_module} · ${issue.source_unique_id}` : issue.source_trace_id || 'Run-level issue'); }
function componentLabel(issue: IssueRecord) { return issue.component_key || 'No component'; }
function groupIssues(items: IssueRecord[], mode: (typeof GROUP_OPTIONS)[number]) {
  const groups = new Map<string, IssueRecord[]>();
  for (const issue of items) {
    const key = mode === 'component' ? componentLabel(issue) : mode === 'type' ? issue.issue_type : sourceLabel(issue);
    groups.set(key, [...(groups.get(key) ?? []), issue]);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

export function IssuesPage({ explorer }: { explorer: TraceExplorerState }) {
  const navigate = useNavigate();
  const { selectedRunId, summary, openSourceRecord, selectReviewCase, setReviewTab } = explorer;
  const [inputScope, setInputScope] = useState<(typeof SCOPE_OPTIONS)[number]>('all');
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number]>('all');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [groupMode, setGroupMode] = useState<(typeof GROUP_OPTIONS)[number]>('source');
  const [selectedIssue, setSelectedIssue] = useState<IssueRecord | null>(null);

  const issuesQuery = useQuery({
    queryKey: ['issues-tab', selectedRunId, inputScope, severity, status, typeFilter],
    queryFn: () => getIssues({ runId: selectedRunId, inputScope: inputScope === 'all' ? undefined : inputScope, severity: severity === 'all' ? undefined : severity, status: status === 'all' ? undefined : status, issueType: typeFilter || undefined, limit: 5000 }),
    enabled: Boolean(selectedRunId), staleTime: 20_000, gcTime: 5 * 60_000,
  });
  const issues = issuesQuery.data ?? [];
  const availableTypes = useMemo(() => [...new Set(issues.map((issue) => issue.issue_type))].sort(), [issues]);
  const groupedIssues = useMemo(() => groupIssues(issues, groupMode), [groupMode, issues]);
  const linkedReviewCount = issues.filter((issue) => issue.review_case_id).length;
  const urgentCount = issues.filter((issue) => issue.severity === 'critical' || issue.severity === 'high').length;
  const resetFilters = () => { setInputScope('all'); setSeverity('all'); setStatus('all'); setTypeFilter(''); setGroupMode('source'); };

  function openExplorer(issue: IssueRecord) {
    if (!issue.source_module || !issue.source_unique_id) return;
    openSourceRecord(issue.source_module, issue.source_unique_id);
    navigate(`/explorer?${new URLSearchParams({ run_id: selectedRunId, selected_module: issue.source_module, selected_unique_id: issue.source_unique_id })}`);
  }
  function openReview(issue: IssueRecord) {
    if (!issue.review_case_id) return;
    setReviewTab('needs_review'); selectReviewCase(issue.review_case_id);
    navigate(`/review?${new URLSearchParams({ run_id: selectedRunId, review_tab: 'needs_review', review_case_id: issue.review_case_id })}`);
  }

  return (
    <PageContainer>
      <PageHeader eyebrow="Quality signals" title="Investigate issues without losing context" description="Filter operational signals, compare related records, and move directly into Explorer or Review when action is needed." />
      <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Issues in run" value={summary?.issue_count ?? issues.length} />
        <MetricCard label="Visible now" value={issues.length} detail={`${groupedIssues.length} ${groupMode} groups`} />
        <MetricCard label="High priority" value={urgentCount} tone={urgentCount ? 'danger' : 'neutral'} detail="Critical and high severity" />
        <MetricCard label="Linked reviews" value={linkedReviewCount} tone={linkedReviewCount ? 'warning' : 'neutral'} detail="Cases requiring a human decision" />
      </div>
      <FilterBar>
        <FilterField label="Scope"><select className={controlClass} value={inputScope} onChange={(e) => setInputScope(e.target.value as typeof inputScope)}>{SCOPE_OPTIONS.map((v) => <option key={v} value={v}>{issueLabel(v)}</option>)}</select></FilterField>
        <FilterField label="Severity"><select className={controlClass} value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>{SEVERITY_OPTIONS.map((v) => <option key={v} value={v}>{issueLabel(v)}</option>)}</select></FilterField>
        <FilterField label="Status"><select className={controlClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>{STATUS_OPTIONS.map((v) => <option key={v} value={v}>{issueLabel(v)}</option>)}</select></FilterField>
        <FilterField label="Issue type" className="min-w-[190px]"><select className={controlClass} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">All issue types</option>{availableTypes.map((v) => <option key={v} value={v}>{issueLabel(v)}</option>)}</select></FilterField>
        <FilterField label="Group by"><select className={controlClass} value={groupMode} onChange={(e) => setGroupMode(e.target.value as typeof groupMode)}>{GROUP_OPTIONS.map((v) => <option key={v} value={v}>{issueLabel(v)}</option>)}</select></FilterField>
        <Button variant="ghost" className="ml-auto" onClick={resetFilters}><FilterX />Reset</Button>
      </FilterBar>

      <WorkspacePanel>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><div><h3 className="text-sm font-semibold">Grouped issues</h3><p className="text-[11px] text-muted-foreground">Select a row to inspect evidence and related actions.</p></div><span className="text-xs tabular-nums text-muted-foreground">{issues.length} results</span></div>
        {issuesQuery.isLoading ? <LoadingState label="Loading issues" /> : issuesQuery.isError ? <ErrorState message={issuesQuery.error instanceof Error ? issuesQuery.error.message : 'Issues could not be loaded.'} onRetry={() => void issuesQuery.refetch()} /> : !issues.length ? <EmptyState title="No issues match these filters" description="Try clearing one or more filters to widen the result set." action={<Button variant="outline" onClick={resetFilters}>Clear filters</Button>} /> : (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="compact-data-table w-full min-w-[920px] text-left text-xs"><thead className="sticky top-0 bg-muted/80 text-[11px] text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Issue</th><th className="px-3 py-2.5 font-medium">Severity</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 font-medium">Scope</th><th className="px-3 py-2.5 font-medium">Component</th><th className="px-3 py-2.5 font-medium">Created</th><th className="w-20 px-3 py-2.5" /></tr></thead><tbody>
              {groupedIssues.flatMap(([group, items]) => [<tr key={`group-${group}`} className="border-y border-border bg-secondary/55"><td colSpan={7} className="px-4 py-1.5 text-[11px] font-semibold"><span>{group}</span><span className="ml-2 font-normal text-muted-foreground">{items.length} issues</span></td></tr>, ...items.map((issue) => <tr key={issue.id} className="cursor-pointer border-b border-border/70 transition hover:bg-accent/60" onClick={() => setSelectedIssue(issue)}><td className="max-w-md px-4 py-2.5"><div className="font-medium">{issue.display_name || issueLabel(issue.issue_type)}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{issue.plain_meaning || issue.reason}</div></td><td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5 capitalize"><AlertTriangle className="size-3.5 text-warning" />{issue.severity}</span></td><td className="px-3 py-2.5"><StatusBadge label={issue.status} /></td><td className="px-3 py-2.5 capitalize">{issue.input_scope || 'main'}</td><td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{componentLabel(issue)}</td><td className="px-3 py-2.5 text-[11px] text-muted-foreground">{formatTimestamp(issue.created_at)}</td><td className="px-3 py-2.5"><Button size="sm" variant="ghost"><ScanSearch />Inspect</Button></td></tr>)])}
            </tbody></table></div>
            <div className="divide-y divide-border md:hidden">{issues.map((issue) => <button key={issue.id} type="button" className="w-full p-4 text-left hover:bg-accent" onClick={() => setSelectedIssue(issue)}><div className="flex items-start justify-between gap-3"><div className="font-medium">{issue.display_name || issueLabel(issue.issue_type)}</div><StatusBadge label={issue.status} /></div><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{issue.plain_meaning || issue.reason}</p><div className="mt-3 flex items-center gap-3 text-xs capitalize text-muted-foreground"><span>{issue.severity}</span><span>{issue.input_scope || 'main'}</span></div></button>)}</div>
          </>
        )}
      </WorkspacePanel>

      <Sheet open={Boolean(selectedIssue)} onOpenChange={(open) => { if (!open) setSelectedIssue(null); }}><SheetContent side="right" className="overflow-y-auto sm:max-w-xl">{selectedIssue && <><SheetHeader><div className="mb-2 flex gap-2"><StatusBadge label={selectedIssue.status} /><span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium capitalize text-warning">{selectedIssue.severity}</span></div><SheetTitle>{selectedIssue.display_name || issueLabel(selectedIssue.issue_type)}</SheetTitle><SheetDescription>{selectedIssue.plain_meaning || selectedIssue.reason}</SheetDescription></SheetHeader><div className="grid grid-cols-2 gap-4 rounded-xl bg-muted p-4 text-sm"><div><div className="text-xs text-muted-foreground">Scope</div><div className="mt-1 font-medium">{selectedIssue.input_scope || 'main'}</div></div><div><div className="text-xs text-muted-foreground">Created</div><div className="mt-1">{formatTimestamp(selectedIssue.created_at)}</div></div><div className="col-span-2"><div className="text-xs text-muted-foreground">Source</div><div className="mt-1 font-mono text-xs">{sourceLabel(selectedIssue)}</div></div><div className="col-span-2"><div className="text-xs text-muted-foreground">Component</div><div className="mt-1 font-mono text-xs">{componentLabel(selectedIssue)}</div></div></div><div className="mt-5 flex flex-wrap gap-2">{selectedIssue.source_module && selectedIssue.source_unique_id && <Button size="sm" onClick={() => openExplorer(selectedIssue)}><ExternalLink />Open Explorer</Button>}{selectedIssue.review_case_id && <Button size="sm" variant="secondary" onClick={() => openReview(selectedIssue)}><ExternalLink />Open Review</Button>}</div><div className="mt-7"><h3 className="mb-2 text-sm font-semibold">Issue payload</h3><JsonHighlight className="json-body json-body--embedded" data={selectedIssue.issue_payload} /></div></>}</SheetContent></Sheet>
    </PageContainer>
  );
}
