import type {
  AnomalyRecord,
  CandidateEvaluation,
  RunSummary,
  SourceRecordDetail,
  TraceDetail,
  TraceSummary,
} from '../types';
import {
  candidateDispositionLabel,
  humanizeToken,
  normalizeSourceResolutionStatus,
  sourceResolutionLabel,
} from './sourceResolution';

const INSIGHTS_API_BASE_URL =
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {})
    .VITE_INSIGHTS_API_BASE_URL || 'http://localhost:5003/api/v1';

type InsightsRunListItem = {
  run_id: string;
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${INSIGHTS_API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const payload = await response.json();
  return payload.data as T;
}

export async function getRuns() {
  const runs = await request<InsightsRunListItem[]>('/runs');
  return runs.map((run) => run.run_id);
}

export async function getRunSummary(runId: string): Promise<RunSummary> {
  const summary = await request<Record<string, unknown>>(
    `/runs/${encodeURIComponent(runId)}/summary`,
  );
  return {
    run_id: String(summary.run_id || runId),
    status: asNullableText(summary.status),
    processed_source_count: readNumber(summary.processed_source_count),
    resolved_existing_master_count: readNumber(summary.resolved_existing_master_count),
    created_new_master_count: readNumber(summary.created_new_master_count),
    pending_review_source_count: readNumber(summary.pending_review_source_count),
    candidate_evaluation_count: readNumber(summary.candidate_evaluation_count),
    deterministic_accept_count: readNumber(summary.deterministic_accept_count),
    deterministic_reject_count: readNumber(summary.deterministic_reject_count),
    url_agent_call_count: readNumber(summary.url_agent_call_count),
    context_agent_call_count: readNumber(summary.context_agent_call_count),
    open_review_case_count: readNumber(summary.open_review_case_count),
    reviewed_unpublished_case_count: readNumber(summary.reviewed_unpublished_case_count),
    publish_blocked_case_count: readNumber(summary.publish_blocked_case_count),
    publish_failed_case_count: readNumber(summary.publish_failed_case_count),
    published_case_count: readNumber(summary.published_case_count),
    parent_processing_status: asNullableText(summary.parent_processing_status) ?? 'pending',
    parent_processing_deferred: Boolean(summary.parent_processing_deferred),
    deferred_parent_observation_count: readNumber(summary.deferred_parent_observation_count),
    anomaly_total: readNumber(summary.anomaly_total),
    anomaly_by_type: readObject(summary.anomaly_by_type) as Record<string, number>,
    anomaly_by_severity: readObject(summary.anomaly_by_severity) as Record<string, number>,
  };
}

export async function getTraces(params: {
  runId: string;
  module?: string;
  resolutionStatus?: string;
  decisionSource?: string;
  query?: string;
  hasAnomalies?: boolean;
  anomalyType?: string;
}) {
  const search = new URLSearchParams({ limit: '500', offset: '0' });
  if (params.module) search.set('module', params.module);
  if (params.resolutionStatus) search.set('resolution_status', params.resolutionStatus);
  if (params.decisionSource) search.set('decision_source', params.decisionSource);
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.hasAnomalies != null) search.set('has_anomalies', String(params.hasAnomalies));

  const records = await request<Array<Record<string, unknown>>>(
    `/runs/${encodeURIComponent(params.runId)}/source-records?${search.toString()}`,
  );
  const anomalyIndex =
    params.anomalyType
      ? buildAnomalyIndex(
          await request<AnomalyRecord[]>(
            `/runs/${encodeURIComponent(params.runId)}/anomalies?limit=5000`,
          ),
        )
      : new Map<string, AnomalyRecord[]>();

  let traces = records.map((record) =>
    mapSourceRecordListItem(record, anomalyIndex.get(String(record.source_trace_id || ''))),
  );

  if (params.anomalyType) {
    traces = traces.filter((trace) => trace.anomaly_types.includes(params.anomalyType || ''));
  }

  return traces;
}

export async function getTraceDetail(
  runId: string,
  sourceModule: string,
  sourceUniqueId: string,
): Promise<TraceDetail> {
  const detail = await request<SourceRecordDetail>(
    `/runs/${encodeURIComponent(runId)}/source-records/${encodeURIComponent(sourceModule)}/${encodeURIComponent(sourceUniqueId)}?view=explorer`,
  );
  return mapSourceRecordDetail(detail);
}

export function getAnomalies(params: {
  runId: string;
  sourceModule?: string;
  sourceUniqueId?: string;
  anomalyType?: string;
  severity?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params.sourceModule) search.set('source_module', params.sourceModule);
  if (params.sourceUniqueId) search.set('source_unique_id', params.sourceUniqueId);
  if (params.limit) search.set('limit', String(params.limit));

  return request<AnomalyRecord[]>(
    `/runs/${encodeURIComponent(params.runId)}/anomalies${search.size ? `?${search.toString()}` : ''}`,
  ).then((anomalies) =>
    anomalies.filter((item) => {
      if (params.anomalyType && item.anomaly_type !== params.anomalyType) return false;
      if (params.severity && item.anomaly_severity !== params.severity) return false;
      return true;
    }),
  );
}

function mapSourceRecordListItem(
  item: Record<string, unknown>,
  anomalies?: AnomalyRecord[],
): TraceSummary {
  const anomalyItems = anomalies ?? [];
  const resolutionStatus =
    normalizeSourceResolutionStatus(asNullableText(item.resolution_status))
    ?? asNullableText(item.resolution_status);
  const derivedEnrichment = readObject(item.derived_enrichment);

  return {
    run_id: String(item.run_id || ''),
    source_trace_id: String(item.source_trace_id || ''),
    source_module: String(item.source_module || ''),
    source_unique_id: String(item.source_unique_id || ''),
    source_entity_name: asText(item.source_entity_name, asText(item.source_unique_id)),
    source_member_name: asNullableText(item.source_member_name),
    source_entity_role: asNullableText(item.source_entity_role),
    phase: asText(item.phase, 'main'),
    resolution_status: resolutionStatus,
    decision_source: asNullableText(item.decision_source),
    assigned_entity_id: asNullableText(item.assigned_entity_id),
    assigned_entity_name: asNullableText(item.assigned_entity_name),
    matched_master_id: asNullableText(item.matched_master_id),
    candidate_count: readNumber(item.candidate_count),
    viable_candidate_count: readNumber(item.viable_candidate_count),
    anomaly_count: readNumber(item.anomaly_count),
    lineages_target_record_ids: Array.isArray(item.lineages_target_record_ids)
      ? item.lineages_target_record_ids.map((value) => String(value))
      : [],
    derived_enrichment: derivedEnrichment,
    updated_at: asNullableText(item.updated_at),
    decision_story: buildDecisionStory(item),
    has_anomalies: anomalyItems.length > 0 || readNumber(item.anomaly_count) > 0,
    anomaly_types: uniqueStrings(anomalyItems.map((anomaly) => anomaly.anomaly_type)),
    anomaly_severity: highestSeverity(anomalyItems),
  };
}

function mapSourceRecordDetail(detail: SourceRecordDetail): TraceDetail {
  const summary = mapSourceRecordListItem(detail as unknown as Record<string, unknown>, detail.anomalies);
  return {
    ...detail,
    ...summary,
    candidate_evaluations: buildCandidateEvaluations(detail.candidate_evaluations),
  };
}

function buildCandidateEvaluations(
  items: CandidateEvaluation[],
): CandidateEvaluation[] {
  return [...items].map((item) => ({
    ...item,
    evaluation_status: asText(item.evaluation_status, 'unknown'),
    final_candidate_status: asText(item.final_candidate_status, 'unknown'),
    match_phase: asNullableText(item.match_phase),
    match_type: asNullableText(item.match_type),
    name_match_type: asNullableText(item.name_match_type),
    url_status: asNullableText(item.url_status),
    url_decision: asNullableText(item.url_decision),
    blocked_reason: asNullableText(item.blocked_reason),
    resolution_route: asNullableText(item.resolution_route),
    resolution_attempt_id: asNullableText(item.resolution_attempt_id),
    decision_source: asNullableText(item.decision_source),
    agent_lane: asNullableText(item.agent_lane),
    agent_decision: asNullableText(item.agent_decision),
    agent_confidence: asNullableText(item.agent_confidence),
    agent_reason: asNullableText(item.agent_reason),
    suppression_reason: asNullableText(item.suppression_reason),
    evaluation_payload: readObject(item.evaluation_payload),
  }));
}

function buildAnomalyIndex(anomalies: AnomalyRecord[]) {
  const index = new Map<string, AnomalyRecord[]>();
  for (const anomaly of anomalies) {
    const key = anomaly.source_trace_id;
    const bucket = index.get(key);
    if (bucket) bucket.push(anomaly);
    else index.set(key, [anomaly]);
  }
  return index;
}

function buildDecisionStory(item: Record<string, unknown>) {
  const entity = asText(item.source_entity_name, asText(item.source_unique_id, 'This record'));
  const resolutionStatus = sourceResolutionLabel(asNullableText(item.resolution_status));
  const parts = [`${entity} resolved as ${resolutionStatus}.`];
  if (item.assigned_entity_id) {
    parts.push(`Selected entity is ${item.assigned_entity_id}.`);
  }
  const decisionSource = asNullableText(item.decision_source);
  if (decisionSource) {
    parts.push(`Decision source: ${humanizeToken(decisionSource, 'unknown')}.`);
  }
  if (readNumber(item.anomaly_count) > 0) {
    parts.push(`${readNumber(item.anomaly_count)} anomaly signals were recorded.`);
  }
  return parts.join(' ');
}

function highestSeverity(anomalies: AnomalyRecord[]) {
  const order = ['low', 'medium', 'high', 'critical'] as const;
  let best: (typeof order)[number] | null = null;
  for (const anomaly of anomalies) {
    const current = anomaly.anomaly_severity;
    if (!order.includes(current)) continue;
    if (best == null || order.indexOf(current) > order.indexOf(best)) {
      best = current;
    }
  }
  return best;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function readObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asNullableText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readNumber(...values: unknown[]) {
  for (const value of values) {
    const number = asNumber(value);
    if (number != null) return number;
  }
  return 0;
}

export function candidateStatusText(candidate: CandidateEvaluation) {
  return candidateDispositionLabel(candidate.final_candidate_status || candidate.evaluation_status);
}
