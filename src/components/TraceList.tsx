import { useDeferredValue } from 'react';
import type { TraceSummary } from '../types';
import { StatusBadge } from './StatusBadge';

type Props = {
  traces: TraceSummary[];
  selectedTraceId?: string;
  onSelect: (trace: TraceSummary) => void;
};

export function TraceList({ traces, selectedTraceId, onSelect }: Props) {
  const deferredTraces = useDeferredValue(traces);

  if (!deferredTraces.length) {
    return (
      <div style={{ padding: '20px 14px', color: 'var(--text3)', fontSize: '11px', textAlign: 'center' }}>
        No entities match current filters.
      </div>
    );
  }

  return (
    <div className="trace-list">
      {deferredTraces.map((trace) => {
        const traceId = `${trace.source_module}::${trace.source_unique_id}`;
        const active = traceId === selectedTraceId;
        return (
          <button
            key={trace.source_trace_id}
            className={`trace-row${active ? ' trace-row--active' : ''}`}
            onClick={() => onSelect(trace)}
            type="button"
          >
            <div className="tr-head">
              <div className="tr-name">{trace.source_entity_name}</div>
              <StatusBadge label={trace.final_status} />
            </div>
            <div className="tr-meta">
              {trace.source_module} · {trace.source_unique_id}
            </div>
            <div className="tr-story">{trace.decision_story}</div>
            <div className="tr-foot">
              <span className="tr-counts">
                {trace.candidate_count} cands · {trace.matched_candidate_count} pos
              </span>
              {trace.winner_origin && <StatusBadge label={trace.winner_origin} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}