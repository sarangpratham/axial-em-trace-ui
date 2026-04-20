import { useDeferredValue } from 'react';
import type { TraceSummary } from '../types';
import { StatusBadge } from './StatusBadge';

function AnomalyBadge({ count, severity }: { count: number; severity?: string }) {
  if (!count) return null;
  return (
    <span className={`badge badge--anomaly badge--severity-${severity || 'medium'}`}>
      ⚠ {count}
    </span>
  );
}

function formatAnomalyType(value: string) {
  return value.split('_').join(' ');
}

type Props = {
  traces: TraceSummary[];
  selectedTraceId?: string;
  activeAnomalyType?: string;
  onSelect: (trace: TraceSummary) => void;
};

export function TraceList({ traces, selectedTraceId, activeAnomalyType, onSelect }: Props) {
  const deferredTraces = useDeferredValue(traces);

  if (!deferredTraces.length) {
    return (
      <div className="trace-list-empty">
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
              <StatusBadge label={trace.resolution_status} />
            </div>
            <div className="tr-meta">
              {trace.source_module} · {trace.source_unique_id}
            </div>
            <div className="tr-story">{trace.decision_story}</div>
            <div className="tr-foot">
              <span className="tr-counts">
                {trace.candidate_count} candidates · {trace.viable_candidate_count} viable
              </span>
              {trace.decision_source && <StatusBadge label={trace.decision_source} />}
              {trace.has_anomalies && (
                <AnomalyBadge count={trace.anomaly_count || 0} severity={trace.anomaly_severity || undefined} />
              )}
              {activeAnomalyType && trace.anomaly_types?.includes(activeAnomalyType) && (
                <span className="trace-anomaly-type-pill">{formatAnomalyType(activeAnomalyType)}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
