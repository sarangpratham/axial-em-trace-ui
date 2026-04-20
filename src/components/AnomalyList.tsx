import { Fragment, useState } from 'react';
import type { AnomalyRecord } from '../types';
import { JsonHighlight } from './JsonHighlight';

type Props = {
  anomalies: AnomalyRecord[];
};

export function AnomalyList({ anomalies }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!anomalies.length) {
    return (
      <div className="empty-state anomaly-empty-state">
        No anomalies detected for this entity.
      </div>
    );
  }

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
            <Fragment key={anomaly.id}>
              <tr key={anomaly.id}>
                <td>
                  <span className={`badge anomaly-severity-badge anomaly-severity-badge--${anomaly.anomaly_severity}`}>
                    {anomaly.anomaly_severity}
                  </span>
                </td>
                <td>
                  <code className="anomaly-type">{anomaly.anomaly_type}</code>
                </td>
                <td className="anomaly-reason" title={anomaly.anomaly_reason}>
                  {anomaly.anomaly_reason}
                </td>
                <td className="anomaly-winner-cell">
                  {anomaly.winner_entity_name || '—'}
                </td>
                <td>
                  <button
                    className="anomaly-details-toggle"
                    onClick={() => setExpandedId(expandedId === anomaly.id ? null : anomaly.id)}
                  >
                    {expandedId === anomaly.id ? '▲' : '▼'}
                  </button>
                </td>
              </tr>
              {expandedId === anomaly.id && (
                <tr key={`${anomaly.id}-details`}>
                  <td colSpan={5} className="anomaly-details-cell">
                    <div className="anomaly-details-panel">
                      <div className="anomaly-details-title">
                        <strong>Anomaly Details</strong>
                      </div>
                      {Object.keys(anomaly.anomaly_details).length > 0 ? (
                        <div className="anomaly-details-json">
                          <JsonHighlight data={anomaly.anomaly_details} />
                        </div>
                      ) : (
                        <div className="anomaly-details-empty">No additional details</div>
                      )}
                      <div className="anomaly-details-meta">
                        <span>Source: {anomaly.source_module}::{anomaly.source_unique_id}</span>
                        <span>Total: {anomaly.total_candidates} cands · {anomaly.matched_candidates} matched</span>
                        <span>Created: {new Date(anomaly.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
