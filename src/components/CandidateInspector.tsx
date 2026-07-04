import { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react';
import type { CandidateEvaluation, SourceEvaluationContext } from '../types';
import { candidateDispositionLabel, humanizeToken } from '../lib/sourceResolution';
import { StatusBadge } from './StatusBadge';

type Props = {
  candidates: CandidateEvaluation[];
  evaluationContext?: SourceEvaluationContext;
};

type EvidenceRowProps = { label: string; value: string | null | undefined; url?: boolean };
function EvidenceRow({ label, value, url }: EvidenceRowProps) {
  return (
    <div className="evidence-row">
      <div className="ev-key">{label}</div>
      <div className={`ev-val${url ? ' ev-val--url' : ''}`}>{value || '—'}</div>
    </div>
  );
}

const CHUNK_SIZE = 100;

function candidateSelectionKey(candidate: CandidateEvaluation, index: number) {
  return `${candidate.candidate_entity_id}:${candidate.match_phase || 'candidate'}:${index}`;
}

function candidateOutcomeRank(candidate: CandidateEvaluation) {
  const status = (candidate.final_candidate_status || candidate.evaluation_status || '').toLowerCase();
  if (status === 'selected') return 0;
  if (status === 'deterministic_accept' || status === 'agent_accept') return 1;
  if (status === 'agent_required' || status === 'agent_insufficient' || status === 'agent_prep_failed') return 2;
  if (status === 'suppressed') return 3;
  return 4;
}

function isAcceptedCandidate(candidate: CandidateEvaluation) {
  return candidateOutcomeRank(candidate) <= 1;
}

export function CandidateInspector({ candidates, evaluationContext }: Props) {
  const orderedCandidates = useMemo(
    () =>
      [...candidates].sort((left, right) =>
        candidateOutcomeRank(left) - candidateOutcomeRank(right)
        || (left.candidate_entity_name || left.candidate_entity_id).localeCompare(
          right.candidate_entity_name || right.candidate_entity_id,
        ),
      ),
    [candidates],
  );
  const [selectedKey, setSelectedKey] = useState<string>(
    orderedCandidates[0] ? candidateSelectionKey(orderedCandidates[0], 0) : '',
  );
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!evidenceRef.current) return;
    const updateTableHeight = () => {
      if (!tableWrapRef.current) return;
      const height = evidenceRef.current!.offsetHeight;
      tableWrapRef.current.style.setProperty('--evidence-height', `${height}px`);
    };
    updateTableHeight();
    window.addEventListener('resize', updateTableHeight);
    return () => window.removeEventListener('resize', updateTableHeight);
  }, [orderedCandidates.length]);

  const displayedCandidates = orderedCandidates.slice(0, visibleCount);
  const hasMore = visibleCount < orderedCandidates.length;

  useEffect(() => {
    setSelectedKey(orderedCandidates[0] ? candidateSelectionKey(orderedCandidates[0], 0) : '');
    setVisibleCount(CHUNK_SIZE);
  }, [orderedCandidates]);

  useEffect(() => {
    if (orderedCandidates.length > CHUNK_SIZE && visibleCount < CHUNK_SIZE) {
      const timer = setInterval(() => {
        setVisibleCount((prev) => {
          if (prev >= orderedCandidates.length) {
            clearInterval(timer);
            return prev;
          }
          return Math.min(prev + CHUNK_SIZE, orderedCandidates.length);
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [orderedCandidates.length, visibleCount]);

  const selected = useMemo(
    () =>
      orderedCandidates.find((candidate, index) => candidateSelectionKey(candidate, index) === selectedKey)
      ?? orderedCandidates[0],
    [orderedCandidates, selectedKey],
  );

  if (!candidates.length) {
    return (
      <div className="empty-state">
        <p>No candidate evaluations were captured for this source.</p>
      </div>
    );
  }

  return (
    <div className="candidate-wrap">
      <div className="ctable-wrap data-table-shell" ref={tableWrapRef} style={{ maxHeight: 'var(--evidence-height)', overflowY: 'auto' }}>
        <table className="ctable data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Candidate</th>
              <th>Phase</th>
              <th>Rule</th>
              <th>Route</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {displayedCandidates.map((c, i) => {
              const selectionKey = candidateSelectionKey(c, i);
              const rankCls = isAcceptedCandidate(c) ? 'rank-badge--winner' : '';
              return (
                <tr
                  key={selectionKey}
                  className={selectedKey === selectionKey ? 'ctable-row--active' : ''}
                  onClick={() => setSelectedKey(selectionKey)}
                >
                  <td>
                    <span className={`rank-badge ${rankCls}`}>{i + 1}</span>
                  </td>
                  <td className="name-cell" title={c.candidate_entity_name || c.candidate_entity_id}>
                    <div>{c.candidate_entity_name || c.candidate_entity_id}</div>
                    <span className="candidate-cell-meta candidate-cell-meta--muted">
                      {c.candidate_entity_id}
                    </span>
                  </td>
                  <td className="type-cell">
                    <span className="candidate-cell-meta">
                      {humanizeToken(c.match_phase)}
                    </span>
                  </td>
                  <td>
                    <span className="candidate-cell-meta">
                      {humanizeToken(c.match_type)}
                    </span>
                  </td>
                  <td>
                    <span className="candidate-cell-meta candidate-cell-meta--muted">
                      {humanizeToken(c.resolution_route || c.decision_source || c.agent_lane, 'deterministic')}
                    </span>
                  </td>
                  <td>
                    <StatusBadge label={c.final_candidate_status || c.evaluation_status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hasMore && (
          <div className="candidate-load-more-wrap">
            <button
              onClick={() => setVisibleCount(prev => Math.min(prev + CHUNK_SIZE, orderedCandidates.length))}
              className="candidate-load-more"
            >
              Load more…
            </button>
          </div>
        )}
      </div>

      {selected && (
        <div className="evidence-pane" ref={evidenceRef}>
          <div className="evidence-pane-head">
            <div className="evidence-pane-name" title={selected.candidate_entity_name || selected.candidate_entity_id}>
              {selected.candidate_entity_name || selected.candidate_entity_id}
            </div>
          </div>
          <div className="evidence-rows">
            <EvidenceRow label="Source URL at Eval" value={evaluationContext?.source_url_at_evaluation} url />
            <EvidenceRow label="Current Source URL" value={evaluationContext?.current_source_url} url />
            <EvidenceRow label="Candidate URL" value={selected.candidate_entity_url} url />
            <EvidenceRow label="Candidate ID" value={selected.candidate_entity_id} />
            <EvidenceRow label="Phase" value={selected.match_phase} />
            <EvidenceRow label="Match Rule" value={humanizeToken(selected.match_type)} />
            <EvidenceRow label="Decision Source" value={humanizeToken(selected.decision_source)} />
            <EvidenceRow label="Agent Lane" value={humanizeToken(selected.agent_lane)} />
            <EvidenceRow label="Resolution Route" value={humanizeToken(selected.resolution_route || selected.url_decision, 'deterministic')} />
            <EvidenceRow label="Blocked Reason" value={humanizeToken(selected.blocked_reason)} />
            <EvidenceRow label="Evaluation Status" value={humanizeToken(selected.evaluation_status)} />
            <EvidenceRow label="Agent Decision" value={humanizeToken(selected.agent_decision)} />
            <EvidenceRow label="Agent Confidence" value={selected.agent_confidence} />
            <EvidenceRow label="Final Outcome" value={candidateDispositionLabel(selected.final_candidate_status)} />
            <EvidenceRow label="Suppression Reason" value={humanizeToken(selected.suppression_reason)} />
            <EvidenceRow label="Name Match Type" value={humanizeToken(selected.name_match_type)} />
            <EvidenceRow label="URL Decision" value={humanizeToken(selected.url_decision)} />
            <EvidenceRow label="URL Skip Context" value={humanizeToken(evaluationContext?.url_matching_skipped_reason)} />
          </div>
          <div className="reason-block">
            {selected.agent_reason || 'No agent reasoning was captured for this candidate.'}
          </div>
        </div>
      )}
    </div>
  );
}
