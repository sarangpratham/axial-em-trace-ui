import { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react';
import type { CandidateEvaluation, SourceEvaluationContext } from '../types';
import { candidateDispositionLabel, humanizeToken } from '../lib/sourceResolution';
import { StatusBadge } from './StatusBadge';

type Props = {
  candidates: CandidateEvaluation[];
  evaluationContext?: SourceEvaluationContext;
};

function scoreForCandidate(cand: CandidateEvaluation, idx: number, total: number): number {
  if (cand.final_candidate_status === 'selected') return 0.96;
  if (cand.final_candidate_status === 'pending_review') return 0.64;
  if (cand.final_candidate_status === 'viable_not_selected') return 0.56;
  if (cand.evaluation_status === 'agent_required') return 0.42;
  if (cand.evaluation_status === 'agent_insufficient') return 0.36;
  if (cand.final_candidate_status === 'suppressed') return 0.22;
  return Math.max(0.08, 0.24 - idx * (1 / Math.max(total, 1)));
}

function scoreColor(score: number): string {
  if (score > 0.8) return 'var(--green)';
  if (score > 0.55) return 'var(--cyan)';
  if (score > 0.35) return 'var(--amber)';
  return 'var(--red)';
}

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

export function CandidateInspector({ candidates, evaluationContext }: Props) {
  const [selectedKey, setSelectedKey] = useState<string>(
    candidates[0] ? candidateSelectionKey(candidates[0], 0) : '',
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
  }, [candidates.length]);

  const scores = useMemo(
    () =>
      Object.fromEntries(
        candidates.map((candidate, index) => [
          candidateSelectionKey(candidate, index),
          scoreForCandidate(candidate, index, candidates.length),
        ]),
      ),
    [candidates],
  );

  const displayedCandidates = candidates.slice(0, visibleCount);
  const hasMore = visibleCount < candidates.length;

  useEffect(() => {
    setSelectedKey(candidates[0] ? candidateSelectionKey(candidates[0], 0) : '');
    setVisibleCount(CHUNK_SIZE);
  }, [candidates]);

  useEffect(() => {
    if (candidates.length > CHUNK_SIZE && visibleCount < CHUNK_SIZE) {
      const timer = setInterval(() => {
        setVisibleCount((prev) => {
          if (prev >= candidates.length) {
            clearInterval(timer);
            return prev;
          }
          return Math.min(prev + CHUNK_SIZE, candidates.length);
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [candidates.length]);

  const selected = useMemo(
    () =>
      candidates.find((candidate, index) => candidateSelectionKey(candidate, index) === selectedKey)
      ?? candidates[0],
    [candidates, selectedKey],
  );

  if (!candidates.length) {
    return (
      <div className="empty-state">
        <p>No candidate evaluations were captured for this source.</p>
      </div>
    );
  }

  const score = selected ? scores[selectedKey] ?? 0 : 0;

  return (
    <div className="candidate-wrap">
      <div className="ctable-wrap" ref={tableWrapRef} style={{ maxHeight: 'var(--evidence-height)', overflowY: 'auto' }}>
        <table className="ctable">
          <thead>
            <tr>
              <th>#</th>
              <th>Candidate</th>
              <th>Phase</th>
              <th>Rule</th>
              <th>Route</th>
              <th>Disposition</th>
            </tr>
          </thead>
          <tbody>
            {displayedCandidates.map((c, i) => {
              const selectionKey = candidateSelectionKey(c, i);
              const rankCls = i === 0 ? 'rank-badge--winner' : i < 3 ? 'rank-badge--top' : '';
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
              onClick={() => setVisibleCount(prev => Math.min(prev + CHUNK_SIZE, candidates.length))}
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
            <span className="evidence-score" style={{ color: scoreColor(score) }}>
              {score.toFixed(2)}
            </span>
          </div>
          <div className="evidence-rows">
            <EvidenceRow label="Source URL at Eval" value={evaluationContext?.source_url_at_evaluation} url />
            <EvidenceRow label="Current Source URL" value={evaluationContext?.current_source_url} url />
            <EvidenceRow label="Candidate URL" value={selected.candidate_entity_url} url />
            <EvidenceRow label="Candidate ID" value={selected.candidate_entity_id} />
            <EvidenceRow label="Evaluation Score" value={score.toFixed(2)} />
            <EvidenceRow label="Phase" value={selected.match_phase} />
            <EvidenceRow label="Match Rule" value={humanizeToken(selected.match_type)} />
            <EvidenceRow label="Decision Source" value={humanizeToken(selected.decision_source)} />
            <EvidenceRow label="Agent Lane" value={humanizeToken(selected.agent_lane)} />
            <EvidenceRow label="Resolution Route" value={humanizeToken(selected.resolution_route || selected.url_decision, 'deterministic')} />
            <EvidenceRow label="Blocked Reason" value={humanizeToken(selected.blocked_reason)} />
            <EvidenceRow label="Evaluation Status" value={humanizeToken(selected.evaluation_status)} />
            <EvidenceRow label="Agent Decision" value={humanizeToken(selected.agent_decision)} />
            <EvidenceRow label="Agent Confidence" value={selected.agent_confidence} />
            <EvidenceRow label="Final Disposition" value={candidateDispositionLabel(selected.final_candidate_status)} />
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
