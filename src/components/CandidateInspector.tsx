import { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react';
import type { CandidateEvaluation } from '../types';
import { StatusBadge } from './StatusBadge';

type Props = {
  candidates: CandidateEvaluation[];
};

function scoreForCandidate(cand: CandidateEvaluation, idx: number, total: number): number {
  // Derive a deterministic display score from available signals
  // since the API doesn't expose a raw float score directly
  if (cand.rank_key && cand.rank_key.length > 0) {
    const primary = cand.rank_key[0];
    const base = Math.max(0, 1 - (primary / (total + 1)));
    return Math.min(0.99, base + (cand.is_match ? 0.1 : -0.1));
  }
  if (cand.is_match && idx === 0) return 0.95;
  if (cand.is_match) return 0.7 - idx * 0.04;
  return Math.max(0.05, 0.55 - idx * 0.08);
}

function scoreColor(score: number): string {
  if (score > 0.85) return 'var(--green)';
  if (score > 0.65) return 'var(--cyan)';
  if (score > 0.4) return 'var(--amber)';
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

export function CandidateInspector({ candidates }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    candidates[0]?.candidate_id ?? '',
  );
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);

  // Synchronize table height with evidence pane
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
  }, [candidates.length]); // Re-run if evidence content changes

  const scores = useMemo(
    () =>
      Object.fromEntries(
        candidates.map((c, i) => [c.candidate_id, scoreForCandidate(c, i, candidates.length)]),
      ),
    [candidates],
  );

  const displayedCandidates = candidates.slice(0, visibleCount);
  const hasMore = visibleCount < candidates.length;

  // Incremental rendering: gradually show more candidates on initial load
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
    () => candidates.find((c) => c.candidate_id === selectedId) ?? candidates[0],
    [candidates, selectedId],
  );

  if (!candidates.length) {
    return (
      <div className="empty-state">
        <p>No candidate evaluations captured for this entity.</p>
      </div>
    );
  }

  const score = selected ? scores[selected.candidate_id] ?? 0 : 0;

  return (
    <div className="candidate-wrap">
      {/* Table */}
      <div className="ctable-wrap" ref={tableWrapRef} style={{ maxHeight: 'var(--evidence-height)', overflowY: 'auto' }}>
        <table className="ctable">
          <thead>
            <tr>
              <th>#</th>
              <th>Entity ID</th>
              <th>Candidate</th>
              <th>Phase</th>
              <th>Type</th>
              <th>URL Status</th>
              <th>Score</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {displayedCandidates.map((c, i) => {
              const s = scores[c.candidate_id] ?? 0;
              const rankCls = i === 0 ? 'rank-badge--winner' : i < 3 ? 'rank-badge--top' : '';
              return (
                <tr
                  key={`${c.search_kind}-${c.candidate_id}`}
                  className={selectedId === c.candidate_id ? 'ctable-row--active' : ''}
                  onClick={() => setSelectedId(c.candidate_id)}
                >
                  <td>
                    <span className={`rank-badge ${rankCls}`}>{i + 1}</span>
                  </td>
                  <td className="entity-id-cell">{c.candidate_id}</td>
                  <td className="name-cell" title={c.candidate_name}>
                    {c.candidate_name || c.candidate_id}
                  </td>
                  <td>
                    <span style={{ color: 'var(--text3)', fontSize: '10px' }}>
                      {c.match_phase || '—'}
                    </span>
                  </td>
                  <td className="type-cell">
                    <span style={{ fontSize: '10px' }}>
                      {c.match_type?.replace(/_/g, ' ') || '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text3)', fontSize: '10px' }}>
                      {c.url_status || '—'}
                    </span>
                  </td>
                  <td style={{ minWidth: 100 }}>
                    <div className="score-bar">
                      <div className="score-bar-track">
                        <div
                          className="score-bar-fill"
                          style={{
                            width: `${Math.round(s * 100)}%`,
                            background: scoreColor(s),
                          }}
                        />
                      </div>
                      <span className="score-val" style={{ color: scoreColor(s) }}>
                        {s.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge label={c.is_match ? 'master_match' : 'no_match'} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hasMore && (
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <button
              onClick={() => setVisibleCount(prev => Math.min(prev + CHUNK_SIZE, candidates.length))}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Load more…
            </button>
          </div>
        )}
      </div>

      {/* Evidence pane */}
      {selected && (
        <div className="evidence-pane" ref={evidenceRef}>
          <div className="evidence-pane-head">
            <div className="evidence-pane-name" title={selected.candidate_name}>
              {selected.candidate_name || selected.candidate_id}
            </div>
            <span className="evidence-score" style={{ color: scoreColor(score) }}>
              {score.toFixed(2)}
            </span>
          </div>
          <div className="evidence-rows">
            <EvidenceRow label="URL" value={selected.candidate_url} url />
            <EvidenceRow label="Phase" value={selected.match_phase} />
            <EvidenceRow label="Match Type" value={selected.match_type?.replace(/_/g, ' ')} />
            <EvidenceRow label="Name Match" value={selected.name_match_type} />
            <EvidenceRow label="URL Status" value={selected.url_status} />
            <EvidenceRow label="URL Decision" value={selected.url_decision?.replace(/_/g, ' ')} />
            <EvidenceRow label="Src Field" value={selected.source_field} />
            <EvidenceRow label="Tgt Field" value={selected.target_field} />
            <EvidenceRow label="Matched Src" value={selected.matched_source_name} />
            <EvidenceRow label="Matched Tgt" value={selected.matched_target_name} />
          </div>
          <div className="reason-block">
            {selected.context_reason || 'No reasoning captured for this candidate.'}
          </div>
        </div>
      )}
    </div>
  );
}