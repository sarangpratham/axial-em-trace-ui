import type { Dispatch, SetStateAction } from 'react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { JsonHighlight } from '../JsonHighlight';
import { StatusBadge } from '../StatusBadge';
import type { TraceExplorerState } from '../../hooks/useTraceExplorerState';
import { getMasterEntity, searchMasterEntities } from '../../lib/insightsApi';
import { getTraceDetail } from '../../lib/api';
import { humanizeToken } from '../../lib/sourceResolution';
import type {
  CandidateEvaluation,
  MasterSearchResult,
  ReviewCandidateSummary,
  ReviewCaseDetail,
  ReviewCaseListItem,
  ReviewDecisionPayload,
  ReviewEventView,
  ReviewPublishBatch,
  ReviewPublishResponse,
  TraceDetail,
} from '../../types';

const REVIEW_TABS = [
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'ready', label: 'Decided / Pending Publish' },
  { key: 'blocked', label: 'Publish Blocked' },
  { key: 'failed', label: 'Publish Failed' },
  { key: 'published', label: 'Published' },
  { key: 'all', label: 'All Cases' },
] as const;

const DECISION_OPTIONS: Array<{
  value: ReviewDecisionPayload['decision_type'];
  label: string;
  hint: string;
}> = [
  {
    value: 'assign_existing_entity',
    label: 'Assign Existing Master',
    hint: 'Resolve these records to one existing entity.',
  },
  {
    value: 'create_new_entity',
    label: 'Create New Master',
    hint: 'Resolve these records as a brand-new entity during publish.',
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
      return 'master consolidation review';
    case 'issue_review':
      return 'issue review';
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

function readCaseText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function looksLikeIdentifier(value: string | null) {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.includes('::') || (/^[A-Za-z0-9_-]+$/.test(trimmed) && /\d/.test(trimmed));
}

function readEntityLabel(value: unknown) {
  const text = readCaseText(value);
  if (!text || looksLikeIdentifier(text)) return null;
  return text;
}

function requiresTargetEntityId(decision: string) {
  return decision === 'assign_existing_entity';
}

function canSelectForPublish(item: ReviewCaseListItem) {
  return (
    (item.input_scope ?? 'main') === 'main'
    && item.case_type !== 'parent_unresolved'
    && item.review_status === 'decided'
    && (item.publish_status === 'pending' || item.publish_status === 'failed')
  );
}

function isDecisionLocked(detail: ReviewCaseDetail | null | undefined) {
  if (!detail) return true;
  return detail.review_status === 'superseded' || detail.publish_status === 'published';
}

function formatCaseTitle(item: ReviewCaseListItem | ReviewCaseDetail | null | undefined) {
  if (!item) return 'No review case selected';
  const parentLabel = readEntityLabel(item.case_payload?.representative_parent_name) || readCaseText(item.case_payload?.representative_parent_name);
  if ((item.phase === 'parent_processing' || item.input_scope === 'parent' || item.case_type === 'parent_unresolved') && parentLabel) return parentLabel;

  const payloadLabel =
    readEntityLabel(item.case_payload?.representative_entity_name)
    || readEntityLabel(item.case_payload?.source_entity_name)
    || readEntityLabel(item.case_payload?.entity_name)
    || readEntityLabel(item.case_payload?.display_name)
    || readEntityLabel(item.case_payload?.representative_source_name);
  if (payloadLabel) return payloadLabel;

  if ('sources' in item) {
    const labelCounts = new Map<string, number>();
    for (const source of item.sources ?? []) {
      const label = readEntityLabel(source.source_entity_name);
      if (!label) continue;
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
    const sourceLabel = [...labelCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
    if (sourceLabel) return sourceLabel;
  }

  return 'Unnamed entity';
}

function isParentReviewCase(item: ReviewCaseListItem | ReviewCaseDetail | null | undefined) {
  return item?.phase === 'parent_processing'
    || item?.input_scope === 'parent'
    || item?.case_type === 'parent_unresolved';
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
        ? 'These overlapping entities were resolved at the row level, but they still look close enough that a human needs to decide whether to consolidate them for this run.'
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
        ? 'Decide whether these overlapping entities should be consolidated for this run or kept separate.'
        : 'Choose the safest outcome for this unresolved record set.');
}

function summarizeReviewEvent(event: ReviewEventView) {
  const payload = event.payload ?? {};
  const message =
    (typeof payload.message === 'string' && payload.message)
    || (typeof payload.reason === 'string' && payload.reason)
    || (typeof payload.decision_type === 'string' && payload.decision_type.split('_').join(' '))
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

function readNestedText(record: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function reviewPosture(detail: TraceDetail | undefined, selectedCase: ReviewCaseDetail | null | undefined) {
  if (!detail || !selectedCase) return null;
  const resolution = detail.resolution ?? {};
  const summaryPayload = detail.decision_summaries?.[0]?.summary_payload as Record<string, unknown> | undefined;
  const tieBreakOutcome = String(
    summaryPayload?.tie_break_outcome
    ?? resolution.tie_break_outcome
    ?? '',
  );
  const acceptedCount = detail.candidate_evaluations.filter((candidate) =>
    candidate.evaluation_status === 'deterministic_accept' || candidate.evaluation_status === 'agent_accept').length;

  if (selectedCase.case_type === 'bridge_ambiguous_family' || String(resolution.pending_review_reason || '').includes('bridge_ambiguous_family')) {
    return {
      title: 'Likely existing entity, but the correct existing master is ambiguous',
      tone: 'warning',
      detail: acceptedCount > 1
        ? `${acceptedCount} existing masters survived matching, so this looks more like an existing-entity ambiguity than a brand-new entity case.`
        : 'The system found evidence for an existing entity, but it could not safely pick one target master.',
      hint: tieBreakOutcome === 'both_same_identity'
        ? 'Some accepted candidates appear to describe the same underlying firm or family, which suggests duplicate-master or affiliate ambiguity.'
        : null,
    };
  }

  if (acceptedCount === 0) {
    return {
      title: 'No convincing existing entity match is visible yet',
      tone: 'info',
      detail: 'This case may need a new master unless additional context or search turns up a better existing candidate.',
      hint: null,
    };
  }

  return {
    title: acceptedCount === 1 ? 'One existing entity looks strongest' : 'Several existing entities look plausible',
    tone: acceptedCount === 1 ? 'positive' : 'warning',
    detail: acceptedCount === 1
      ? 'Start by validating the strongest existing candidate before considering a new entity.'
      : 'Start with the strongest existing candidates before considering a new entity.',
    hint: null,
  };
}

function rankReviewCandidates(candidates: CandidateEvaluation[]) {
  const score = (candidate: CandidateEvaluation) => {
    let total = 0;
    if (candidate.final_candidate_status === 'selected') total += 100;
    if (candidate.evaluation_status === 'deterministic_accept') total += 80;
    if (candidate.evaluation_status === 'agent_accept') total += 70;
    if (candidate.url_status === 'exact') total += 20;
    if (candidate.name_match_type === 'normalized_exact') total += 15;
    if (candidate.match_phase?.includes('phase2')) total += 5;
    if (candidate.blocked_reason) total -= 10;
    if (candidate.evaluation_status === 'deterministic_reject') total -= 50;
    return total;
  };

  return [...candidates]
    .filter((candidate) => candidate.candidate_entity_id)
    .sort((left, right) =>
      score(right) - score(left)
      || (right.updated_at || '').localeCompare(left.updated_at || '')
      || (left.candidate_entity_name || left.candidate_entity_id).localeCompare(
        right.candidate_entity_name || right.candidate_entity_id,
      ))
    .slice(0, 4);
}

function candidateReviewBullets(candidate: CandidateEvaluation) {
  const bullets: string[] = [];
  if (candidate.url_status === 'exact') bullets.push('official URL matches');
  else if (candidate.url_status) bullets.push(`URL status: ${humanizeToken(candidate.url_status)}`);
  if (candidate.name_match_type) bullets.push(`name match: ${humanizeToken(candidate.name_match_type)}`);
  if (candidate.match_phase) bullets.push(`match phase: ${humanizeToken(candidate.match_phase)}`);
  if (candidate.agent_reason) bullets.push(candidate.agent_reason);
  else if (candidate.blocked_reason) bullets.push(`blocked because ${humanizeToken(candidate.blocked_reason).toLowerCase()}`);
  return bullets.slice(0, 3);
}

function isAgentRelatedCandidateStatus(status?: string | null) {
  return status === 'agent_accept'
    || status === 'agent_reject'
    || status === 'agent_required'
    || status === 'agent_insufficient'
    || status === 'agent_prep_failed';
}

function hasAgentDetailsForEvaluation(candidate: CandidateEvaluation | ReviewCandidateSummary) {
  return isAgentRelatedCandidateStatus(
    'evaluation_status' in candidate ? candidate.evaluation_status : undefined,
  ) || Boolean(
    ('agent_reason' in candidate && candidate.agent_reason)
    || ('agent_lane' in candidate && candidate.agent_lane)
    || ('evaluation_payload' in candidate && candidate.evaluation_payload && Object.keys(candidate.evaluation_payload).length > 0),
  );
}

function candidateDisplayName(candidate: CandidateEvaluation | ReviewCandidateSummary) {
  return 'candidate_entity_id' in candidate
    ? candidate.candidate_entity_name || candidate.candidate_entity_id
    : candidate.entity_name || candidate.entity_id;
}

function sourceContextRows(detail: TraceDetail | undefined) {
  if (!detail) return [];
  const source = detail.source ?? {};
  const currentSource = detail.current_source ?? {};
  const resolution = detail.resolution ?? {};
  return [
    ['Source URL', detail.evaluation_context?.source_url_at_evaluation || readNestedText(source, ['entity_url', 'url'])],
    ['Role', detail.source_entity_role || readNestedText(source, ['entity_role', 'role'])],
    ['Member', detail.source_member_name || readNestedText(source, ['member_name', 'account_name', 'axial_member_name', 'axialMemberName'])],
    ['Transaction', readNestedText(currentSource, ['transaction_id', 'transactionId', 'transaction_name', 'axial_transaction_id', 'deal_name'])],
    ['Group key', readNestedText(resolution, ['resolution_group_key', 'raw_component_key'])],
  ].filter(([, value]) => Boolean(value));
}

function candidateNameIndex(candidates: CandidateEvaluation[]) {
  const byId = new Map<string, string>();
  for (const candidate of candidates) {
    if (candidate.candidate_entity_id && candidate.candidate_entity_name) {
      byId.set(candidate.candidate_entity_id, candidate.candidate_entity_name);
    }
  }
  return byId;
}

function rewriteCandidateLabels(
  text: string,
  summaryPayload: Record<string, unknown> | undefined,
  candidates: CandidateEvaluation[],
) {
  if (!text || !summaryPayload) return text;
  const mapping = summaryPayload.candidate_master_ids_by_label;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return text;
  const namesById = candidateNameIndex(candidates);
  let next = text;
  for (const [label, rawId] of Object.entries(mapping)) {
    const entityId = String(rawId || '').trim();
    if (!entityId) continue;
    const entityName = namesById.get(entityId) || entityId;
    next = next.split(label).join(`${entityName} (${entityId})`);
  }
  return next;
}

function conciseReviewNote(
  summaryPayload: Record<string, unknown> | undefined,
  candidates: CandidateEvaluation[],
) {
  if (!summaryPayload) return null;
  const outcome = String(summaryPayload.tie_break_outcome || '').trim();
  const reason = rewriteCandidateLabels(
    String(summaryPayload.tie_break_reason || ''),
    summaryPayload,
    candidates,
  ).trim();

  if (outcome === 'both_same_identity') {
    const exactUrlCandidates = candidates.filter((candidate) => candidate.url_status === 'exact');
    const names = Array.from(new Set(
      exactUrlCandidates
        .map((candidate) => candidate.candidate_entity_name || candidate.candidate_entity_id)
        .filter(Boolean),
    )).slice(0, 3);
    if (names.length > 0) {
      return `${names.join(', ')} appear to describe the same underlying firm, so the review is about choosing the right existing master rather than creating a new one.`;
    }
    return 'Multiple accepted candidates appear to describe the same underlying firm, so the review is about choosing the right existing master rather than creating a new one.';
  }

  if (!reason) return null;
  if (/Candidate [A-Z]/.test(reason)) return null;
  return reason;
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
  const decisionOptions = DECISION_OPTIONS;
  const [masterSearchInput, setMasterSearchInput] = useState('');
  const [showAllRecordGroups, setShowAllRecordGroups] = useState(false);
  const deferredMasterSearch = useDeferredValue(masterSearchInput.trim());
  const requiresExistingMasterSelection = requiresTargetEntityId(decision);
  const candidateEntityIds = selectedCase?.candidate_entity_ids ?? [];

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

  const parentSupportingCount = useMemo(
    () => {
      const payloadCount = Number(selectedCase?.case_payload?.supporting_record_count || 0);
      if (Number.isFinite(payloadCount) && payloadCount > 0) return payloadCount;
      return selectedCase?.sources.length ?? 0;
    },
    [selectedCase?.case_payload?.supporting_record_count, selectedCase?.sources.length],
  );

  const recordGroups = useMemo(
    () => buildRecordGroups(selectedCase?.sources ?? []),
    [selectedCase?.sources],
  );

  const visibleRecordGroups = showAllRecordGroups
    ? recordGroups
    : recordGroups.slice(0, 3);

  useEffect(() => {
    setShowAllRecordGroups(false);
  }, [selectedCaseId]);

  const representativeSource = useMemo(() => {
    if (!selectedCase?.sources?.length) return null;
    const matchingSource = selectedCase.sources.find(
      (source) => source.source_trace_id === selectedCase.representative_source_trace_id,
    );
    return matchingSource ?? selectedCase.sources[0] ?? null;
  }, [selectedCase]);

  const representativeTraceDetailQuery = useQuery({
    queryKey: ['review-representative-trace-detail', selectedRunId, representativeSource?.source_module, representativeSource?.source_unique_id, selectedCase?.input_scope],
    queryFn: () => getTraceDetail(
      selectedRunId!,
      representativeSource!.source_module,
      representativeSource!.source_unique_id,
      selectedCase?.input_scope || 'main',
    ),
    enabled: Boolean(selectedRunId && representativeSource?.source_module && representativeSource?.source_unique_id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const representativeTraceDetail = representativeTraceDetailQuery.data;
  const [historyEntityId, setHistoryEntityId] = useState('');
  const [agentDetailsTarget, setAgentDetailsTarget] = useState<CandidateEvaluation | ReviewCandidateSummary | null>(null);
  const topReviewCandidates = useMemo(
    () => rankReviewCandidates(representativeTraceDetail?.candidate_evaluations ?? []),
    [representativeTraceDetail?.candidate_evaluations],
  );
  const reviewerPosture = useMemo(
    () => reviewPosture(representativeTraceDetail, selectedCase),
    [representativeTraceDetail, selectedCase],
  );
  const contextRows = useMemo(
    () => sourceContextRows(representativeTraceDetail),
    [representativeTraceDetail],
  );
  const latestDecisionSummary = representativeTraceDetail?.decision_summaries?.[0] as Record<string, unknown> | undefined;
  const latestSummaryPayload = latestDecisionSummary?.summary_payload as Record<string, unknown> | undefined;
  const transactionParticipants = useMemo(
    () => (representativeTraceDetail?.transaction_context?.participants as Array<Record<string, unknown>> | undefined) ?? [],
    [representativeTraceDetail?.transaction_context],
  );
  const transactionId = useMemo(() => {
    const raw = representativeTraceDetail?.transaction_context?.transaction_id;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
  }, [representativeTraceDetail?.transaction_context]);
  const shortReviewNote = useMemo(
    () => conciseReviewNote(
      latestSummaryPayload,
      representativeTraceDetail?.candidate_evaluations ?? [],
    ),
    [latestSummaryPayload, representativeTraceDetail?.candidate_evaluations],
  );
  const masterHistoryQuery = useQuery({
    queryKey: ['review-master-history', historyEntityId],
    queryFn: () => getMasterEntity(historyEntityId),
    enabled: Boolean(historyEntityId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

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
      issue_count: source.issue_count ?? 0,
      lineages_target_record_ids: source.lineages_target_record_ids ?? [],
      derived_enrichment: source.derived_enrichment ?? {},
      updated_at: source.updated_at ?? null,
      decision_story: humanizeToken(source.resolution_status, 'pending review'),
      has_issues: (source.issue_count ?? 0) > 0,
      issue_types: [],
    });
    onSourceRecordSelected?.(source);
  };

  const handleSaveDecision = () => {
    if (!selectedCaseId || !decision) return;
    saveDecisionMutation.mutate({
      caseId: selectedCaseId,
      payload: {
        decision_type: decision as ReviewDecisionPayload['decision_type'],
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
              || (publishSummary?.decided_review_case_count ?? 0) === 0
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
                          {formatLabel(item.input_scope || 'main')} · {formatLabel(item.phase)} · {formatCaseType(item.case_type)} · {item.source_count} sources
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
                    {formatLabel(selectedCase.input_scope || 'main')} · {formatLabel(selectedCase.phase)} · {formatCaseType(selectedCase.case_type)}
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

                {!isParentReviewCase(selectedCase) && (
                  <div className="review-detail-section">
                    <div className="section-title">
                      <span className="section-title-text">Reviewer Summary</span>
                      {representativeTraceDetailQuery.isFetching && (
                        <span className="section-hint">Refreshing source evidence…</span>
                      )}
                    </div>
                    {representativeTraceDetailQuery.isLoading ? (
                      <div className="review-panel-empty review-panel-empty--compact">Loading source context…</div>
                    ) : representativeTraceDetailQuery.isError ? (
                      <div className="review-panel-empty review-panel-empty--compact">Source context could not be loaded for this review case.</div>
                    ) : representativeTraceDetail ? (
                      <div className="review-summary-panel">
                        {reviewerPosture && (
                          <div className="review-summary-line">
                            <span className="review-summary-label">System read</span>
                            <span className="review-summary-value">{reviewerPosture.title}</span>
                          </div>
                        )}
                        {shortReviewNote && (
                          <div className="review-summary-note">
                            {shortReviewNote}
                          </div>
                        )}
                        {reviewerPosture?.hint && (
                          <div className="review-summary-note">{reviewerPosture.hint}</div>
                        )}
                        {(transactionId || transactionParticipants.length > 0 || contextRows.length > 0) && (
                          <details className="review-collapsible review-collapsible--summary">
                            <summary>Transaction context</summary>
                            <div className="review-summary-context">
                              {contextRows.map(([label, value]) => (
                                <div key={label} className="review-summary-line">
                                  <span className="review-summary-label">{label}</span>
                                  <span className="review-summary-value">{value}</span>
                                </div>
                              ))}
                              {transactionId && (
                                <div className="review-summary-line">
                                  <span className="review-summary-label">Participants</span>
                                  <span className="review-summary-value">
                                    {transactionParticipants.length} entities in transaction {transactionId}
                                  </span>
                                </div>
                              )}
                              {transactionParticipants.length > 0 && (
                                <div className="ctable-wrap review-candidate-table-wrap">
                                  <table className="ctable review-candidate-table">
                                    <thead>
                                      <tr>
                                        <th>Entity</th>
                                        <th>Role</th>
                                        <th>Member</th>
                                        <th>URL</th>
                                        <th>Module</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {transactionParticipants.map((participant, index) => (
                                        <tr key={`${participant.source_module ?? 'source'}-${participant.source_unique_id ?? index}`}>
                                          <td>{String(participant.source_entity_name || participant.source_unique_id || '—')}</td>
                                          <td>{String(participant.source_entity_role || '—')}</td>
                                          <td>{String(participant.source_member_name || '—')}</td>
                                          <td>{String(participant.source_entity_url || '—')}</td>
                                          <td>{String(participant.source_module || '—')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

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
                        {parentSupportingCount || selectedCase.sources.length} supporting record{(parentSupportingCount || selectedCase.sources.length) !== 1 ? 's' : ''} reference this parent label.
                      </div>
                      {String(selectedCase.case_payload?.representative_parent_name || '').includes(',') && (
                        <div className="review-inline-warning">
                          This label appears to contain multiple parties, so a single-parent assignment may be unsafe.
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
                    {!isParentReviewCase(selectedCase) && topReviewCandidates.length > 0 && (
                      <div className="review-detail-section">
                        <div className="section-title">
                          <span className="section-title-text">Best Existing Candidates</span>
                          <span className="section-hint">
                            {representativeTraceDetail?.candidate_evaluations.length ?? 0} candidates evaluated
                          </span>
                        </div>
                        <div className="ctable-wrap review-candidate-table-wrap">
                          <table className="ctable review-candidate-table">
                            <thead>
                              <tr>
                                <th>Candidate</th>
                                <th>URL</th>
                                <th>Status</th>
                                <th>Evidence</th>
                                <th>History</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topReviewCandidates.map((candidate) => (
                                <tr key={`${candidate.candidate_entity_id}-${candidate.updated_at ?? ''}`}>
                                  <td>
                                    <div className="name-cell" title={candidate.candidate_entity_name || candidate.candidate_entity_id}>
                                      {candidate.candidate_entity_name || candidate.candidate_entity_id}
                                    </div>
                                    <div className="entity-id-cell">{candidate.candidate_entity_id}</div>
                                  </td>
                                  <td>{candidate.candidate_entity_url || '—'}</td>
                                  <td>
                                    <div>{humanizeToken(candidate.evaluation_status)}</div>
                                    {hasAgentDetailsForEvaluation(candidate) && (
                                      <button
                                        type="button"
                                        className="review-link-button review-link-button--inline"
                                        onClick={() => setAgentDetailsTarget(candidate)}
                                      >
                                        Agent details
                                      </button>
                                    )}
                                  </td>
                                  <td>{candidateReviewBullets(candidate).join(' · ') || '—'}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="review-link-button review-link-button--inline"
                                      onClick={() => setHistoryEntityId(candidate.candidate_entity_id)}
                                    >
                                      View history
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {isParentReviewCase(selectedCase) && selectedCase.candidate_summaries.length > 0 && (
                      <div className="review-detail-section">
                        <div className="section-title">
                          <span className="section-title-text">Possible Existing Master Entities</span>
                          <span className="section-hint">{selectedCase.candidate_summaries.length} candidates</span>
                        </div>
                        <div className="ctable-wrap review-candidate-table-wrap">
                          <table className="ctable review-candidate-table">
                            <thead>
                              <tr>
                                <th>Entity</th>
                                <th>URL</th>
                                <th>Status</th>
                                <th>Why it could match</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedCase.candidate_summaries.map((candidate) => {
                                return (
                                  <tr key={candidate.entity_id}>
                                    <td>
                                      <div className="name-cell" title={candidate.entity_name || candidate.entity_id}>
                                        {candidate.entity_name || candidate.entity_id}
                                      </div>
                                      <div className="entity-id-cell">{candidate.entity_id}</div>
                                    </td>
                                    <td>{candidate.entity_url || '—'}</td>
                                    <td>
                                      <div>{candidate.status_label || humanizeToken(candidate.tone, 'candidate')}</div>
                                      {hasAgentDetailsForEvaluation(candidate) && (
                                        <button
                                          type="button"
                                          className="review-link-button review-link-button--inline"
                                          onClick={() => setAgentDetailsTarget(candidate)}
                                        >
                                          Agent details
                                        </button>
                                      )}
                                    </td>
                                    <td>{candidate.plausibility_points.join(' · ') || '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {!isParentReviewCase(selectedCase) && selectedCase.candidate_summaries.length > 0 && topReviewCandidates.length === 0 && (
                      <div className="review-detail-section">
                        <div className="section-title">
                          <span className="section-title-text">
                            Possible Existing Entities
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

                    {isParentReviewCase(selectedCase) ? null : (
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
                            {decisionOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <span className="review-field-hint">
                            {decisionOptions.find((option) => option.value === decision)?.hint
                              || 'Choose what should happen when this record set is eventually published.'}
                          </span>
                        </label>

                        {requiresExistingMasterSelection && (
                          <div className="review-field">
                            <span className="review-field-label">
                              {isParentReviewCase(selectedCase)
                                ? 'Choose Parent Entity'
                                : 'Choose Existing Entity'}
                            </span>
                            <div className="review-field-hint">
                              Start with the listed candidates above. Search all existing entities only if none of them fit.
                            </div>
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

              {historyEntityId && (
                <div className="review-modal-backdrop" onClick={() => setHistoryEntityId('')}>
                  <div className="review-modal" onClick={(event) => event.stopPropagation()}>
                    <div className="review-modal-head">
                      <div>
                        <div className="section-title-text">Master History</div>
                        <div className="review-field-hint">
                          {masterHistoryQuery.data?.entity_name || historyEntityId}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="review-link-button review-link-button--inline"
                        onClick={() => setHistoryEntityId('')}
                      >
                        Close
                      </button>
                    </div>
                    {masterHistoryQuery.isLoading ? (
                      <div className="review-panel-empty review-panel-empty--compact">Loading historical context…</div>
                    ) : masterHistoryQuery.isError ? (
                      <div className="review-panel-empty review-panel-empty--compact">Historical context could not be loaded.</div>
                    ) : (
                      <div className="review-modal-body">
                        <div className="review-summary-line">
                          <span className="review-summary-label">Master</span>
                          <span className="review-summary-value">
                            {masterHistoryQuery.data?.entity_name || historyEntityId}
                          </span>
                        </div>
                        <div className="review-summary-line">
                          <span className="review-summary-label">URL</span>
                          <span className="review-summary-value">
                            {masterHistoryQuery.data?.entity_url || '—'}
                          </span>
                        </div>
                        {(masterHistoryQuery.data?.historical_transaction_context ?? []).length === 0 ? (
                          <div className="review-panel-empty review-panel-empty--compact">
                            No historical transaction context is available yet for this master.
                          </div>
                        ) : (
                          (masterHistoryQuery.data?.historical_transaction_context ?? []).map((group, index) => (
                            <details key={`${group.run_id}-${group.transaction_id}-${index}`} className="review-collapsible" open={index === 0}>
                              <summary>
                                {group.transaction_id} · {group.participant_count} participants · run {group.run_id}
                              </summary>
                              <div className="review-summary-context">
                                <div className="ctable-wrap review-candidate-table-wrap">
                                  <table className="ctable review-candidate-table">
                                    <thead>
                                      <tr>
                                        <th>Entity</th>
                                        <th>Role</th>
                                        <th>Member</th>
                                        <th>URL</th>
                                        <th>Module</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.participants.map((participant, participantIndex) => (
                                        <tr key={`${participant.source_module}-${participant.source_unique_id}-${participantIndex}`}>
                                          <td>{participant.source_entity_name || participant.source_unique_id || '—'}</td>
                                          <td>{participant.source_entity_role || '—'}</td>
                                          <td>{participant.source_member_name || '—'}</td>
                                          <td>{participant.source_entity_url || '—'}</td>
                                          <td>{participant.source_module || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </details>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {agentDetailsTarget && (
                <div className="review-modal-backdrop" onClick={() => setAgentDetailsTarget(null)}>
                  <div className="review-modal" onClick={(event) => event.stopPropagation()}>
                    <div className="review-modal-head">
                      <div>
                        <div className="section-title-text">Agent Details</div>
                        <div className="review-field-hint">
                          {candidateDisplayName(agentDetailsTarget)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="review-link-button review-link-button--inline"
                        onClick={() => setAgentDetailsTarget(null)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="review-modal-body">
                      <div className="review-summary-line">
                        <span className="review-summary-label">Status</span>
                        <span className="review-summary-value">
                          {'evaluation_status' in agentDetailsTarget
                            ? humanizeToken(agentDetailsTarget.evaluation_status, 'agent')
                            : '—'}
                        </span>
                      </div>
                      <div className="review-summary-line">
                        <span className="review-summary-label">Agent kind</span>
                        <span className="review-summary-value">
                          {'agent_lane' in agentDetailsTarget
                            ? humanizeToken(agentDetailsTarget.agent_lane, 'unknown')
                            : 'unknown'}
                        </span>
                      </div>
                      {'agent_decision' in agentDetailsTarget && agentDetailsTarget.agent_decision && (
                        <div className="review-summary-line">
                          <span className="review-summary-label">Agent decision</span>
                          <span className="review-summary-value">{humanizeToken(agentDetailsTarget.agent_decision)}</span>
                        </div>
                      )}
                      {'agent_confidence' in agentDetailsTarget && agentDetailsTarget.agent_confidence && (
                        <div className="review-summary-line">
                          <span className="review-summary-label">Confidence</span>
                          <span className="review-summary-value">{humanizeToken(agentDetailsTarget.agent_confidence)}</span>
                        </div>
                      )}
                      {'agent_reason' in agentDetailsTarget && agentDetailsTarget.agent_reason && (
                        <div className="review-summary-note">{agentDetailsTarget.agent_reason}</div>
                      )}
                      {'evaluation_payload' in agentDetailsTarget && agentDetailsTarget.evaluation_payload && Object.keys(agentDetailsTarget.evaluation_payload).length > 0 ? (
                        <details className="review-collapsible" open>
                          <summary>Agent request and response payload</summary>
                          <div className="review-technical-panel">
                            <JsonHighlight data={agentDetailsTarget.evaluation_payload} />
                          </div>
                        </details>
                      ) : (
                        <div className="review-panel-empty review-panel-empty--compact">
                          No stored agent payload is available for this candidate.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
