import type { Dispatch, SetStateAction } from 'react';
import { useDeferredValue, useMemo, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppTopbar } from '../components/AppTopbar';
import { CandidateInspector } from '../components/CandidateInspector';
import { DecisionPipeline } from '../components/DecisionPipeline';
import { StatusBadge } from '../components/StatusBadge';
import { TraceList } from '../components/TraceList';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
import { searchMasterEntities } from '../lib/insightsApi';
import type {
  MasterSearchResult,
  ReviewCaseDetail,
  ReviewCaseListItem,
  ReviewDecisionPayload,
  ReviewPublishBatch,
  ReviewPublishResponse,
} from '../types';

const MODULE_OPTIONS = ['news', 'linkedin', 'portfolio'];
const ANOMALY_PRESENCE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'with', label: 'With' },
  { value: 'clean', label: 'Clean' },
] as const;
const REVIEW_TABS = [
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'ready', label: 'Reviewed / Ready' },
  { key: 'blocked', label: 'Publish Blocked' },
  { key: 'failed', label: 'Publish Failed' },
  { key: 'published', label: 'Published' },
  { key: 'all', label: 'All Cases' },
] as const;
const DECISION_OPTIONS: Array<{
  value: ReviewDecisionPayload['decision'];
  label: string;
  hint: string;
}> = [
  {
    value: 'assign_existing_master',
    label: 'Assign Existing Master',
    hint: 'Finalize this frontier against one existing entity.',
  },
  {
    value: 'create_new_entity',
    label: 'Create New Entity',
    hint: 'Publish later as a brand-new entity.',
  },
  {
    value: 'merge_clusters_and_assign_existing_master',
    label: 'Merge Clusters + Existing Master',
    hint: 'Merge this frontier and bind it to an existing entity.',
  },
  {
    value: 'merge_clusters_and_create_new_entity',
    label: 'Merge Clusters + New Entity',
    hint: 'Merge the frontier, then publish as a new entity.',
  },
  {
    value: 'keep_clusters_separate',
    label: 'Keep Clusters Separate',
    hint: 'Preserve distinct clusters and let publish recompute them separately.',
  },
] as const;
const TERMINAL_PUBLISH_STATUSES = new Set([
  'completed',
  'completed_with_issues',
  'failed',
]);

function formatAnomalyLabel(value: string) {
  return value.split('_').join(' ');
}

function formatLabel(value?: string | null) {
  if (!value) return '—';
  return value.split('_').join(' ');
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatPayload(payload: unknown) {
  if (!payload) return '—';
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function requiresTargetEntityId(decision: string) {
  return (
    decision === 'assign_existing_master'
    || decision === 'merge_clusters_and_assign_existing_master'
  );
}

function canSelectForPublish(item: ReviewCaseListItem) {
  return (
    item.review_status === 'reviewed'
    && (item.publish_status === 'ready' || item.publish_status === 'publish_failed')
  );
}

function isDecisionLocked(detail: ReviewCaseDetail | null | undefined) {
  if (!detail) return true;
  return detail.review_status === 'superseded' || detail.publish_status === 'published';
}

function formatCaseTitle(item: ReviewCaseListItem | null | undefined) {
  if (!item) return 'No review case selected';
  return item.representative_source_name || item.representative_source_trace_id || item.case_id;
}

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

function ExplorerToolbar({ explorer }: { explorer: TraceExplorerState }) {
  const {
    runsQuery,
    selectedRunId,
    updateParam,
    searchInput,
    setSearchInput,
    moduleFilter,
    statusFilter,
    summary,
    anomalyPresenceFilter,
    anomalyTypeFilter,
    availableAnomalyTypes,
    setAnomalyPresenceFilter,
    setAnomalyTypeFilter,
    publishSummary,
  } = explorer;

  return (
    <section className="explorer-toolbar">
      <div className="explorer-toolbar-main">
        <div className="explorer-toolbar-copy">
          <div className="explorer-toolbar-title">Explorer Filters</div>
        </div>

        <div className="explorer-toolbar-controls">
          <span className="topbar-filter-label">Run</span>
          <select className="topbar-select" value={selectedRunId} onChange={(event) => updateParam('run_id', event.target.value)}>
            {(runsQuery.data ?? []).map((runId) => (
              <option key={runId} value={runId}>
                {runId}
              </option>
            ))}
          </select>

          <span className="topbar-filter-label">Search</span>
          <input
            className="topbar-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="entity name or ID..."
          />

          <span className="topbar-filter-label">Module</span>
          <select className="topbar-select" value={moduleFilter} onChange={(event) => updateParam('module', event.target.value)}>
            <option value="">all</option>
            {MODULE_OPTIONS.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>

          <span className="topbar-filter-label">Outcome</span>
          <select className="topbar-select" value={statusFilter} onChange={(event) => updateParam('final_status', event.target.value)}>
            <option value="">all</option>
            <option value="master_match">master_match</option>
            <option value="incoming_second_pass_match">second_pass</option>
            <option value="new_entity_created">new_entity</option>
            <option value="no_match">no_match</option>
            <option value="pending_human_review">pending_review</option>
          </select>
        </div>
      </div>

      <div className="explorer-anomaly-rail">
        <div className="explorer-anomaly-group">
          <span className="topbar-filter-label">Anomalies</span>
          <div className="anomaly-segmented-control" role="group" aria-label="Anomaly presence filter">
            {ANOMALY_PRESENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`anomaly-segment${anomalyPresenceFilter === option.value ? ' anomaly-segment--active' : ''}${
                  option.value === 'with' ? ' anomaly-segment--warn' : option.value === 'clean' ? ' anomaly-segment--clean' : ''
                }`}
                onClick={() => setAnomalyPresenceFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="explorer-anomaly-group">
          <span className="topbar-filter-label">Type</span>
          <select
            className="topbar-select explorer-anomaly-select"
            value={anomalyTypeFilter}
            onChange={(event) => setAnomalyTypeFilter(event.target.value)}
            disabled={anomalyPresenceFilter === 'clean' || availableAnomalyTypes.length === 0}
          >
            <option value="">
              {availableAnomalyTypes.length > 0 ? 'all anomaly types' : 'no anomaly types'}
            </option>
            {availableAnomalyTypes.map(([type, count]) => (
              <option key={type} value={type}>
                {formatAnomalyLabel(type)} ({count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {summary && (
        <div className="explorer-toolbar-stats">
          <div className="stat-pill stat-pill--total">
            <span className="num">{summary.total_traces}</span> total
          </div>
          <div className="stat-divider" />
          <div className="stat-pill stat-pill--match">
            <span className="stat-dot" />
            <span className="num">{summary.matched_count}</span> matched
          </div>
          <div className="stat-pill stat-pill--new">
            <span className="stat-dot" />
            <span className="num">{summary.new_entity_count}</span> new
          </div>
          <div className="stat-pill stat-pill--none">
            <span className="stat-dot" />
            <span className="num">{summary.no_match_count}</span> no match
          </div>
          {publishSummary && (
            <>
              <div className="stat-divider" />
              <div className="stat-pill stat-pill--review">
                <span className="num">{publishSummary.open_review_case_count}</span> open review
              </div>
              <div className="stat-pill stat-pill--review">
                <span className="num">{publishSummary.reviewed_unpublished_case_count}</span> ready
              </div>
              <div className="stat-pill stat-pill--blocked">
                <span className="num">{publishSummary.publish_blocked_case_count}</span> blocked
              </div>
              <div className="stat-pill stat-pill--failed">
                <span className="num">{publishSummary.publish_failed_case_count}</span> failed
              </div>
              <div className="stat-pill stat-pill--published">
                <span className="num">{publishSummary.published_case_count}</span> published
              </div>
            </>
          )}
          {summary.anomaly_total && summary.anomaly_total > 0 && (
            <>
              <div className="stat-divider" />
              <div className="stat-pill stat-pill--anomaly">
                <span className="stat-dot" style={{ background: 'var(--red)' }} />
                <span className="num">{summary.anomaly_total}</span> anomalies
              </div>
              {summary.anomaly_by_severity &&
                Object.entries(summary.anomaly_by_severity).map(([severity, count]) => (
                  <div key={severity} className={`stat-pill stat-pill--severity-${severity}`}>
                    <span className="num">{count}</span> {severity}
                  </div>
                ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function formatMasterOption(master: MasterSearchResult) {
  const parts = [
    master.entity_name || master.entity_id,
    master.entity_url || '',
  ].filter(Boolean);
  return parts.join(' · ');
}

export function ReviewWorkspace({
  explorer,
  selectedCaseIds,
  setSelectedCaseIds,
  decision,
  setDecision,
  targetEntityId,
  setTargetEntityId,
  decisionReason,
  setDecisionReason,
  saveDecisionMutation,
  publishMutation,
  publishBatch,
  onSourceRecordSelected,
}: {
  explorer: TraceExplorerState;
  selectedCaseIds: string[];
  setSelectedCaseIds: Dispatch<SetStateAction<string[]>>;
  decision: string;
  setDecision: Dispatch<SetStateAction<string>>;
  targetEntityId: string;
  setTargetEntityId: Dispatch<SetStateAction<string>>;
  decisionReason: string;
  setDecisionReason: Dispatch<SetStateAction<string>>;
  saveDecisionMutation: UseMutationResult<
    {
      case_id: string;
      review_status: string;
      publish_status: string;
      decision: string;
      target_entity_id?: string | null;
      decision_summary?: string | null;
      reviewed_at?: string | null;
      idempotent: boolean;
    },
    Error,
    { caseId: string; payload: ReviewDecisionPayload },
    unknown
  >;
  publishMutation: UseMutationResult<
    ReviewPublishResponse,
    Error,
    { runId: string; caseIds: string[] },
    unknown
  >;
  publishBatch: ReviewPublishBatch | null;
  onSourceRecordSelected?: (source: ReviewCaseDetail['sources'][number]) => void;
}) {
  const {
    selectedRunId,
    reviewTab,
    setReviewTab,
    reviewCases,
    reviewCaseDetail,
    selectReviewCase,
    reviewCasesQuery,
    reviewCaseDetailQuery,
    publishSummary,
  } = explorer;

  const selectedCase = reviewCaseDetail;
  const selectedCaseId = selectedCase?.case_id ?? '';
  const [masterSearchInput, setMasterSearchInput] = useState('');
  const deferredMasterSearch = useDeferredValue(masterSearchInput.trim());
  const requiresExistingMasterSelection = requiresTargetEntityId(decision);
  const candidateMasterIds = selectedCase?.candidate_master_ids ?? [];
  const candidateMastersQuery = useQuery({
    queryKey: ['review-case-candidate-masters', selectedCaseId, candidateMasterIds.join(',')],
    queryFn: () =>
      searchMasterEntities({
        entityIds: candidateMasterIds,
        limit: Math.max(candidateMasterIds.length, 10),
      }),
    enabled: requiresExistingMasterSelection && candidateMasterIds.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const searchedMastersQuery = useQuery({
    queryKey: ['review-master-search', deferredMasterSearch],
    queryFn: () =>
      searchMasterEntities({
        query: deferredMasterSearch,
        limit: 12,
      }),
    enabled: requiresExistingMasterSelection && deferredMasterSearch.length >= 2,
    staleTime: 15_000,
    gcTime: 60_000,
  });
  const masterOptions = useMemo(() => {
    const byId = new Map<string, MasterSearchResult>();
    for (const master of candidateMastersQuery.data ?? []) {
      byId.set(master.entity_id, master);
    }
    for (const master of searchedMastersQuery.data ?? []) {
      byId.set(master.entity_id, master);
    }
    return [...byId.values()];
  }, [candidateMastersQuery.data, searchedMastersQuery.data]);
  const selectedMaster = useMemo(
    () => masterOptions.find((master) => master.entity_id === targetEntityId) ?? null,
    [masterOptions, targetEntityId],
  );
  const canSaveDecision = Boolean(
    selectedCaseId
      && decision
      && !saveDecisionMutation.isPending
      && !isDecisionLocked(selectedCase)
      && (!requiresTargetEntityId(decision) || targetEntityId.trim()),
  );
  const selectableReviewedCases = reviewCases.filter(canSelectForPublish);
  const selectedPublishableCaseIds = selectedCaseIds.filter((caseId) =>
    selectableReviewedCases.some((item) => item.case_id === caseId),
  );

  const toggleCaseSelection = (caseId: string) => {
    setSelectedCaseIds((current) =>
      current.includes(caseId)
        ? current.filter((item) => item !== caseId)
        : [...current, caseId],
    );
  };

  const handleSaveDecision = () => {
    if (!selectedCaseId || !decision) return;
    saveDecisionMutation.mutate({
      caseId: selectedCaseId,
      payload: {
        decision: decision as ReviewDecisionPayload['decision'],
        target_entity_id: requiresTargetEntityId(decision) ? targetEntityId.trim() || null : null,
        reason: decisionReason.trim() || null,
      },
    });
  };

  const handlePublishReviewed = () => {
    if (!selectedRunId) return;
    publishMutation.mutate({ runId: selectedRunId, caseIds: [] });
  };

  const handlePublishSelected = () => {
    if (!selectedRunId || selectedPublishableCaseIds.length === 0) return;
    publishMutation.mutate({ runId: selectedRunId, caseIds: selectedPublishableCaseIds });
  };

  return (
    <section className="review-workspace">
      <div className="review-header">
        <div className="review-header-copy">
          <div className="section-title-text">Human Review Queue</div>
          <div className="review-header-sub">
            Decisions stay staged until you publish reviewed frontiers.
          </div>
        </div>
        <div className="review-header-actions">
          <button
            type="button"
            className="review-button review-button--secondary"
            onClick={handlePublishReviewed}
            disabled={!selectedRunId || publishMutation.isPending || (publishSummary?.reviewed_unpublished_case_count ?? 0) === 0}
          >
            Publish Reviewed
          </button>
          <button
            type="button"
            className="review-button"
            onClick={handlePublishSelected}
            disabled={publishMutation.isPending || selectedPublishableCaseIds.length === 0}
          >
            Publish Selected ({selectedPublishableCaseIds.length})
          </button>
        </div>
      </div>

      <div className="review-summary-grid">
        <div className="review-summary-card">
          <div className="review-summary-label">Needs Review</div>
          <div className="review-summary-value">{publishSummary?.open_review_case_count ?? 0}</div>
        </div>
        <div className="review-summary-card">
          <div className="review-summary-label">Ready to Publish</div>
          <div className="review-summary-value">{publishSummary?.reviewed_unpublished_case_count ?? 0}</div>
        </div>
        <div className="review-summary-card">
          <div className="review-summary-label">Publish Blocked</div>
          <div className="review-summary-value">{publishSummary?.publish_blocked_case_count ?? 0}</div>
        </div>
        <div className="review-summary-card">
          <div className="review-summary-label">Publish Failed</div>
          <div className="review-summary-value">{publishSummary?.publish_failed_case_count ?? 0}</div>
        </div>
        <div className="review-summary-card">
          <div className="review-summary-label">Published</div>
          <div className="review-summary-value">{publishSummary?.published_case_count ?? 0}</div>
        </div>
      </div>

      {publishMutation.isError && (
        <div className="review-callout review-callout--error">
          {publishMutation.error instanceof Error ? publishMutation.error.message : 'Failed to start publish batch.'}
        </div>
      )}
      {saveDecisionMutation.isError && (
        <div className="review-callout review-callout--error">
          {saveDecisionMutation.error instanceof Error ? saveDecisionMutation.error.message : 'Failed to save review decision.'}
        </div>
      )}
      {saveDecisionMutation.isSuccess && (
        <div className="review-callout review-callout--success">
          Review decision saved. Nothing is finalized until you publish.
        </div>
      )}

      {publishBatch && (
        <div className={`review-callout${TERMINAL_PUBLISH_STATUSES.has(publishBatch.status) ? ' review-callout--success' : ''}`}>
          <div className="review-callout-title">
            Publish Batch {publishBatch.publish_id} · {formatLabel(publishBatch.status)}
          </div>
          <div className="review-callout-grid">
            <span>Success {publishBatch.successful_case_ids.length}</span>
            <span>Blocked {publishBatch.blocked_case_ids.length}</span>
            <span>Failed {publishBatch.failed_case_ids.length}</span>
          </div>
        </div>
      )}

      <div className="review-tabs" role="tablist" aria-label="Review case filters">
        {REVIEW_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`review-tab${reviewTab === tab.key ? ' review-tab--active' : ''}`}
            onClick={() => setReviewTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="review-grid">
        <aside className="review-list-panel">
          <div className="review-panel-head">
            <span>Cases</span>
            <span>{reviewCases.length}</span>
          </div>
          {reviewCasesQuery.isLoading ? (
            <div className="review-panel-empty">Loading review cases…</div>
          ) : reviewCases.length === 0 ? (
            <div className="review-panel-empty">No review cases for this filter.</div>
          ) : (
            <div className="review-case-list">
              {reviewCases.map((item) => {
                const checked = selectedCaseIds.includes(item.case_id);
                const publishable = canSelectForPublish(item);
                return (
                  <button
                    key={item.case_id}
                    type="button"
                    className={`review-case-row${selectedCaseId === item.case_id ? ' review-case-row--active' : ''}`}
                    onClick={() => selectReviewCase(item.case_id)}
                  >
                    <div className="review-case-row-head">
                      <div>
                        <div className="review-case-title">{formatCaseTitle(item)}</div>
                        <div className="review-case-meta">
                          {formatLabel(item.case_type)} · {item.source_count} sources
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!publishable}
                        onChange={(event) => {
                          event.stopPropagation();
                          toggleCaseSelection(item.case_id);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${item.case_id} for publish`}
                      />
                    </div>
                    <div className="review-case-badges">
                      <StatusBadge label={item.review_status} />
                      <StatusBadge label={item.publish_status} />
                    </div>
                    <div className="review-case-summary">
                      {item.decision_summary || 'No decision saved yet.'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="review-detail-panel">
          {reviewCaseDetailQuery.isLoading ? (
            <div className="review-panel-empty">Loading case detail…</div>
          ) : !selectedCase ? (
            <div className="review-panel-empty">Select a case to inspect evidence and save a decision.</div>
          ) : (
            <>
              <div className="review-detail-head">
                <div>
                  <div className="detail-eyebrow">{selectedCase.case_id}</div>
                  <div className="detail-name review-detail-title">{formatCaseTitle(selectedCase)}</div>
                  <div className="review-detail-sub">
                    Frontier review for {selectedCase.phase} · created {formatDate(selectedCase.created_at)}
                  </div>
                </div>
                <div className="detail-badges">
                  <StatusBadge label={selectedCase.review_status} />
                  <StatusBadge label={selectedCase.publish_status} />
                </div>
              </div>

              <div className="review-detail-body">
                <div className="review-detail-section">
                  <div className="section-title">
                    <span className="section-title-text">Frontier Members</span>
                    <span className="section-hint">{selectedCase.sources.length} source records</span>
                  </div>
                  <div className="review-chip-group">
                    {selectedCase.sources.map((source) => (
                      <button
                        key={`${source.source_module}:${source.source_unique_id}`}
                        type="button"
                        className="review-chip"
                        onClick={() => {
                          explorer.selectTrace({
                            run_id: source.run_id,
                            source_trace_id: source.source_trace_id,
                            source_module: source.source_module,
                            source_unique_id: source.source_unique_id,
                            source_entity_name: source.source_entity_name ?? source.source_unique_id,
                            source_member_name: source.source_member_name ?? '',
                            source_entity_role: source.source_entity_role ?? '',
                            search_stage: source.stage ?? null,
                            final_status: source.final_status ?? null,
                            winner_entity_id: source.assigned_entity_id ?? null,
                            winner_entity_name: source.assigned_entity_name ?? null,
                            winner_origin: source.assignment_kind ?? null,
                            candidate_count: source.candidate_count,
                            matched_candidate_count: source.matched_candidate_count,
                            decision_story: source.final_status ?? 'pending_human_review',
                          });
                          onSourceRecordSelected?.(source);
                        }}
                      >
                        {source.source_entity_name ?? source.source_unique_id}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="review-detail-section">
                  <div className="section-title">
                    <span className="section-title-text">Case Evidence</span>
                  </div>
                  <div className="review-chip-group">
                    {selectedCase.candidate_master_ids.map((masterId) => (
                      <span key={masterId} className="review-chip review-chip--static">
                        master:{masterId}
                      </span>
                    ))}
                    {selectedCase.related_cluster_ids.map((clusterId) => (
                      <span key={clusterId} className="review-chip review-chip--static">
                        cluster:{clusterId}
                      </span>
                    ))}
                    {selectedCase.related_edge_keys.map((edgeKey) => (
                      <span key={edgeKey} className="review-chip review-chip--static">
                        edge:{edgeKey}
                      </span>
                    ))}
                    {selectedCase.candidate_master_ids.length === 0
                      && selectedCase.related_cluster_ids.length === 0
                      && selectedCase.related_edge_keys.length === 0 && (
                        <span className="review-empty-inline">No extra frontier evidence captured.</span>
                    )}
                  </div>
                </div>

                <div className="review-detail-columns">
                  <div className="review-detail-section">
                    <div className="section-title">
                      <span className="section-title-text">Decision</span>
                    </div>
                    <div className="review-form">
                      <label className="review-field">
                        <span className="review-field-label">Outcome</span>
                        <select
                          className="topbar-select review-select"
                          value={decision}
                          onChange={(event) => setDecision(event.target.value)}
                          disabled={isDecisionLocked(selectedCase)}
                        >
                          <option value="">Select a decision</option>
                          {DECISION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <span className="review-field-hint">
                          {DECISION_OPTIONS.find((option) => option.value === decision)?.hint
                            || 'Choose what should happen when this frontier is eventually published.'}
                        </span>
                      </label>

                      {requiresExistingMasterSelection && (
                        <div className="review-field">
                          <span className="review-field-label">Existing Master</span>
                          {candidateMasterIds.length > 0 && (
                            <div className="review-field-hint">
                              Candidate masters from this frontier are shown first.
                            </div>
                          )}
                          {(candidateMastersQuery.data ?? []).length > 0 && (
                            <div className="review-master-list">
                              {(candidateMastersQuery.data ?? []).map((master) => (
                                <button
                                  key={master.entity_id}
                                  type="button"
                                  className={`review-master-option${targetEntityId === master.entity_id ? ' review-master-option--active' : ''}`}
                                  onClick={() => setTargetEntityId(master.entity_id)}
                                  disabled={isDecisionLocked(selectedCase)}
                                >
                                  <span className="review-master-option-title">
                                    {master.entity_name || master.entity_id}
                                  </span>
                                  <span className="review-master-option-meta">
                                    {formatMasterOption(master)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                          <input
                            className="topbar-input review-input"
                            value={masterSearchInput}
                            onChange={(event) => setMasterSearchInput(event.target.value)}
                            disabled={isDecisionLocked(selectedCase)}
                            placeholder="search all masters by name or URL"
                          />
                          {searchedMastersQuery.isFetching && (
                            <span className="review-field-hint">Searching existing masters…</span>
                          )}
                          {deferredMasterSearch.length >= 2 && (searchedMastersQuery.data ?? []).length > 0 && (
                            <div className="review-master-list review-master-list--search">
                              {(searchedMastersQuery.data ?? []).map((master) => (
                                <button
                                  key={master.entity_id}
                                  type="button"
                                  className={`review-master-option${targetEntityId === master.entity_id ? ' review-master-option--active' : ''}`}
                                  onClick={() => setTargetEntityId(master.entity_id)}
                                  disabled={isDecisionLocked(selectedCase)}
                                >
                                  <span className="review-master-option-title">
                                    {master.entity_name || master.entity_id}
                                  </span>
                                  <span className="review-master-option-meta">
                                    {formatMasterOption(master)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                          {selectedMaster ? (
                            <span className="review-field-hint">
                              Selected {selectedMaster.entity_id} · {selectedMaster.entity_name || 'unnamed master'}
                            </span>
                          ) : targetEntityId ? (
                            <span className="review-field-hint">Selected {targetEntityId}</span>
                          ) : (
                            <span className="review-field-hint">
                              Choose an existing master instead of typing an entity ID.
                            </span>
                          )}
                        </div>
                      )}

                      <label className="review-field">
                        <span className="review-field-label">Reviewer Notes</span>
                        <textarea
                          className="review-textarea"
                          value={decisionReason}
                          onChange={(event) => setDecisionReason(event.target.value)}
                          disabled={isDecisionLocked(selectedCase)}
                          placeholder="why this directive is the safest choice"
                        />
                      </label>

                      <div className="review-form-actions">
                        <button
                          type="button"
                          className="review-button"
                          onClick={handleSaveDecision}
                          disabled={!canSaveDecision}
                        >
                          {saveDecisionMutation.isPending ? 'Saving…' : 'Save Decision'}
                        </button>
                        <div className="review-form-meta">
                          Reviewed {formatDate(selectedCase.reviewed_at)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="review-detail-section">
                    <div className="section-title">
                      <span className="section-title-text">Publish Blockers</span>
                    </div>
                    {selectedCase.publish_blockers.length === 0 ? (
                      <div className="review-panel-empty review-panel-empty--compact">
                        No blockers are attached to this case right now.
                      </div>
                    ) : (
                      <div className="review-blocker-list">
                        {selectedCase.publish_blockers.map((blocker, index) => (
                          <pre key={index} className="review-code-block">
                            {formatPayload(blocker)}
                          </pre>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="review-detail-columns">
                  <div className="review-detail-section">
                    <div className="section-title">
                      <span className="section-title-text">Decision Snapshot</span>
                    </div>
                    <pre className="review-code-block">
                      {formatPayload(selectedCase.decision_payload)}
                    </pre>
                  </div>
                  <div className="review-detail-section">
                    <div className="section-title">
                      <span className="section-title-text">Evidence Basis</span>
                    </div>
                    <pre className="review-code-block">
                      {formatPayload(selectedCase.decision_basis_payload)}
                    </pre>
                  </div>
                </div>

                <div className="review-detail-section">
                  <div className="section-title">
                    <span className="section-title-text">Event History</span>
                    <span className="section-hint">{selectedCase.events.length} events</span>
                  </div>
                  {selectedCase.events.length === 0 ? (
                    <div className="review-panel-empty review-panel-empty--compact">
                      No review events recorded yet.
                    </div>
                  ) : (
                    <div className="review-event-list">
                      {selectedCase.events.map((event, index) => (
                        <div key={event.event_id ?? `${event.event_type}-${index}`} className="review-event-row">
                          <div className="review-event-head">
                            <span>{formatLabel(event.event_type)}</span>
                            <span>{formatDate(event.created_at)}</span>
                          </div>
                          <div className="review-event-meta">{formatLabel(event.actor_type)}</div>
                          <pre className="review-code-block">{formatPayload(event.payload)}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function ExplorerPage({ explorer }: { explorer: TraceExplorerState }) {
  const navigate = useNavigate();
  const {
    detail,
    detailQuery,
    enrichment,
    isMatch,
    isNew,
    jsonOpen,
    outcome,
    selectedTrace,
    selectedTraceKey,
    selectTrace,
    setJsonOpen,
    traces,
    tracesQuery,
  } = explorer;
  const visibleSearches = (detail?.trace_payload.searches ?? []).filter(
    (search) => typeof search.redis_query === 'string' && search.redis_query.trim().length > 0,
  );

  const openInGraph = () => {
    if (!selectedTrace) return;
    const next = new URLSearchParams(window.location.search);
    next.set('graph_focus_kind', 'source_record');
    next.set('graph_focus_id', `source:${selectedTrace.source_trace_id}`);
    navigate({ pathname: '/graph', search: next.toString() });
  };

  return (
    <div className="shell shell--explorer">
      <AppTopbar
        currentView="explorer"
        statusSlot={<span className="topbar-status-chip" title={explorer.selectedRunId}>Run {explorer.selectedRunId || 'not selected'}</span>}
      />

      <div className="explorer-shell">
        <ExplorerToolbar explorer={explorer} />

        <aside className="sidebar">
          <div className="sidebar-head">
            <span className="sidebar-head-title">Source Entities</span>
            <span className="sidebar-head-count">{traces.length}</span>
          </div>
          {tracesQuery.isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              loading…
            </div>
          ) : tracesQuery.isError ? (
            <div className="error-state">
              <span>⚠</span>
              Failed to load traces
            </div>
          ) : (
            <TraceList
              traces={traces}
              selectedTraceId={selectedTraceKey}
              activeAnomalyType={explorer.anomalyTypeFilter}
              onSelect={selectTrace}
            />
          )}
        </aside>

        <main className="main">
          {!selectedTrace ? (
            <div className="empty-state empty-state--panel">
              <span className="empty-icon">⬡</span>
              <p>Select an entity to inspect its decision story</p>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="loading-state loading-state--panel">
              <div className="loading-spinner" />
              loading trace detail…
            </div>
          ) : detailQuery.isError ? (
            <div className="error-state error-state--panel">
              <span>⚠</span>
              Failed to load trace detail
            </div>
          ) : detail ? (
            <div className="detail-animate" key={`${detail.source_module}::${detail.source_unique_id}`}>
              <div className="detail-header">
                <div>
                  <div className="detail-eyebrow">
                    {detail.source_module} · {detail.source_unique_id}
                  </div>
                  <div className="detail-name">{detail.source_entity_name}</div>
                  <div className="detail-story">{detail.decision_story}</div>
                </div>
                <div className="detail-badges">
                  <button type="button" className="detail-action-button" onClick={openInGraph}>
                    Open in Graph
                  </button>
                  <StatusBadge label={detail.final_status} />
                  {detail.winner_origin && <StatusBadge label={detail.winner_origin} />}
                </div>
              </div>

              <div className="metrics-row">
                <div className="metric-block">
                  <div className="metric-label">Candidates</div>
                  <div className="metric-value">{detail.candidate_count}</div>
                  <div className="metric-sub">total evaluated</div>
                  <div className="metric-bar" style={{ background: 'var(--blue-dim)' }} />
                </div>
                <div className="metric-block">
                  <div className="metric-label">Positive</div>
                  <div className="metric-value" style={{ color: 'var(--green)' }}>
                    {detail.matched_candidate_count}
                  </div>
                  <div className="metric-sub">passed threshold</div>
                  <div className="metric-bar" style={{ background: 'var(--green-dim)' }} />
                </div>
                <div className="metric-block">
                  <div className="metric-label">Searches</div>
                  <div className="metric-value">{detail.trace_payload.searches?.length ?? 0}</div>
                  <div className="metric-sub">query types run</div>
                  <div className="metric-bar" style={{ background: 'var(--blue-dim)' }} />
                </div>
                <div className="metric-block">
                  <div className="metric-label">Confidence</div>
                  <div className="metric-value" style={{ color: isMatch ? 'var(--green)' : isNew ? 'var(--purple)' : 'var(--red)' }}>
                    {outcome?.confidence != null ? `${(Number(outcome.confidence) * 100).toFixed(0)}%` : '—'}
                  </div>
                  <div className="metric-sub">final outcome score</div>
                  <div
                    className="metric-bar"
                    style={{
                      background: isMatch
                        ? 'var(--green-dim)'
                        : isNew
                          ? 'var(--purple-dim)'
                          : 'var(--red-dim)',
                    }}
                  />
                </div>
              </div>

              <div className="section">
                <div className="section-title">
                  <span className="section-title-text">⟶ Decision Pipeline</span>
                  <span className="section-hint">click a stage to inspect</span>
                </div>
                <DecisionPipeline detail={detail} />
              </div>

              <div className="section">
                <div className="section-title">
                  <span className="section-title-text">◎ Outcome Details</span>
                </div>
                <div className="outcome-grid">
                  {detail.winner_entity_name ? (
                    <div className="winner-strip">
                      <span className="winner-icon">🏆</span>
                      <div>
                        <div className="winner-label">Winner</div>
                        <div className="winner-name">{detail.winner_entity_name}</div>
                        <div className="winner-id">
                          {detail.winner_entity_id} · {detail.winner_origin}
                        </div>
                      </div>
                    </div>
                  ) : isNew ? (
                    <div className="winner-strip winner-strip--new">
                      <span className="winner-icon">✦</span>
                      <div>
                        <div className="winner-label winner-label--new">New Entity</div>
                        <div className="winner-name" style={{ color: 'var(--text2)' }}>
                          {detail.winner_entity_id ?? 'Queued for creation'}
                        </div>
                        <div className="winner-id">No existing match found</div>
                      </div>
                    </div>
                  ) : (
                    <div className="winner-strip winner-strip--empty">
                      <span className="winner-icon" style={{ filter: 'grayscale(1)' }}>🚫</span>
                      <div>
                        <div className="winner-label winner-label--empty">No Winner</div>
                        <div className="winner-name" style={{ color: 'var(--text2)' }}>
                          All candidates rejected
                        </div>
                        <div className="winner-id">Score below threshold</div>
                      </div>
                    </div>
                  )}

                  <div className="enrichment-card">
                    <span className="enrichment-icon">{enrichment?.eligible ? '🔗' : '⊘'}</span>
                    <div>
                      <div className="enrichment-title">Pre-match Enrichment</div>
                      <div className="enrichment-sub">{String(enrichment?.reason ?? 'No enrichment captured')}</div>
                      <span className={`enrichment-url${!enrichment?.eligible ? ' enrichment-url--none' : ''}`}>
                        {String(enrichment?.final_matching_url ?? 'no URL derived')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-title">
                  <span className="section-title-text">≡ Candidate Inspector</span>
                  <span className="section-hint">
                    {detail.ranked_candidate_results.length} candidates · click row for evidence
                  </span>
                </div>
                <CandidateInspector candidates={detail.ranked_candidate_results} />
              </div>

              {visibleSearches.length > 0 && (
                <div className="section">
                  <div className="section-title">
                    <span className="section-title-text">⊛ Search Queries</span>
                  </div>
                  <div className="search-cards">
                    {visibleSearches.map((search, index) => (
                      <div key={index} className="search-card">
                        <div className="search-card-head">
                          <span className="search-kind">{String(search.search_kind ?? `search_${index}`)}</span>
                        </div>
                        <pre className="search-query">{String(search.redis_query ?? 'no query captured')}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className={`json-toggle${jsonOpen ? ' json-toggle--open' : ''}`} onClick={() => setJsonOpen((value) => !value)}>
                <span className={`json-chevron${jsonOpen ? ' json-chevron--open' : ''}`}>▶</span>
                Raw Payload JSON
                <span className="json-hint">trace_payload</span>
              </button>
              {jsonOpen && (
                <div className="json-body">
                  <JsonHighlight data={detail.trace_payload} />
                </div>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
