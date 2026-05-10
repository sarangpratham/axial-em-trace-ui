import type {
  ReviewCaseDetail,
  ReviewCaseListItem,
  ReviewDecisionPayload,
  ReviewPublishBatch,
  ReviewPublishResponse,
  RunPublishSummary,
} from '../types';
import {
  INSIGHTS_API_BASE_URL,
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
    INSIGHTS_API_BASE_URL,
    `/runs/${encodeURIComponent(params.runId)}/review-cases${suffix}`,
  );
}

export function getReviewCase(runId: string, caseId: string) {
  return request<ReviewCaseDetail>(
    INSIGHTS_API_BASE_URL,
    `/runs/${encodeURIComponent(runId)}/review-cases/${encodeURIComponent(caseId)}`,
  );
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
    `/review-cases/${encodeURIComponent(caseId)}/decision`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function createReviewPublish(runId: string, caseIds: string[] = []) {
  return request<ReviewPublishResponse>(
    REVIEW_API_BASE_URL,
    '/review-publishes',
    {
      method: 'POST',
      body: JSON.stringify({ run_id: runId, case_ids: caseIds }),
    },
  );
}

export function getReviewPublish(publishId: string) {
  return request<ReviewPublishBatch>(
    REVIEW_API_BASE_URL,
    `/review-publishes/${encodeURIComponent(publishId)}`,
  );
}

export function getRunPublishSummary(runId: string) {
  return request<RunPublishSummary>(
    REVIEW_API_BASE_URL,
    `/runs/${encodeURIComponent(runId)}/publish-summary`,
  );
}
