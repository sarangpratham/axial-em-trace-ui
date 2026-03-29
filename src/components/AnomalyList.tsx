import { useState } from 'react';
import type { AnomalyRecord } from '../types';

type Props = {
  anomalies: AnomalyRecord[];
};

function JsonHighlight({ data }: { data: unknown }) {
  const highlighted = JSON.stringify(data, null, 2)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span style="color:#86efac">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span style="color:#fde68a">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span style="color:#a78bfa">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:#f9a8d4">$1</span>');

  return <pre dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

export function AnomalyList({ anomalies }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!anomalies.length) {
    return (
      <div className="empty-state" style={{ padding: '12px', textAlign: 'center', color: 'var(--text3)' }}>
        No anomalies detected for this entity.
      </div>
    );
  }

  const severityColors: Record<string, string> = {
    critical: 'var(--red)',
    high: 'var(--red)',
    medium: 'var(--amber)',
    low: 'var(--cyan)',
  };

  return (
    <div className="anomaly-list">
      <table className="anomaly-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>Reason</th>
            <th>Winner</th>
            <th style={{ width: '24px' }}></th>
          </tr>
        </thead>
        <tbody>
          {anomalies.map((anomaly) => (
            <>
              <tr key={anomaly.id}>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: `${severityColors[anomaly.anomaly_severity]}20`,
                      color: severityColors[anomaly.anomaly_severity],
                      border: `1px solid ${severityColors[anomaly.anomaly_severity]}`,
                      fontSize: '10px',
                      textTransform: 'capitalize',
                    }}
                  >
                    {anomaly.anomaly_severity}
                  </span>
                </td>
                <td>
                  <code className="anomaly-type">{anomaly.anomaly_type}</code>
                </td>
                <td className="anomaly-reason" title={anomaly.anomaly_reason}>
                  {anomaly.anomaly_reason}
                </td>
                <td style={{ fontSize: '11px', color: 'var(--text2)' }}>
                  {anomaly.winner_entity_name || '—'}
                </td>
                <td>
                  <button
                    className="anomaly-details-toggle"
                    onClick={() => setExpandedId(expandedId === anomaly.id ? null : anomaly.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--cyan)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    {expandedId === anomaly.id ? '▲' : '▼'}
                  </button>
                </td>
              </tr>
              {expandedId === anomaly.id && (
                <tr key={`${anomaly.id}-details`}>
                  <td colSpan={5} style={{ padding: 0, background: 'var(--bg2)' }}>
                    <div style={{ padding: '12px' }}>
                      <div style={{ marginBottom: '8px', fontSize: '11px', color: 'var(--text2)' }}>
                        <strong>Anomaly Details</strong>
                      </div>
                      {Object.keys(anomaly.anomaly_details).length > 0 ? (
                        <div style={{ background: 'var(--bg)', padding: '10px', borderRadius: '6px', overflow: 'auto', maxHeight: '200px' }}>
                          <JsonHighlight data={anomaly.anomaly_details} />
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text3)', fontSize: '11px' }}>No additional details</div>
                      )}
                      <div style={{ marginTop: '12px', display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text3)' }}>
                        <span>Source: {anomaly.source_module}::{anomaly.source_unique_id}</span>
                        <span>Total: {anomaly.total_candidates} cands · {anomaly.matched_candidates} matched</span>
                        <span>Created: {new Date(anomaly.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
