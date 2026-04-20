import { useMemo, useState } from 'react';
import type { TraceDetail } from '../types';
import {
  humanizeToken,
  isAssignedExistingMaster,
  isCreatedNewMaster,
  isPendingReview,
  sourceResolutionLabel,
} from '../lib/sourceResolution';
import { AnomalyList } from './AnomalyList';

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

  const enr = detail.derived_enrichment as Record<string, unknown> | null | undefined;
  const retrievalSummary = detail.retrieval_summary as Record<string, unknown> | null | undefined;
  const resolution = detail.resolution as Record<string, unknown> | null | undefined;
  const candidates = detail.candidate_evaluations ?? [];
  const isMatch = isAssignedExistingMaster(detail.resolution_status);
  const isNew = isCreatedNewMaster(detail.resolution_status);
  const pendingReview = isPendingReview(detail.resolution_status);
  const retrievalCandidateCount = Number(retrievalSummary?.candidate_count ?? detail.candidate_count ?? 0);
  const rejectedCandidateCount = Math.max(0, detail.candidate_count - detail.viable_candidate_count);
  const blockedCandidates = useMemo(
    () =>
      candidates.filter((candidate) =>
        Boolean(candidate.blocked_reason)
        || candidate.evaluation_status === 'agent_required'
        || candidate.final_candidate_status === 'pending_review',
      ).length,
    [candidates],
  );
  const agentReviewedCandidates = useMemo(
    () =>
      candidates.filter((candidate) =>
        candidate.agent_lane === 'url_web_agent'
        || candidate.agent_lane === 'context_agent'
        || Boolean(candidate.agent_decision),
      ),
    [candidates],
  );
  const agentRoutes = Array.from(new Set(
    agentReviewedCandidates
      .map((candidate) => candidate.agent_lane || candidate.resolution_route || candidate.agent_decision)
      .filter((value): value is string => Boolean(value)),
  ));
  const matchPhaseCounts = retrievalSummary?.match_phase_counts as Record<string, number> | undefined;
  const matchTypeCounts = retrievalSummary?.match_type_counts as Record<string, number> | undefined;
  const retrievalNotes = [
    ...Object.entries(matchPhaseCounts ?? {}).map(([phase, count]) => `${humanizeToken(phase)} (${count})`),
    ...Object.entries(matchTypeCounts ?? {}).map(([matchType, count]) => `${humanizeToken(matchType)} (${count})`),
  ].slice(0, 4);

  const stages: Stage[] = [
    {
      label: 'Source Input',
      name: detail.source_entity_name || detail.source_unique_id,
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
      label: 'Derived Enrichment',
      name: enr?.eligible ? 'URL / web context ready' : 'Skipped',
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
    {
      label: 'Candidate Retrieval',
      name: `${detail.candidate_count} candidate${detail.candidate_count === 1 ? '' : 's'}`,
      detail: retrievalNotes.length > 0
        ? retrievalNotes.join(' · ')
        : `${retrievalCandidateCount} surfaced candidate rows`,
      status: detail.candidate_count > 0 ? 'hit' : 'warn',
      colorVar: 'var(--blue)',
      cardClass: detail.candidate_count > 0 ? '' : 'stage-card--fail',
      drawerContent: (
        <div className="drawer-grid">
          <DrawerRow label="Candidate rows" value={String(retrievalCandidateCount)} />
          {Object.entries(matchPhaseCounts ?? {}).map(([phase, count]) => (
            <DrawerRow key={phase} label={`Phase · ${humanizeToken(phase)}`} value={String(count)} />
          ))}
          {Object.entries(matchTypeCounts ?? {}).map(([matchType, count]) => (
            <DrawerRow key={matchType} label={`Rule · ${humanizeToken(matchType)}`} value={String(count)} />
          ))}
        </div>
      ),
    },
    {
      label: 'Candidate Evaluation',
      name: `${detail.viable_candidate_count} viable`,
      detail: `${rejectedCandidateCount} rejected · ${blockedCandidates} blocked for review`,
      status: detail.viable_candidate_count > 0 ? 'ok' : pendingReview ? 'warn' : 'fail',
      colorVar: detail.viable_candidate_count > 0 ? 'var(--green)' : pendingReview ? 'var(--amber)' : 'var(--red)',
      cardClass: detail.viable_candidate_count > 0 ? 'stage-card--success' : pendingReview ? 'stage-card--warn' : 'stage-card--fail',
      drawerContent: (
        <div className="drawer-grid">
          <DrawerRow label="Candidates evaluated" value={String(detail.candidate_count)} />
          <DrawerRow label="Viable after rules" value={String(detail.viable_candidate_count)} />
          <DrawerRow label="Rejected" value={String(rejectedCandidateCount)} />
          <DrawerRow label="Blocked for agent review" value={String(blockedCandidates)} />
        </div>
      ),
    },
    {
      label: 'Agent Review',
      name: agentReviewedCandidates.length > 0 ? `${agentReviewedCandidates.length} routed` : 'Not needed',
      detail: agentRoutes.length > 0
        ? agentRoutes.map((route) => humanizeToken(route)).join(' · ')
        : 'Deterministic evaluation was sufficient',
      status: agentReviewedCandidates.length > 0 ? 'ok' : 'skip',
      colorVar: agentReviewedCandidates.length > 0 ? 'var(--amber)' : 'var(--text3)',
      cardClass: agentReviewedCandidates.length > 0 ? 'stage-card--warn' : '',
      drawerContent: (
        <div className="drawer-grid">
          <DrawerRow label="Agent-routed candidates" value={String(agentReviewedCandidates.length)} />
          <DrawerRow label="Resolution routes" value={agentRoutes.map((route) => humanizeToken(route)).join(', ') || 'None'} />
          <DrawerRow
            label="Agent outcomes"
            value={agentReviewedCandidates
              .map((candidate) => candidate.agent_decision)
              .filter((value): value is string => Boolean(value))
              .map((value) => humanizeToken(value))
              .join(', ') || 'No agent outcome metadata captured'}
          />
        </div>
      ),
    },
    {
      label: 'Source Resolution',
      name: sourceResolutionLabel(detail.resolution_status),
      detail: detail.assigned_entity_name ?? detail.assigned_entity_id ?? 'Human review still required',
      status: isMatch ? 'ok' : isNew ? 'warn' : pendingReview ? 'warn' : 'fail',
      colorVar: isMatch ? 'var(--green)' : isNew ? 'var(--purple)' : pendingReview ? 'var(--amber)' : 'var(--red)',
      cardClass: isMatch ? 'stage-card--success' : pendingReview ? 'stage-card--warn' : isNew ? '' : 'stage-card--fail',
      drawerContent: (
        <div className="drawer-grid">
          <DrawerRow label="Resolution status" value={sourceResolutionLabel(detail.resolution_status)} />
          <DrawerRow label="Selected entity" value={detail.assigned_entity_name} />
          <DrawerRow label="Selected entity ID" value={detail.assigned_entity_id} />
          <DrawerRow label="Decision source" value={humanizeToken(detail.decision_source)} />
          <DrawerRow label="Winning candidate" value={String(resolution?.winning_candidate_entity_id ?? '—')} />
          <DrawerRow label="Pending review reason" value={humanizeToken(String(resolution?.pending_review_reason ?? ''))} />
        </div>
      ),
    },
    {
      label: 'Anomalies / Follow-Up',
      name: `${detail.anomaly_count || 0} signal${detail.anomaly_count === 1 ? '' : 's'}`,
      detail: detail.anomaly_count ? 'Operational follow-up may be required' : 'No anomaly signals recorded',
      status: detail.anomaly_count ? 'warn' : 'ok',
      colorVar: 'var(--red)',
      cardClass: detail.anomaly_count ? 'stage-card--anomaly' : '',
      drawerContent: (
        <AnomalyList anomalies={detail.anomalies || []} />
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
