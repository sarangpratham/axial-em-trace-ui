import { useDeferredValue } from 'react';
import type { TraceSummary } from '../types';
import { AlertTriangle } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

function IssueBadge({ count, severity }: { count: number; severity?: string }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning" title={severity}>
      <AlertTriangle aria-hidden="true" /> {count}
    </span>
  );
}

function formatIssueType(value: string) {
  return value.split('_').join(' ');
}

type Props = {
  traces: TraceSummary[];
  selectedTraceId?: string;
  activeIssueType?: string;
  onSelect: (trace: TraceSummary) => void;
};

export function TraceList({ traces, selectedTraceId, activeIssueType, onSelect }: Props) {
  const deferredTraces = useDeferredValue(traces);

  if (!deferredTraces.length) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No entities match current filters.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {deferredTraces.map((trace) => {
        const traceId = `${trace.source_module}::${trace.source_unique_id}`;
        const active = traceId === selectedTraceId;
        return (
          <button
            key={trace.source_trace_id}
            className={`w-full p-3 text-left transition-colors hover:bg-accent/60 ${active ? 'bg-primary/8 shadow-[inset_3px_0_0_var(--primary)]' : ''}`}
            onClick={() => onSelect(trace)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 truncate font-medium">{trace.source_entity_name || 'Unnamed entity'}</div>
              <StatusBadge label={trace.resolution_status} />
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
              {trace.source_module} · {trace.source_unique_id}
            </div>
            <div className="mt-1.5 line-clamp-2 text-xs leading-4 text-muted-foreground">{trace.decision_story}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">
                {trace.candidate_count} candidates · {trace.viable_candidate_count} viable
              </span>
              {trace.decision_source && <StatusBadge label={trace.decision_source} />}
              {trace.has_issues && (
                <IssueBadge count={trace.issue_count || 0} severity={trace.issue_severity || undefined} />
              )}
              {activeIssueType && trace.issue_types?.includes(activeIssueType) && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">{formatIssueType(activeIssueType)}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
