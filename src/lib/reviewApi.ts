import type {
  ReviewCandidateSummary,
  ReviewCaseDetail,
  ReviewCaseListItem,
  ReviewDecisionPayload,
  ReviewEventView,
  ReviewPublishBatch,
  ReviewPublishResponse,
  RunPublishSummary,
} from '../types';
import {
  REVIEW_API_BASE_URL,
  requestApiJson,
} from './http.ts';

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  return requestApiJson<T>(baseUrl, path, init);
}

export function getReviewCases(params: {
  runId: string;
  reviewStatus?: string;
  publishStatus?: string;
}) {
  const search = new URLSearchParams();
  if (params.reviewStatus) search.set('review_status', params.reviewStatus);
  if (params.publishStatus) search.set('publish_status', params.publishStatus);
  const suffix = search.size ? `?${search.toString()}` : '';
  return request<ReviewCaseListItem[]>(
    REVIEW_API_BASE_URL,
    `/runs/${encodeURIComponent(params.runId)}/cases${suffix}`,
  ).then((rows) => rows.map(normalizeReviewCase));
}

export function getReviewCase(_runId: string, caseId: string) {
  return request<ReviewCaseDetail>(
    REVIEW_API_BASE_URL,
    `/cases/${encodeURIComponent(caseId)}`,
  ).then((row) => normalizeReviewCase(row) as ReviewCaseDetail);
}

export function saveReviewDecision(caseId: string, payload: ReviewDecisionPayload) {
  return request<{
    case_id: string;
    review_status: string;
    publish_status: string;
    decision: string;
    target_entity_id?: string | null;
    decision_summary?: string | null;
    reviewed_at?: string | null;
    idempotent: boolean;
  }>(
    REVIEW_API_BASE_URL,
    `/cases/${encodeURIComponent(caseId)}/decision`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function createReviewPublish(runId: string, caseIds: string[] = []) {
  return request<ReviewPublishResponse>(
    REVIEW_API_BASE_URL,
    '/publish-batches',
    {
      method: 'POST',
      body: JSON.stringify({ run_id: runId, case_ids: caseIds }),
    },
  );
}

export function getReviewPublish(publishId: string) {
  return request<ReviewPublishBatch>(
    REVIEW_API_BASE_URL,
    `/publish-batches/${encodeURIComponent(publishId)}`,
  );
}

export function getRunPublishSummary(runId: string) {
  return request<RunPublishSummary>(
    REVIEW_API_BASE_URL,
    `/runs/${encodeURIComponent(runId)}/publish-summary`,
  );
}

function normalizeCandidateSummary(candidate: ReviewCandidateSummary): ReviewCandidateSummary {
  return {
    ...candidate,
    aliases: candidate.aliases ?? [],
    plausibility_points: candidate.plausibility_points ?? [],
    risk_points: candidate.risk_points ?? [],
    evaluation_payload: candidate.evaluation_payload ?? {},
  };
}

function normalizeReviewEvent(event: ReviewEventView): ReviewEventView {
  return {
    ...event,
    payload: event.payload ?? {},
  };
}

function normalizeReviewCase<T extends ReviewCaseListItem | ReviewCaseDetail>(row: T): T {
  const derivedPhase =
    row.phase
    || ((row.input_scope === 'parent' || row.case_type === 'parent_unresolved')
      ? 'parent_processing'
      : 'graph_resolution');
  return {
    ...row,
    phase: derivedPhase,
    review_status: row.review_status || 'open',
    publish_status: row.publish_status || 'pending',
    case_payload: row.case_payload ?? {},
    decision_payload: row.decision_payload ?? {},
    decision_basis_payload: row.decision_basis_payload ?? {},
    publish_payload: row.publish_payload ?? {},
    candidate_entity_ids: row.candidate_entity_ids ?? [],
    issue_keys: row.issue_keys ?? [],
    publish_blockers: row.publish_blockers ?? [],
    supporting_child_groups: row.supporting_child_groups ?? [],
    candidate_summaries: (row.candidate_summaries ?? []).map(normalizeCandidateSummary),
    unsafe_candidate_ids: row.unsafe_candidate_ids ?? [],
    suggested_review_checks: row.suggested_review_checks ?? [],
    evidence_highlights: row.evidence_highlights ?? [],
    blocker_summaries: row.blocker_summaries ?? [],
    technical_details: row.technical_details ?? {},
    error_payload: row.error_payload ?? {},
    sources: ('sources' in row ? row.sources : undefined) ?? [],
    events: ('events' in row ? row.events : undefined)?.map(normalizeReviewEvent) ?? [],
  };
}
