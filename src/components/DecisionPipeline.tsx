import { useState } from 'react';
import type { TraceDetail } from '../types';

type Props = {
  detail: TraceDetail;
};

type StageStatus = 'hit' | 'ok' | 'warn' | 'skip' | 'fail';

type Stage = {
  label: string;
  name: string;
  detail: string;
  status: StageStatus;
  colorVar: string;
  cardClass: string;
  drawerContent: React.ReactNode;
};

function DrawerRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <div className="drawer-key">{label}</div>
      <div className={`drawer-val${mono ? ' drawer-val--mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}

export function DecisionPipeline({ detail }: Props) {
  const [openStageIdx, setOpenStageIdx] = useState<number | null>(null);

  const enr = detail.pre_match_enrichment as Record<string, unknown> | null | undefined;
  const searches = detail.trace_payload.searches ?? [];
  const outcome = detail.trace_payload.final_outcome as Record<string, unknown> | null | undefined;
  const isMatch = detail.final_status === 'master_match' || detail.final_status === 'incoming_second_pass_match';
  const isNew = detail.final_status === 'new_entity_created';

  const stages: Stage[] = [
    {
      label: 'Input',
      name: detail.source_entity_name,
      detail: `${detail.source_module} · ${detail.source_member_name || '—'}`,
      status: 'hit',
      colorVar: 'var(--cyan)',
      cardClass: 'stage-card--active',
      drawerContent: (
        <div className="drawer-grid">
          <DrawerRow label="Module" value={detail.source_module} />
          <DrawerRow label="Unique ID" value={detail.source_unique_id} />
          <DrawerRow label="Member" value={detail.source_member_name} />
          <DrawerRow label="Role" value={detail.source_entity_role} />
          <DrawerRow label="Trace ID" value={detail.source_trace_id} />
        </div>
      ),
    },
    {
      label: 'Enrichment',
      name: enr?.eligible ? 'URL Derived' : 'Skipped',
      detail: enr?.eligible
        ? (String(enr?.final_matching_url ?? '—'))
        : 'No URL extracted',
      status: enr?.eligible ? 'ok' : 'skip',
      colorVar: enr?.eligible ? 'var(--amber)' : 'var(--text3)',
      cardClass: enr?.eligible ? 'stage-card--warn' : '',
      drawerContent: (
        <div className="drawer-grid">
          <DrawerRow label="Eligible" value={enr?.eligible ? 'Yes' : 'No'} />
          <DrawerRow label="Reason" value={String(enr?.reason ?? '—')} />
          <DrawerRow label="Final URL" value={String(enr?.final_matching_url ?? '—')} mono />
        </div>
      ),
    },
    ...searches.map((s, i): Stage => ({
      label: `Search ${i + 1}`,
      name: String(s.search_kind ?? `search_${i}`),
      detail: `${Array.isArray(s.potential_candidates) ? s.potential_candidates.length : 0} candidates`,
      status: 'hit',
      colorVar: 'var(--blue)',
      cardClass: '',
      drawerContent: (
        <div className="drawer-grid">
          <DrawerRow label="Kind" value={String(s.search_kind ?? '—')} />
          <DrawerRow
            label="Candidates"
            value={String(Array.isArray(s.potential_candidates) ? s.potential_candidates.length : 0)}
          />
          <DrawerRow label="Query" value={String(s.redis_query ?? '—')} mono />
        </div>
      ),
    })),
    {
      label: 'Evaluation',
      name: `${detail.candidate_count} Candidates`,
      detail: `${detail.matched_candidate_count} positive · ${detail.candidate_count - detail.matched_candidate_count} rejected`,
      status: detail.matched_candidate_count > 0 ? 'ok' : 'warn',
      colorVar: detail.matched_candidate_count > 0 ? 'var(--green)' : 'var(--red)',
      cardClass: detail.matched_candidate_count > 0 ? 'stage-card--success' : 'stage-card--fail',
      drawerContent: (
        <div className="drawer-grid">
          <DrawerRow label="Total" value={String(detail.candidate_count)} />
          <DrawerRow label="Positive" value={String(detail.matched_candidate_count)} />
          <DrawerRow label="Rejected" value={String(detail.candidate_count - detail.matched_candidate_count)} />
          <DrawerRow label="Search Stage" value={detail.search_stage} />
        </div>
      ),
    },
    {
      label: 'Outcome',
      name: detail.final_status?.replace(/_/g, ' ') ?? 'unknown',
      detail: detail.winner_entity_name ?? 'no winner selected',
      status: isMatch ? 'ok' : isNew ? 'warn' : 'fail',
      colorVar: isMatch ? 'var(--green)' : isNew ? 'var(--purple)' : 'var(--red)',
      cardClass: isMatch ? 'stage-card--success' : isNew ? '' : 'stage-card--fail',
      drawerContent: (
        <div className="drawer-grid">
          <DrawerRow label="Status" value={detail.final_status} />
          <DrawerRow label="Winner" value={detail.winner_entity_name} />
          <DrawerRow label="Winner ID" value={detail.winner_entity_id} />
          <DrawerRow label="Origin" value={detail.winner_origin} />
          <DrawerRow
            label="Confidence"
            value={outcome?.confidence != null ? `${(Number(outcome.confidence) * 100).toFixed(1)}%` : '—'}
          />
          <DrawerRow label="Method" value={String(outcome?.method ?? '—')} />
        </div>
      ),
    },
  ];

  function toggleStage(idx: number) {
    setOpenStageIdx((prev) => (prev === idx ? null : idx));
  }

  const indicatorClass = (s: StageStatus) => {
    const map: Record<StageStatus, string> = {
      ok: 'stage-indicator--ok',
      hit: 'stage-indicator--hit',
      warn: 'stage-indicator--warn',
      skip: 'stage-indicator--skip',
      fail: 'stage-indicator--fail',
    };
    return map[s];
  };

  return (
    <div className="pipeline-wrap">
      <div className="pipeline">
        {stages.map((stage, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
            {i > 0 && (
              <div className="pipeline-connector">→</div>
            )}
            <div className="pipeline-stage" style={{ flex: 1 }}>
              <div
                className={`stage-card ${stage.cardClass} ${openStageIdx === i ? 'stage-card--active' : ''}`}
                onClick={() => toggleStage(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleStage(i)}
              >
                <div className="stage-label">{stage.label}</div>
                <div className="stage-name" style={{ color: stage.colorVar }}>{stage.name}</div>
                <div className="stage-detail">{stage.detail}</div>
                <div className="stage-status">
                  <div className={`stage-indicator ${indicatorClass(stage.status)}`} />
                  <span className="stage-status-text">{stage.status}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {openStageIdx !== null && (
        <div className="pipeline-drawer">
          {stages[openStageIdx]?.drawerContent}
        </div>
      )}
    </div>
  );
}