import { Fragment, useState } from 'react';
import type { IssueRecord } from '../types';
import { JsonHighlight } from './JsonHighlight';

type Props = {
  issues: IssueRecord[];
};

export function IssueList({ issues }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!issues.length) {
    return (
      <div className="empty-state anomaly-empty-state">
        No issues detected for this entity.
      </div>
    );
  }

  return (
    <div className="anomaly-list data-table-shell">
      <table className="anomaly-table data-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>Status</th>
            <th>Reason</th>
            <th>Review</th>
            <th style={{ width: '24px' }}></th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <Fragment key={issue.id}>
              <tr key={issue.id}>
                <td>
                  <span className={`badge anomaly-severity-badge anomaly-severity-badge--${issue.severity}`}>
                    {issue.severity}
                  </span>
                </td>
                <td>
                  <code className="anomaly-type">{issue.issue_type}</code>
                </td>
                <td>{issue.status}</td>
                <td className="anomaly-reason" title={issue.reason}>
                  {issue.reason}
                </td>
                <td className="anomaly-winner-cell">
                  {issue.review_case_id || '—'}
                </td>
                <td>
                  <button
                    className="anomaly-details-toggle"
                    onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                    type="button"
                  >
                    {expandedId === issue.id ? '▲' : '▼'}
                  </button>
                </td>
              </tr>
              {expandedId === issue.id && (
                <tr key={`${issue.id}-details`}>
                  <td colSpan={6} className="anomaly-details-cell">
                    <div className="anomaly-details-panel">
                      <div className="anomaly-details-title">
                        <strong>Issue Details</strong>
                      </div>
                      {Object.keys(issue.issue_payload).length > 0 ? (
                        <div className="anomaly-details-json">
                          <JsonHighlight data={issue.issue_payload} />
                        </div>
                      ) : (
                        <div className="anomaly-details-empty">No additional details</div>
                      )}
                      <div className="anomaly-details-meta">
                        <span>Source: {issue.source_module}::{issue.source_unique_id}</span>
                        <span>Component: {issue.component_key || '—'}</span>
                        <span>Created: {new Date(issue.created_at).toLocaleString()}</span>
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
