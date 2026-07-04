import type {
  CandidateEvaluation,
  CostCallDetail,
  CostCallRow,
  CostCallType,
  CostSummary,
  IssueRecord,
  PaginatedCostCalls,
  RunSummary,
  SourceRecordDetail,
  TraceDetail,
  TraceSummary,
} from '../types';
import { INSIGHTS_API_BASE_URL, requestApiJson } from './http.ts';
import {
  candidateDispositionLabel,
  humanizeToken,
  normalizeSourceResolutionStatus,
  sourceResolutionLabel,
} from './sourceResolution.ts';

type InsightsRunListItem = {
  run_id: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApiJson<T>(INSIGHTS_API_BASE_URL, path, init);
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
    decided_review_case_count: readNumber(summary.decided_review_case_count),
    blocked_review_case_count: readNumber(summary.blocked_review_case_count),
    published_case_count: readNumber(summary.published_case_count),
    parent_source_count: readNumber(summary.parent_source_count),
    llm_call_count: readNumber(summary.llm_call_count),
    llm_total_tokens: readNumber(summary.llm_total_tokens),
    llm_estimated_cost_usd: readNumber(summary.llm_estimated_cost_usd),
    web_event_count: readNumber(summary.web_event_count),
    web_cache_hit_count: readNumber(summary.web_cache_hit_count),
    web_estimated_cost_usd: readNumber(summary.web_estimated_cost_usd),
    parent_processing_status: asNullableText(summary.parent_processing_status) ?? 'pending',
    parent_processing_deferred: Boolean(summary.parent_processing_deferred),
    deferred_parent_observation_count: readNumber(summary.deferred_parent_observation_count),
    issue_count: readNumber(summary.issue_count),
    issue_by_type: readObject(summary.issue_by_type) as Record<string, number>,
    issue_by_severity: readObject(summary.issue_by_severity) as Record<string, number>,
    issue_by_scope: readObject(summary.issue_by_scope) as Record<string, number>,
  };
}

export async function getTraces(params: {
  runId: string;
  module?: string;
  resolutionStatus?: string;
  decisionSource?: string;
  query?: string;
  hasIssues?: boolean;
  issueType?: string;
  inputScope?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}) {
  const limit = Math.max(1, params.limit ?? 50);
  const search = new URLSearchParams({
    limit: String(limit + 1),
    offset: String(Math.max(0, params.offset ?? 0)),
  });
  if (params.inputScope) search.set('input_scope', params.inputScope);
  if (params.module) search.set('module', params.module);
  if (params.resolutionStatus) search.set('resolution_status', params.resolutionStatus);
  if (params.decisionSource) search.set('decision_source', params.decisionSource);
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.hasIssues != null) search.set('has_issues', String(params.hasIssues));

  const [records, issues] = await Promise.all([
    request<Array<Record<string, unknown>>>(
      `/runs/${encodeURIComponent(params.runId)}/sources?${search.toString()}`,
      { signal: params.signal },
    ),
    params.issueType
      ? request<IssueRecord[]>(
          `/runs/${encodeURIComponent(params.runId)}/issues?limit=5000`,
          { signal: params.signal },
        )
      : Promise.resolve([]),
  ]);
  const hasMore = records.length > limit;
  const issueIndex = params.issueType
    ? buildIssueIndex(issues)
    : new Map<string, IssueRecord[]>();

  let traces = records.slice(0, limit).map((record) =>
    mapSourceRecordListItem(record, issueIndex.get(String(record.source_trace_id || ''))),
  );

  if (params.issueType) {
    traces = traces.filter((trace) => trace.issue_types.includes(params.issueType || ''));
  }

  return { items: traces, hasMore };
}

export async function getTraceDetail(
  runId: string,
  sourceModule: string,
  sourceUniqueId: string,
  inputScope?: string,
  signal?: AbortSignal,
): Promise<TraceDetail> {
  const search = new URLSearchParams();
  if (inputScope) search.set('input_scope', inputScope);
  const suffix = search.size ? `?${search.toString()}` : '';
  const detail = await request<SourceRecordDetail>(
    `/runs/${encodeURIComponent(runId)}/sources/${encodeURIComponent(sourceModule)}/${encodeURIComponent(sourceUniqueId)}${suffix}`,
    { signal },
  );
  return mapSourceRecordDetail(detail);
}

export function getIssues(params: {
  runId: string;
  sourceTraceId?: string;
  componentKey?: string;
  issueType?: string;
  severity?: string;
  status?: string;
  inputScope?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params.sourceTraceId) search.set('source_trace_id', params.sourceTraceId);
  if (params.componentKey) search.set('component_key', params.componentKey);
  if (params.issueType) search.set('issue_type', params.issueType);
  if (params.severity) search.set('severity', params.severity);
  if (params.status) search.set('status', params.status);
  if (params.inputScope) search.set('input_scope', params.inputScope);
  if (params.limit) search.set('limit', String(params.limit));

  return request<IssueRecord[]>(
    `/runs/${encodeURIComponent(params.runId)}/issues${search.size ? `?${search.toString()}` : ''}`,
  ).then((issues) =>
    issues.map(mapIssueRecord).filter((item) => {
      if (params.issueType && item.issue_type !== params.issueType) return false;
      if (params.severity && item.severity !== params.severity) return false;
      if (params.status && item.status !== params.status) return false;
      return true;
    }),
  );
}

export function getCostSummary(runId: string): Promise<CostSummary> {
  return request<CostSummary>(`/runs/${encodeURIComponent(runId)}/cost/summary`).then(mapCostSummary);
}

export function getCostCalls(params: {
  runId: string;
  type?: CostCallType;
  sort?: string;
  agent?: string;
  provider?: string;
  model?: string;
  success?: 'all' | 'success' | 'failure';
  cacheSource?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedCostCalls> {
  return request<PaginatedCostCalls>(buildCostCallsPath(params)).then((page) => ({
    page: readNumber(page.page),
    page_size: readNumber(page.page_size),
    total: readNumber(page.total),
    items: readArray(page.items).map((item) => mapCostCallRow(readObject(item))),
  }));
}

export function getCostCallDetail(params: {
  runId: string;
  callType: 'llm' | 'web';
  id: number;
  includeDebug?: boolean;
}): Promise<CostCallDetail> {
  const search = new URLSearchParams();
  if (params.includeDebug) search.set('include_debug', 'true');
  const suffix = search.size ? `?${search.toString()}` : '';
  return request<CostCallDetail>(
    `/runs/${encodeURIComponent(params.runId)}/cost/calls/${params.callType}/${params.id}${suffix}`,
  ).then((row) => mapCostCallDetail(readObject(row)));
}

export function buildCostCallsPath(params: {
  runId: string;
  type?: CostCallType;
  sort?: string;
  agent?: string;
  provider?: string;
  model?: string;
  success?: 'all' | 'success' | 'failure';
  cacheSource?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  search.set('type', params.type ?? 'all');
  search.set('sort', params.sort ?? 'created_desc');
  search.set('page', String(params.page ?? 1));
  search.set('page_size', String(params.pageSize ?? 20));
  if (params.agent) search.set('agent', params.agent);
  if (params.provider) search.set('provider', params.provider);
  if (params.model) search.set('model', params.model);
  if (params.cacheSource) search.set('cache_source', params.cacheSource);
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.success === 'success') search.set('success', 'true');
  if (params.success === 'failure') search.set('success', 'false');
  return `/runs/${encodeURIComponent(params.runId)}/cost/calls?${search.toString()}`;
}

function mapSourceRecordListItem(
  item: Record<string, unknown>,
  issues?: IssueRecord[],
): TraceSummary {
  const issueItems = issues ?? [];
  const resolutionStatus =
    normalizeSourceResolutionStatus(asNullableText(item.resolution_status))
    ?? asNullableText(item.resolution_status);
  const derivedEnrichment = readObject(item.derived_enrichment);
  const sourcePayload = readObject(item.source);
  const resolutionPayload = readObject(item.resolution_payload);
  const sourceEntityName = firstText(
    sourcePayload.entity_name,
    sourcePayload.otherNames_legalName,
    sourcePayload.otherNames_dba,
    sourcePayload.entity_parentName,
    item.source_entity_name,
    item.entity_name,
    resolutionPayload.source_entity_name,
    resolutionPayload.entity_name,
    item.source_unique_id,
  );

  return {
    run_id: String(item.run_id || ''),
    source_trace_id: String(item.source_trace_id || ''),
    source_module: String(item.source_module || ''),
    source_unique_id: String(item.source_unique_id || ''),
    transaction_id: asNullableText(item.transaction_id),
    source_entity_name: sourceEntityName,
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
    issue_count: readNumber(item.issue_count),
    lineages_target_record_ids: Array.isArray(item.lineages_target_record_ids)
      ? item.lineages_target_record_ids.map((value) => String(value))
      : [],
    derived_enrichment: derivedEnrichment,
    updated_at: asNullableText(item.updated_at),
    decision_story: buildDecisionStory({ ...item, source_entity_name: sourceEntityName }),
    has_issues: issueItems.length > 0 || readNumber(item.issue_count) > 0,
    issue_types: uniqueStrings(issueItems.map((issue) => issue.issue_type)),
    issue_severity: highestSeverity(issueItems),
  };
}

function mapCostSummary(item: CostSummary): CostSummary {
  return {
    run_id: asText(item.run_id, ''),
    totals: {
      llm_call_count: readNumber(item.totals?.llm_call_count),
      llm_failure_count: readNumber(item.totals?.llm_failure_count),
      llm_uncaptured_cost_count: readNumber(item.totals?.llm_uncaptured_cost_count),
      llm_input_tokens: readNumber(item.totals?.llm_input_tokens),
      llm_output_tokens: readNumber(item.totals?.llm_output_tokens),
      llm_total_tokens: readNumber(item.totals?.llm_total_tokens),
      llm_estimated_cost_usd: readNumber(item.totals?.llm_estimated_cost_usd),
      web_event_count: readNumber(item.totals?.web_event_count),
      web_failure_count: readNumber(item.totals?.web_failure_count),
      web_uncaptured_cost_count: readNumber(item.totals?.web_uncaptured_cost_count),
      web_cache_hit_count: readNumber(item.totals?.web_cache_hit_count),
      web_estimated_cost_usd: readNumber(item.totals?.web_estimated_cost_usd),
      failed_call_count: readNumber(item.totals?.failed_call_count),
      uncaptured_cost_count: readNumber(item.totals?.uncaptured_cost_count),
      total_estimated_cost_usd: readNumber(item.totals?.total_estimated_cost_usd),
      web_cache_hit_rate: readNumber(item.totals?.web_cache_hit_rate),
    },
    top_agents: readArray(item.top_agents) as CostSummary['top_agents'],
    top_models: readArray(item.top_models) as CostSummary['top_models'],
    web_by_provider: readArray(item.web_by_provider) as CostSummary['web_by_provider'],
    top_expensive_calls: readArray(item.top_expensive_calls).map((row) => mapCostCallRow(readObject(row))),
  };
}

function mapCostCallDetail(item: Record<string, unknown>): CostCallDetail {
  return {
    ...mapCostCallRow(item),
    request_payload: readObject(item.request_payload),
    response_payload: readObject(item.response_payload),
    usage_payload: readObject(item.usage_payload),
    error_payload: readObject(item.error_payload),
  };
}

function mapCostCallRow(item: Record<string, unknown>): CostCallRow {
  return {
    call_type: asText(item.call_type, 'llm') === 'web' ? 'web' : 'llm',
    id: readNumber(item.id),
    run_id: asText(item.run_id, ''),
    capability: asNullableText(item.capability),
    agent_name: asNullableText(item.agent_name),
    provider: asNullableText(item.provider),
    model_name: asNullableText(item.model_name),
    success: Boolean(item.success),
    cost_usd: asNumber(item.cost_usd),
    input_tokens: asNumber(item.input_tokens),
    output_tokens: asNumber(item.output_tokens),
    total_tokens: asNumber(item.total_tokens),
    latency_ms: asNumber(item.latency_ms),
    source_trace_id: asNullableText(item.source_trace_id),
    evaluation_key: asNullableText(item.evaluation_key),
    agent_work_key: asNullableText(item.agent_work_key),
    cache_source: asNullableText(item.cache_source),
    cache_hit: Boolean(item.cache_hit),
    result_count: asNumber(item.result_count),
    has_ai_overview: Boolean(item.has_ai_overview),
    created_at: asNullableText(item.created_at),
    decision: asNullableText(item.decision),
    summary_text: asNullableText(item.summary_text),
    source_module: asNullableText(item.source_module),
    source_unique_id: asNullableText(item.source_unique_id),
    source_label: asNullableText(item.source_label),
    component_key: asNullableText(item.component_key),
    resolution_status: asNullableText(item.resolution_status),
  };
}

function mapSourceRecordDetail(detail: SourceRecordDetail): TraceDetail {
  const sourcePayload = readObject(detail.source);
  const rawSourcePayload = readObject(detail.raw_source);
  const currentSourcePayload = readObject(detail.current_source);
  const normalizedDetail: SourceRecordDetail = {
    ...detail,
    source: sourcePayload,
    raw_source: hasObjectEntries(rawSourcePayload) ? rawSourcePayload : sourcePayload,
    current_source: hasObjectEntries(currentSourcePayload) ? currentSourcePayload : sourcePayload,
    retrieval_summary: readObject(detail.retrieval_summary),
    retrieval_debug: readObject(detail.retrieval_debug || detail.retrieval_summary),
    evaluation_context: {
      source_url_at_evaluation: asNullableText(detail.evaluation_context?.source_url_at_evaluation),
      current_source_url: asNullableText(detail.evaluation_context?.current_source_url),
      raw_source_url: asNullableText(detail.evaluation_context?.raw_source_url),
      source_url_missing_at_evaluation: Boolean(detail.evaluation_context?.source_url_missing_at_evaluation),
      url_matching_skipped_reason: asNullableText(detail.evaluation_context?.url_matching_skipped_reason),
      created_entity_id_initial: asNullableText(detail.evaluation_context?.created_entity_id_initial),
      assigned_entity_id_final: asNullableText(detail.evaluation_context?.assigned_entity_id_final),
      changed_fields: readArray(detail.evaluation_context?.changed_fields).map((value) => String(value)),
      change_sources: Object.fromEntries(
        Object.entries(readObject(detail.evaluation_context?.change_sources)).map(([key, value]) => [
          key,
          readArray(value).map((item) => String(item)),
        ]),
      ),
    },
    resolution_timeline: readArray(detail.resolution_timeline).map((item) => {
      const row = readObject(item);
      return {
        event_type: asText(row.event_type, 'event'),
        summary: asText(row.summary, ''),
        occurred_at: asNullableText(row.occurred_at),
        payload: readObject(row.payload),
      };
    }),
    agent_activity: readArray(detail.agent_activity).map((item) => {
      const row = readObject(item);
      return {
        lane: asText(row.lane, 'agent'),
        scope: asText(row.scope, 'candidate_evaluation'),
        subject: readObject(row.subject),
        decision: asNullableText(row.decision),
        confidence: asNullableText(row.confidence),
        reason: asNullableText(row.reason),
        used_web_search: Boolean(row.used_web_search),
        raw_prompt_payload: readObject(row.raw_prompt_payload),
        raw_response_payload: readObject(row.raw_response_payload),
        occurred_at: asNullableText(row.occurred_at),
      };
    }),
    candidate_evaluations: buildCandidateEvaluations(detail.candidate_evaluations),
    issues: readArray(detail.issues).map((item) => mapIssueRecord(item as IssueRecord)),
    transaction_context: readObject(detail.transaction_context),
  };

  const summary = mapSourceRecordListItem(
    normalizedDetail as unknown as Record<string, unknown>,
    normalizedDetail.issues,
  );
  return {
    ...normalizedDetail,
    ...summary,
  };
}

function buildCandidateEvaluations(
  items: CandidateEvaluation[],
): CandidateEvaluation[] {
  return [...items].map((item) => {
    const row = item as unknown as Record<string, unknown>;
    const evaluationStatus = asText(item.evaluation_status, 'unknown');
    const finalStatus = firstText(
      item.final_candidate_status,
      row.final_status,
      row.candidate_status,
      evaluationStatus,
    );
    return {
      ...item,
      candidate_entity_id: asText(
        item.candidate_entity_id
          || row.target_entity_id
          || row.target_node_id,
        'unknown',
      ),
      candidate_entity_name: firstNullableText(
        item.candidate_entity_name,
        row.matched_target_name,
        row.target_entity_name,
        row.target_name,
      ),
      evaluation_status: evaluationStatus,
      final_candidate_status: finalStatus,
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
      updated_at: asNullableText(item.updated_at),
    };
  });
}

function buildIssueIndex(issues: IssueRecord[]) {
  const index = new Map<string, IssueRecord[]>();
  for (const issue of issues.map(mapIssueRecord)) {
    const key = issue.source_trace_id;
    if (!key) continue;
    const bucket = index.get(key);
    if (bucket) bucket.push(issue);
    else index.set(key, [issue]);
  }
  return index;
}

function mapIssueRecord(item: IssueRecord): IssueRecord {
  const payload = readObject(item.issue_payload);
  return {
    ...item,
    id: readNumber(item.id),
    run_id: asText(item.run_id, ''),
    input_scope: asNullableText(item.input_scope) ?? undefined,
    issue_key: asNullableText(item.issue_key) ?? undefined,
    source_trace_id: asNullableText(item.source_trace_id),
    source_module: asNullableText(item.source_module),
    source_unique_id: asNullableText(item.source_unique_id),
    component_key: asNullableText(item.component_key),
    evaluation_key: asNullableText(item.evaluation_key),
    assigned_entity_id: asNullableText(item.assigned_entity_id),
    issue_type: asText(item.issue_type, 'unknown'),
    severity: asText(item.severity, 'medium') as IssueRecord['severity'],
    status: asText(item.status, 'open'),
    reason: asText(item.reason, 'No issue reason provided.'),
    issue_scope: asNullableText(item.issue_scope) ?? undefined,
    display_name: asNullableText(item.display_name) ?? asNullableText(payload.display_name) ?? undefined,
    plain_meaning: asNullableText(item.plain_meaning) ?? asNullableText(payload.plain_meaning) ?? undefined,
    operator_signal: asNullableText(item.operator_signal) ?? asNullableText(payload.operator_signal) ?? undefined,
    source_entity_name: asNullableText(item.source_entity_name) ?? asNullableText(payload.source_entity_name),
    group_key: asNullableText(item.group_key) ?? asNullableText(payload.group_key),
    review_case_id: asNullableText(item.review_case_id),
    issue_payload: payload,
    created_at: asText(item.created_at, ''),
    updated_at: asNullableText(item.updated_at),
  };
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
  if (readNumber(item.issue_count) > 0) {
    parts.push(`${readNumber(item.issue_count)} issue signals were recorded.`);
  }
  return parts.join(' ');
}

function highestSeverity(issues: IssueRecord[]) {
  const order = ['low', 'medium', 'high', 'critical'];
  let best: string | null = null;
  for (const issue of issues) {
    const current = issue.severity;
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

function hasObjectEntries(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asNullableText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function firstText(...values: unknown[]) {
  return firstNullableText(...values) ?? '—';
}

function firstNullableText(...values: unknown[]) {
  for (const value of values) {
    const text = asNullableText(value);
    if (text) return text;
  }
  return null;
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
