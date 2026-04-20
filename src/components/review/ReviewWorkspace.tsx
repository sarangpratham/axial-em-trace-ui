import type { Dispatch, SetStateAction } from 'react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { JsonHighlight } from '../JsonHighlight';
import { StatusBadge } from '../StatusBadge';
import type { TraceExplorerState } from '../../hooks/useTraceExplorerState';
import { searchMasterEntities } from '../../lib/insightsApi';
import { humanizeToken } from '../../lib/sourceResolution';
import type {
  MasterSearchResult,
  ReviewCaseDetail,
  ReviewCaseListItem,
  ReviewDecisionPayload,
  ReviewEventView,
  ReviewPublishBatch,
  ReviewPublishResponse,
} from '../../types';

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
    hint: 'Resolve these records to one existing entity.',
  },
  {
    value: 'create_new_master',
    label: 'Create New Master',
    hint: 'Resolve these records as a brand-new entity during publish.',
  },
  {
    value: 'consolidate_records_to_existing_master',
    label: 'Consolidate Records + Existing Master',
    hint: 'Consolidate this record set and bind it to one existing entity.',
  },
  {
    value: 'consolidate_records_to_new_master',
    label: 'Consolidate Records + New Master',
    hint: 'Consolidate this record set, then publish it as a new entity.',
  },
  {
    value: 'keep_record_sets_separate',
    label: 'Keep Record Sets Separate',
    hint: 'Preserve separate record sets and let publish keep them independent.',
  },
] as const;

const TERMINAL_PUBLISH_STATUSES = new Set([
  'completed',
  'completed_with_issues',
  'failed',
]);

function formatLabel(value?: string | null) {
  return humanizeToken(value);
}

function formatCaseType(value?: string | null) {
  switch (value) {
    case 'record_resolution':
      return 'record resolution review';
    case 'parent_resolution':
      return 'parent review';
    case 'master_consolidation':
      return 'duplicate master review';
    case 'anomaly_review':
      return 'anomaly review';
    default:
      return humanizeToken(value);
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function requiresTargetEntityId(decision: string) {
  return (
    decision === 'assign_existing_master'
    || decision === 'consolidate_records_to_existing_master'
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

function formatCaseTitle(item: ReviewCaseListItem | ReviewCaseDetail | null | undefined) {
  if (!item) return 'No review case selected';
  const parentLabel =
    item.phase === 'parent_processing' && typeof item.case_payload?.representative_parent_name === 'string'
      ? item.case_payload.representative_parent_name
      : '';
  if (parentLabel.trim()) return parentLabel.trim();
  return item.representative_source_name || item.representative_source_trace_id || item.case_id;
}

function isParentReviewCase(item: ReviewCaseListItem | ReviewCaseDetail | null | undefined) {
  return item?.phase === 'parent_processing';
}

function toneClassName(tone?: string | null) {
  switch (tone) {
    case 'danger':
      return 'review-tone--danger';
    case 'warning':
      return 'review-tone--warning';
    case 'positive':
      return 'review-tone--positive';
    case 'info':
      return 'review-tone--info';
    default:
      return 'review-tone--neutral';
  }
}

function buildRecordGroups(sources: ReviewCaseDetail['sources']) {
  const groups = new Map<string, ReviewCaseDetail['sources']>();
  for (const source of sources) {
    const key =
      source.assigned_entity_id
      || (source.source_entity_name ?? '').trim().toLowerCase()
      || source.source_trace_id;
    const existing = groups.get(key);
    if (existing) {
      existing.push(source);
    } else {
      groups.set(key, [source]);
    }
  }
  return [...groups.entries()]
    .map(([key, members]) => {
      const labelCounts = new Map<string, number>();
      for (const member of members) {
        const label = member.source_entity_name?.trim() || member.source_unique_id;
        labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
      }
      const label = [...labelCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || key;
      return {
        key,
        label,
        rowCount: members.length,
        sourceModules: [...new Set(members.map((member) => member.source_module))],
        examples: members.slice(0, 2),
        hiddenCount: Math.max(0, members.length - 2),
      };
    })
    .sort((left, right) => right.rowCount - left.rowCount || left.label.localeCompare(right.label));
}

function safeReviewCopy(value?: string | null) {
  if (!value || !value.trim()) return null;
  return value.trim();
}

function publishStatusBadgeLabel(value?: string | null) {
  if (value === 'blocked') return 'publish_blocked';
  return value;
}

function buildCaseSummary(
  item: ReviewCaseListItem | ReviewCaseDetail | null | undefined,
) {
  if (!item) return 'No review summary recorded yet.';
  return safeReviewCopy(item.case_conflict_summary)
    || safeReviewCopy(item.review_trigger_summary)
    || safeReviewCopy(item.decision_summary)
    || (isParentReviewCase(item)
      ? `${item.source_count} supporting record${item.source_count === 1 ? '' : 's'} still need a human parent decision.`
      : item.case_type === 'master_consolidation'
        ? 'These overlapping entities need a human consolidation decision before publish can continue.'
        : `${item.source_count} unresolved record${item.source_count === 1 ? '' : 's'} still need a human resolution decision.`);
}

function buildCaseQuestion(
  item: ReviewCaseListItem | ReviewCaseDetail | null | undefined,
) {
  if (!item) return 'Choose the safest resolution for this case.';
  return safeReviewCopy(item.case_question)
    || (isParentReviewCase(item)
      ? 'Choose the correct parent entity for this label.'
      : item.case_type === 'master_consolidation'
        ? 'Decide whether these overlapping entities should stay separate or be consolidated.'
        : 'Choose the safest outcome for this unresolved record set.');
}

function summarizeReviewEvent(event: ReviewEventView) {
  const payload = event.payload ?? {};
  const message =
    (typeof payload.message === 'string' && payload.message)
    || (typeof payload.reason === 'string' && payload.reason)
    || (typeof payload.decision === 'string' && payload.decision.split('_').join(' '))
    || null;
  return message;
}

function formatMasterOption(master: MasterSearchResult) {
  const parts = [
    master.entity_name || master.entity_id,
    master.entity_url || '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function compactExamples(
  items: Array<{ source_entity_name?: string | null; source_unique_id: string }>,
) {
  return items
    .map((item) => item.source_entity_name || item.source_unique_id)
    .join(' · ');
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
  publishBatchError,
  isPublishTracking,
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
  publishBatchError: string | null;
  isPublishTracking: boolean;
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
  const [showAllChildGroups, setShowAllChildGroups] = useState(false);
  const [showAllRecordGroups, setShowAllRecordGroups] = useState(false);
  const deferredMasterSearch = useDeferredValue(masterSearchInput.trim());
  const requiresExistingMasterSelection = requiresTargetEntityId(decision);
  const candidateEntityIds = selectedCase?.candidate_entity_ids ?? [];
  const hasChildSideCandidate = useMemo(
    () => (selectedCase?.candidate_summaries ?? []).some((candidate) => candidate.matches_supporting_child_entity),
    [selectedCase?.candidate_summaries],
  );

  const candidateMastersQuery = useQuery({
    queryKey: ['review-case-candidate-masters', selectedCaseId, candidateEntityIds.join(',')],
    queryFn: () =>
      searchMasterEntities({
        entityIds: candidateEntityIds,
        limit: Math.max(candidateEntityIds.length, 10),
      }),
    enabled: requiresExistingMasterSelection && candidateEntityIds.length > 0,
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

  const filteredCandidateMasters = useMemo(
    () => candidateMastersQuery.data ?? [],
    [candidateMastersQuery.data],
  );

  const filteredSearchedMasters = useMemo(
    () => searchedMastersQuery.data ?? [],
    [searchedMastersQuery.data],
  );

  const masterOptions = useMemo(() => {
    const byId = new Map<string, MasterSearchResult>();
    for (const master of filteredCandidateMasters) byId.set(master.entity_id, master);
    for (const master of filteredSearchedMasters) byId.set(master.entity_id, master);
    return [...byId.values()];
  }, [filteredCandidateMasters, filteredSearchedMasters]);

  const selectedMaster = useMemo(
    () => masterOptions.find((master) => master.entity_id === targetEntityId) ?? null,
    [masterOptions, targetEntityId],
  );

  const canSaveDecision = Boolean(
    selectedCaseId
      && decision
      && !saveDecisionMutation.isPending
      && !isDecisionLocked(selectedCase)
      && (!requiresExistingMasterSelection || targetEntityId.trim()),
  );

  const selectableReviewedCases = reviewCases.filter(canSelectForPublish);
  const selectedPublishableCaseIds = selectedCaseIds.filter((caseId) =>
    selectableReviewedCases.some((item) => item.case_id === caseId),
  );

  const publishBatchToneClass = publishBatch
    ? publishBatch.status === 'failed'
      ? ' review-callout--error'
      : TERMINAL_PUBLISH_STATUSES.has(publishBatch.status)
        ? ' review-callout--success'
        : ''
    : '';

  const parentChildGroups = useMemo(
    () => selectedCase?.supporting_child_groups ?? [],
    [selectedCase?.supporting_child_groups],
  );

  const recordGroups = useMemo(
    () => buildRecordGroups(selectedCase?.sources ?? []),
    [selectedCase?.sources],
  );

  const visibleParentChildGroups = showAllChildGroups
    ? parentChildGroups
    : parentChildGroups.slice(0, 3);

  const visibleRecordGroups = showAllRecordGroups
    ? recordGroups
    : recordGroups.slice(0, 3);

  useEffect(() => {
    setShowAllChildGroups(false);
    setShowAllRecordGroups(false);
  }, [selectedCaseId]);

  const sourceByTraceId = useMemo(
    () => new Map((selectedCase?.sources ?? []).map((source) => [source.source_trace_id, source])),
    [selectedCase?.sources],
  );

  const toggleCaseSelection = (caseId: string) => {
    setSelectedCaseIds((current) =>
      current.includes(caseId)
        ? current.filter((item) => item !== caseId)
        : [...current, caseId],
    );
  };

  const openSourceRecord = (source: ReviewCaseDetail['sources'][number]) => {
    explorer.selectTrace({
      run_id: source.run_id,
      source_trace_id: source.source_trace_id,
      source_module: source.source_module,
      source_unique_id: source.source_unique_id,
      source_entity_name: source.source_entity_name ?? source.source_unique_id,
      source_member_name: source.source_member_name ?? '',
      source_entity_role: source.source_entity_role ?? '',
      phase: source.phase,
      resolution_status: source.resolution_status ?? null,
      decision_source: source.decision_source ?? null,
      assigned_entity_id: source.assigned_entity_id ?? null,
      assigned_entity_name: source.assigned_entity_name ?? null,
      candidate_count: source.candidate_count,
      viable_candidate_count: source.viable_candidate_count,
      anomaly_count: source.anomaly_count,
      lineages_target_record_ids: source.lineages_target_record_ids ?? [],
      derived_enrichment: source.derived_enrichment ?? {},
      updated_at: source.updated_at ?? null,
      decision_story: humanizeToken(source.resolution_status, 'pending review'),
      has_anomalies: (source.anomaly_count ?? 0) > 0,
      anomaly_types: [],
    });
    onSourceRecordSelected?.(source);
  };

  const openSourceExampleByTraceId = (sourceTraceId: string) => {
    const source = sourceByTraceId.get(sourceTraceId);
    if (source) openSourceRecord(source);
  };

  const handleSaveDecision = () => {
    if (!selectedCaseId || !decision) return;
    saveDecisionMutation.mutate({
      caseId: selectedCaseId,
      payload: {
        decision: decision as ReviewDecisionPayload['decision'],
        target_entity_id: requiresExistingMasterSelection ? targetEntityId.trim() || null : null,
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

  const detailSummary = buildCaseSummary(selectedCase);
  const detailQuestion = buildCaseQuestion(selectedCase);

  return (
    <section className="review-workspace">
      <div className="review-header">
        <div className="review-header-copy">
          <div className="section-title-text">Human Review Queue</div>
          <div className="review-header-sub">
            Save the decision first. Nothing finalizes until you publish.
          </div>
        </div>
        <div className="review-header-actions">
          <button
            type="button"
            className="review-button review-button--secondary"
            onClick={handlePublishReviewed}
            disabled={
              !selectedRunId
              || publishMutation.isPending
              || isPublishTracking
              || (publishSummary?.reviewed_unpublished_case_count ?? 0) === 0
            }
          >
            Publish Reviewed
          </button>
          <button
            type="button"
            className="review-button"
            onClick={handlePublishSelected}
            disabled={
              publishMutation.isPending
              || isPublishTracking
              || selectedPublishableCaseIds.length === 0
            }
          >
            Publish Selected ({selectedPublishableCaseIds.length})
          </button>
        </div>
      </div>

      {publishMutation.isError && (
        <div className="review-callout review-callout--error">
          {publishMutation.error instanceof Error ? publishMutation.error.message : 'Failed to start publish batch.'}
        </div>
      )}
      {publishBatchError && (
        <div className="review-callout review-callout--error">
          {publishBatchError}
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
        <div className={`review-callout${publishBatchToneClass}`}>
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
                          {formatLabel(item.phase)} · {formatCaseType(item.case_type)} · {item.source_count} sources
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
                      <StatusBadge label={publishStatusBadgeLabel(item.publish_status)} />
                    </div>
                    <div className="review-case-summary">
                      {buildCaseSummary(item)}
                    </div>
                    {(item.primary_stop_reason || item.decision_summary) && (
                      <div className="review-case-decision">
                        {safeReviewCopy(item.decision_summary)
                          || humanizeToken(item.primary_stop_reason, 'Decision saved')}
                      </div>
                    )}
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
            <div className="review-panel-empty">Select a case to inspect the issue and save a decision.</div>
          ) : (
            <>
              <div className="review-detail-head review-detail-head--narrative">
                <div>
                  <div className="detail-eyebrow">
                    {formatLabel(selectedCase.phase)} · {formatCaseType(selectedCase.case_type)}
                  </div>
                  <div className="detail-name review-detail-title">{formatCaseTitle(selectedCase)}</div>
                  <div className="review-detail-sub">{detailQuestion}</div>
                </div>
                <div className="detail-badges">
                  <StatusBadge label={selectedCase.review_status} />
                  <StatusBadge label={publishStatusBadgeLabel(selectedCase.publish_status)} />
                </div>
              </div>

              <div className="review-detail-body">
                <div className="review-overview-grid">
                  <article className="review-overview-card review-overview-card--primary">
                    <div className="review-overview-eyebrow">Why this case exists</div>
                    <div className="review-overview-text">{detailSummary}</div>
                  </article>
                  <article className="review-overview-card">
                    <div className="review-overview-eyebrow">Decision needed</div>
                    <div className="review-overview-text">{detailQuestion}</div>
                    {selectedCase.primary_stop_reason && (
                      <div className="review-overview-note">
                        Automation stopped because {humanizeToken(selectedCase.primary_stop_reason).toLowerCase()}
                      </div>
                    )}
                    {isParentReviewCase(selectedCase) && (
                      <div className="review-overview-note">
                        The child entities below are evidence for this parent label. They are not parent candidates.
                      </div>
                    )}
                  </article>
                </div>

                {isParentReviewCase(selectedCase) && (
                  <div className="review-detail-section">
                    <div className="section-title">
                      <span className="section-title-text">Parent Label Under Review</span>
                    </div>
                    <div className="review-parent-label-card">
                      <div className="review-parent-label-name">
                        {String(selectedCase.case_payload?.representative_parent_name || formatCaseTitle(selectedCase))}
                      </div>
                      <div className="review-parent-label-meta">
                        {selectedCase.sources.length} supporting record{selectedCase.sources.length !== 1 ? 's' : ''} reference this parent label.
                      </div>
                      {String(selectedCase.case_payload?.representative_parent_name || '').includes(',') && (
                        <div className="review-inline-warning">
                          This label appears to contain multiple parties, so a single-parent assignment may be unsafe.
                        </div>
                      )}
                      {hasChildSideCandidate && (
                        <div className="review-inline-note">
                          Some parent candidates also appear among the child entities below. That can be acceptable when the parent label is self-referential.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedCase.evidence_highlights.length > 0 && (
                  <div className="review-detail-section">
                    <div className="section-title">
                      <span className="section-title-text">
                        {isParentReviewCase(selectedCase)
                          ? 'What Blocked Automatic Resolution'
                          : 'What Still Needs Human Review'}
                      </span>
                    </div>
                    <div className="review-reason-list">
                      {selectedCase.evidence_highlights.map((item, index) => (
                        <article
                          key={`${selectedCase.case_id}-evidence-${index}`}
                          className={`review-reason-card ${toneClassName(item.tone)}`.trim()}
                        >
                          <div className="review-reason-title">{item.title}</div>
                          <div className="review-reason-detail">{item.detail}</div>
                          {(item.source_label || item.route) && (
                            <div className="review-reason-meta">
                              {item.source_label && <span>{item.source_label}</span>}
                              {item.route && <span>{formatLabel(item.route)}</span>}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                <div className="review-main-grid">
                  <div className="review-main-column">
                    {selectedCase.candidate_summaries.length > 0 && (
                      <div className="review-detail-section">
                        <div className="section-title">
                          <span className="section-title-text">
                            {isParentReviewCase(selectedCase) ? 'Possible Parent Entities' : 'Possible Existing Entities'}
                          </span>
                        </div>
                        <div className="review-candidate-grid">
                          {selectedCase.candidate_summaries.map((candidate) => {
                            const canChooseCandidate = requiresExistingMasterSelection
                              && !Boolean(candidate.is_unsafe)
                              && !isDecisionLocked(selectedCase);
                            const isChosenCandidate = targetEntityId === candidate.entity_id;
                            return (
                              <article
                                key={candidate.entity_id}
                                className={`review-candidate-card ${toneClassName(candidate.tone)}`.trim()}
                              >
                                <div className="review-candidate-head">
                                  <div>
                                    <div className="review-candidate-title">
                                      {candidate.entity_name || candidate.entity_id}
                                    </div>
                                    <div className="review-candidate-meta">
                                      {candidate.entity_url || 'Existing entity candidate'}
                                    </div>
                                  </div>
                                  <div className="review-candidate-head-actions">
                                    {candidate.status_label && (
                                      <span className={`review-inline-badge ${toneClassName(candidate.tone)}`.trim()}>
                                        {candidate.status_label}
                                      </span>
                                    )}
                                    {canChooseCandidate && (
                                      <button
                                        type="button"
                                        className={`review-choice-button${isChosenCandidate ? ' review-choice-button--active' : ''}`}
                                        onClick={() => setTargetEntityId(candidate.entity_id)}
                                      >
                                        {isChosenCandidate ? 'Chosen' : 'Choose'}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {(candidate.dba_name || candidate.aliases.length > 0) && (
                                  <div className="review-candidate-aliases">
                                    {candidate.dba_name && <span>DBA: {candidate.dba_name}</span>}
                                    {candidate.aliases.length > 0 && (
                                      <span>Aliases: {candidate.aliases.join(', ')}</span>
                                    )}
                                  </div>
                                )}

                                {candidate.plausibility_points.length > 0 && (
                                  <div className="review-candidate-points">
                                    <div className="review-candidate-points-title">Why this could be right</div>
                                    <ul>
                                      {candidate.plausibility_points.map((point) => (
                                        <li key={point}>{point}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {candidate.risk_points.length > 0 && (
                                  <div className="review-candidate-points review-candidate-points--risk">
                                    <div className="review-candidate-points-title">What makes it risky</div>
                                    <ul>
                                      {candidate.risk_points.map((point) => (
                                        <li key={point}>{point}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {isParentReviewCase(selectedCase) ? (
                      <div className="review-detail-section">
                        <div className="section-title">
                          <span className="section-title-text">Child Entities Using This Parent Label</span>
                          <span className="section-hint">{selectedCase.sources.length} supporting records</span>
                        </div>
                        <div className="review-support-grid">
                          {visibleParentChildGroups.map((group) => (
                            <article key={group.child_entity_key} className="review-support-card">
                              <div className="review-support-head">
                                <div>
                                  <div className="review-support-title">{group.child_entity_name}</div>
                                  <div className="review-support-meta">
                                    {group.row_count} record{group.row_count !== 1 ? 's' : ''} · {group.source_modules.join(', ')}
                                  </div>
                                </div>
                                {group.example_sources[0] && (
                                  <button
                                    type="button"
                                    className="review-link-button review-link-button--inline"
                                    onClick={() => openSourceExampleByTraceId(group.example_sources[0].source_trace_id)}
                                  >
                                    Open example
                                  </button>
                                )}
                              </div>
                              {group.example_sources.length > 0 && (
                                <div className="review-support-snippet">
                                  Examples: {compactExamples(group.example_sources)}
                                </div>
                              )}
                              {group.hidden_source_count > 0 && (
                                <div className="review-support-more">
                                  +{group.hidden_source_count} more supporting record{group.hidden_source_count !== 1 ? 's' : ''}
                                </div>
                              )}
                            </article>
                          ))}
                        </div>
                        {parentChildGroups.length > 3 && (
                          <button
                            type="button"
                            className="review-link-button"
                            onClick={() => setShowAllChildGroups((current) => !current)}
                          >
                            {showAllChildGroups ? 'Show fewer child entities' : `Show all ${parentChildGroups.length} child entities`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="review-detail-section">
                        <div className="section-title">
                          <span className="section-title-text">Records in This Case</span>
                          <span className="section-hint">{selectedCase.sources.length} source records</span>
                        </div>
                        <div className="review-support-grid">
                          {visibleRecordGroups.map((group) => (
                            <article key={group.key} className="review-support-card">
                              <div className="review-support-head">
                                <div>
                                  <div className="review-support-title">{group.label}</div>
                                  <div className="review-support-meta">
                                    {group.rowCount} record{group.rowCount !== 1 ? 's' : ''} · {group.sourceModules.join(', ')}
                                  </div>
                                </div>
                                {group.examples[0] && (
                                  <button
                                    type="button"
                                    className="review-link-button review-link-button--inline"
                                    onClick={() => openSourceRecord(group.examples[0])}
                                  >
                                    Open example
                                  </button>
                                )}
                              </div>
                              {group.examples.length > 0 && (
                                <div className="review-support-snippet">
                                  Examples: {compactExamples(group.examples)}
                                </div>
                              )}
                              {group.hiddenCount > 0 && (
                                <div className="review-support-more">
                                  +{group.hiddenCount} more record{group.hiddenCount !== 1 ? 's' : ''}
                                </div>
                              )}
                            </article>
                          ))}
                        </div>
                        {recordGroups.length > 3 && (
                          <button
                            type="button"
                            className="review-link-button"
                            onClick={() => setShowAllRecordGroups((current) => !current)}
                          >
                            {showAllRecordGroups ? 'Show fewer record groups' : `Show all ${recordGroups.length} record groups`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="review-side-column">
                    <div className="review-detail-section review-decision-card">
                      <div className="section-title">
                        <span className="section-title-text">
                          {isParentReviewCase(selectedCase) ? 'Parent Decision' : 'Decision'}
                        </span>
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
                              || 'Choose what should happen when this record set is eventually published.'}
                          </span>
                        </label>

                        {requiresExistingMasterSelection && (
                          <div className="review-field">
                            <span className="review-field-label">
                              {isParentReviewCase(selectedCase) ? 'Choose Parent Entity' : 'Choose Existing Entity'}
                            </span>
                            <div className="review-field-hint">
                              Start with the candidate cards above. Search all existing entities only if none of them fit.
                            </div>
                            {hasChildSideCandidate && (
                              <div className="review-inline-note">
                                A candidate can also appear among the child entities below. Choose it if the parent label is meant to self-reference that same entity.
                              </div>
                            )}
                            <input
                              className="topbar-input review-input"
                              value={masterSearchInput}
                              onChange={(event) => setMasterSearchInput(event.target.value)}
                              disabled={isDecisionLocked(selectedCase)}
                              placeholder="search existing entities by name or URL"
                            />
                            {searchedMastersQuery.isFetching && (
                              <span className="review-field-hint">Searching existing entities…</span>
                            )}
                            {deferredMasterSearch.length >= 2 && filteredSearchedMasters.length > 0 && (
                              <div className="review-master-list review-master-list--search">
                                {filteredSearchedMasters.map((master) => (
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
                                Selected {selectedMaster.entity_name || selectedMaster.entity_id}
                              </span>
                            ) : targetEntityId ? (
                              <span className="review-field-hint">Selected target {targetEntityId}</span>
                            ) : null}
                          </div>
                        )}

                        <label className="review-field">
                          <span className="review-field-label">Reviewer Notes</span>
                          <textarea
                            className="review-textarea"
                            value={decisionReason}
                            onChange={(event) => setDecisionReason(event.target.value)}
                            disabled={isDecisionLocked(selectedCase)}
                            placeholder="why this is the safest decision"
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

                    {selectedCase.blocker_summaries.length > 0 && (
                      <div className="review-detail-section">
                        <div className="section-title">
                          <span className="section-title-text">Publish Blockers</span>
                        </div>
                        <div className="review-reason-list">
                          {selectedCase.blocker_summaries.map((blocker, index) => (
                            <article
                              key={`${selectedCase.case_id}-blocker-${index}`}
                              className={`review-reason-card ${toneClassName(blocker.tone)}`.trim()}
                            >
                              <div className="review-reason-title">{blocker.title}</div>
                              <div className="review-reason-detail">{blocker.detail}</div>
                              {blocker.next_step && (
                                <div className="review-reason-next-step">Next step: {blocker.next_step}</div>
                              )}
                            </article>
                          ))}
                        </div>
                      </div>
                    )}

                    <details className="review-collapsible">
                      <summary>Review history</summary>
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
                              {summarizeReviewEvent(event) && (
                                <div className="review-event-summary">{summarizeReviewEvent(event)}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </details>

                    <details className="review-collapsible">
                      <summary>Technical details</summary>
                      <div className="review-technical-panel">
                        <div className="review-technical-note">
                          Engineering details are available here for debugging. They are intentionally kept out of the main review flow.
                        </div>
                        <JsonHighlight data={selectedCase.technical_details} />
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
