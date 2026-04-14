import type {
  AnomalyRecord,
  CandidateEvaluation,
  RunSummary,
  SourceRecordDetail as InsightsSourceRecordDetail,
  TraceDetail,
  TraceSummary,
} from '../types';

const INSIGHTS_API_BASE_URL =
  import.meta.env.VITE_INSIGHTS_API_BASE_URL || 'http://localhost:5003/api/v1';

type InsightsRunListItem = {
  run_id: string;
};

type InsightsRunSummaryPayload = {
  source_record_count?: number;
  anomaly_total?: number;
  anomaly_by_type?: Record<string, number>;
  anomaly_by_severity?: Record<string, number>;
  open_review_case_count?: number;
  reviewed_unpublished_case_count?: number;
  publish_blocked_case_count?: number;
  publish_failed_case_count?: number;
  published_case_count?: number;
  parent_processing_status?: string;
  parent_processing_deferred?: boolean;
  deferred_parent_observation_count?: number;
  result?: Record<string, unknown>;
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
  const summary = await request<InsightsRunSummaryPayload>(
    `/runs/${encodeURIComponent(runId)}/summary`,
  );
  const result = summary.result ?? {};
  const totalTraces = Number(summary.source_record_count ?? 0);
  const matchedCount = readNumber(
    result.matched_existing_entity_count,
    result.reused_entity_count,
    result.matched_count,
  );
  const newEntityCount = readNumber(
    result.created_entity_count,
    result.new_entity_count,
  );
  const noMatchCount = Math.max(
    0,
    readNumber(
      result.no_match_count,
      totalTraces - matchedCount - newEntityCount,
    ),
  );

  return {
    total_traces: totalTraces,
    matched_count: matchedCount,
    new_entity_count: newEntityCount,
    no_match_count: noMatchCount,
    open_review_case_count: readNumber(summary.open_review_case_count),
    reviewed_unpublished_case_count: readNumber(summary.reviewed_unpublished_case_count),
    publish_blocked_case_count: readNumber(summary.publish_blocked_case_count),
    publish_failed_case_count: readNumber(summary.publish_failed_case_count),
    published_case_count: readNumber(summary.published_case_count),
    parent_processing_status: typeof summary.parent_processing_status === 'string'
      ? summary.parent_processing_status
      : 'pending',
    parent_processing_deferred: Boolean(summary.parent_processing_deferred),
    deferred_parent_observation_count: readNumber(summary.deferred_parent_observation_count),
    anomaly_total: Number(summary.anomaly_total ?? 0),
    anomaly_by_type: summary.anomaly_by_type ?? {},
    anomaly_by_severity: summary.anomaly_by_severity ?? {},
    unexpected_phase_winner: readNumber(result.unexpected_phase_winner),
    url_blocked_good_match: readNumber(result.url_blocked_good_match),
    no_match_with_good_candidates: readNumber(result.no_match_with_good_candidates),
    multiple_master_duplicates: readNumber(result.multiple_master_duplicates),
    embedding_override_exact_url: readNumber(result.embedding_override_exact_url),
    cross_url_winner: readNumber(result.cross_url_winner),
    context_winner: readNumber(result.context_winner),
    tie_in_ranking: readNumber(result.tie_in_ranking),
    master_id_inconsistency: readNumber(result.master_id_inconsistency),
  };
}

export async function getTraces(params: {
  runId: string;
  module?: string;
  finalStatus?: string;
  winnerOrigin?: string;
  query?: string;
  hasAnomalies?: boolean;
  anomalyType?: string;
}) {
  const search = new URLSearchParams({ limit: '500', offset: '0' });
  if (params.module) search.set('module', params.module);
  if (params.finalStatus) search.set('final_status', params.finalStatus);
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

  if (params.winnerOrigin) {
    traces = traces.filter((trace) => trace.winner_origin === params.winnerOrigin);
  }
  if (params.anomalyType) {
    traces = traces.filter((trace) => trace.anomaly_types?.includes(params.anomalyType || ''));
  }

  return traces;
}

export async function getTraceDetail(
  runId: string,
  sourceModule: string,
  sourceUniqueId: string,
): Promise<TraceDetail> {
  const detail = await request<InsightsSourceRecordDetail>(
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
  return {
    run_id: String(item.run_id || ''),
    source_trace_id: String(item.source_trace_id || ''),
    source_module: String(item.source_module || ''),
    source_unique_id: String(item.source_unique_id || ''),
    source_entity_name: asText(item.source_entity_name, asText(item.source_unique_id)),
    source_member_name: asText(item.source_member_name),
    source_entity_role: asText(item.source_entity_role),
    search_stage: asNullableText(item.stage),
    final_status: asNullableText(item.final_status),
    winner_entity_id: asNullableText(item.assigned_entity_id),
    winner_entity_name: asNullableText(item.assigned_entity_name),
    winner_origin: asNullableText(item.assignment_kind),
    candidate_count: readNumber(item.candidate_count),
    matched_candidate_count: readNumber(item.matched_candidate_count),
    decision_story: buildDecisionStory(item),
    pre_match_enrichment: readObject(item.graph_links).derived_enrichment as Record<string, unknown> | null | undefined,
    has_anomalies: anomalyItems.length > 0 || readNumber(item.anomaly_count) > 0,
    anomaly_count: anomalyItems.length || readNumber(item.anomaly_count),
    anomaly_types: uniqueStrings(anomalyItems.map((anomaly) => anomaly.anomaly_type)),
    anomaly_severity: highestSeverity(anomalyItems),
  };
}

function mapSourceRecordDetail(detail: InsightsSourceRecordDetail): TraceDetail {
  const summary = mapSourceRecordListItem(detail, detail.anomalies);
  const candidateResults = buildCandidateEvaluations(detail);
  const searches =
    Array.isArray(detail.searches) && detail.searches.length > 0
      ? detail.searches
      : buildSyntheticSearches(candidateResults);
  const outcomeConfidence =
    asNumber(detail.assignment?.confidence)
    ?? asNumber(detail.assignment?.score)
    ?? bestCandidateScore(candidateResults);

  return {
    ...summary,
    trace_payload: {
      source_entity: detail.source ?? {},
      searches,
      final_outcome: {
        status: detail.final_status,
        method: detail.assignment?.method ?? detail.assignment_kind ?? detail.stage ?? null,
        confidence: outcomeConfidence,
        cluster_id: detail.cluster_id ?? detail.assignment?.cluster_id ?? null,
        assigned_entity_id: detail.assigned_entity_id ?? detail.assignment?.assigned_entity_id ?? null,
      },
      pre_match_enrichment: detail.derived_enrichment ?? {},
    },
    ranked_candidate_results: candidateResults,
    graph: { nodes: [], edges: [] },
    anomalies: detail.anomalies ?? [],
    anomaly_count: detail.anomaly_count ?? detail.anomalies.length,
  };
}

function buildCandidateEvaluations(detail: InsightsSourceRecordDetail): CandidateEvaluation[] {
  const sorted = [...detail.edge_details]
    .filter((edge) => edge.edge_kind === 'peer' || edge.edge_kind === 'to_master')
    .sort((left, right) => {
      const scoreDelta = (asNumber(right.score) ?? -1) - (asNumber(left.score) ?? -1);
      if (scoreDelta !== 0) return scoreDelta;
      return rankOutcome(right.status) - rankOutcome(left.status);
    });

  return sorted.map((edge, index) => {
    const targetMaster = edge.target_master;
    const targetSource = edge.target_source_record;
    const candidateId =
      targetMaster?.entity_id
      || targetSource?.source_trace_id
      || edge.target_id;
    const candidateName =
      targetMaster?.entity_name
      || targetSource?.source_entity_name
      || targetSource?.source_unique_id
      || edge.target_id;
    const score = asNumber(edge.score);
    const rankKey = score == null ? undefined : [Math.max(0, 1000 - Math.round(score * 1000)), index];

    return {
      search_kind: edge.match_phase || edge.edge_kind || 'candidate_review',
      candidate_id: candidateId,
      candidate_name: candidateName || candidateId,
      candidate_url: targetMaster?.entity_url || '',
      is_match: edge.status === 'confirmed' || edge.status === 'resolved',
      match_phase: edge.match_phase || edge.edge_kind || 'candidate_review',
      match_type: edge.match_type || edge.edge_kind || 'candidate_review',
      name_match_type: undefined,
      url_status: edge.url_decision || edge.status || 'unknown',
      url_decision: edge.url_decision || edge.resolution_route || edge.status || 'unknown',
      source_field: undefined,
      target_field: undefined,
      matched_source_name: detail.source_entity_name || undefined,
      matched_target_name: candidateName || undefined,
      context_reason: edge.agent_reason || edge.blocked_reason || edge.resolution_route || undefined,
      rank_key: rankKey,
    };
  });
}

function buildSyntheticSearches(
  candidates: CandidateEvaluation[],
): Array<Record<string, unknown>> {
  const grouped = new Map<string, CandidateEvaluation[]>();
  for (const candidate of candidates) {
    const key = candidate.search_kind || 'candidate_review';
    const bucket = grouped.get(key);
    if (bucket) bucket.push(candidate);
    else grouped.set(key, [candidate]);
  }

  const searches = Array.from(grouped.entries()).map(([searchKind, rows]) => ({
    search_kind: searchKind,
    potential_candidates: rows.map((row) => ({
      candidate_id: row.candidate_id,
      candidate_name: row.candidate_name,
      candidate_url: row.candidate_url,
      is_match: row.is_match,
    })),
    redis_query: null,
  }));

  if (searches.length > 0) {
    return searches;
  }

  return [];
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
  const finalStatus = asText(item.final_status, 'unknown');
  const parts = [entity, 'ended as', finalStatus + '.'];
  if (item.cluster_id) {
    parts.push(`Match group ${item.cluster_id} was selected.`);
  }
  if (item.assigned_entity_id) {
    parts.push(`Assigned entity is ${item.assigned_entity_id}.`);
  }
  if (readNumber(item.anomaly_count) > 0) {
    parts.push(`${readNumber(item.anomaly_count)} anomalies were recorded.`);
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

function rankOutcome(status: string | null | undefined) {
  switch ((status || '').toLowerCase()) {
    case 'confirmed':
      return 4;
    case 'resolved':
      return 3;
    case 'blocked':
      return 2;
    case 'rejected':
      return 1;
    default:
      return 0;
  }
}

function bestCandidateScore(candidates: CandidateEvaluation[]) {
  const best = candidates[0]?.rank_key?.[0];
  if (best == null) return null;
  return Math.max(0, Math.min(1, 1 - best / 1000));
}
