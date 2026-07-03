export type SourceResolutionStatus =
  | 'assigned_existing_master'
  | 'created_new_master'
  | 'needs_review_multi_master'
  | 'unresolved';

export type AuthenticatedUser = {
  id: number;
  email: string;
};

export type RunSummary = {
  run_id: string;
  status?: string | null;
  processed_source_count: number;
  resolved_existing_master_count: number;
  created_new_master_count: number;
  pending_review_source_count: number;
  candidate_evaluation_count: number;
  deterministic_accept_count: number;
  deterministic_reject_count: number;
  url_agent_call_count: number;
  context_agent_call_count: number;
  open_review_case_count?: number;
  decided_review_case_count?: number;
  blocked_review_case_count?: number;
  published_case_count?: number;
  parent_source_count?: number;
  llm_call_count?: number;
  llm_total_tokens?: number;
  llm_estimated_cost_usd?: number;
  web_event_count?: number;
  web_cache_hit_count?: number;
  web_estimated_cost_usd?: number;
  parent_processing_status?: string;
  parent_processing_deferred?: boolean;
  deferred_parent_observation_count?: number;
  issue_count?: number;
  issue_by_type?: Record<string, number>;
  issue_by_severity?: Record<string, number>;
  issue_by_scope?: Record<string, number>;
};

export type CostTotals = {
  llm_call_count: number;
  llm_failure_count: number;
  llm_uncaptured_cost_count: number;
  llm_input_tokens: number;
  llm_output_tokens: number;
  llm_total_tokens: number;
  llm_estimated_cost_usd: number;
  web_event_count: number;
  web_failure_count: number;
  web_uncaptured_cost_count: number;
  web_cache_hit_count: number;
  web_estimated_cost_usd: number;
  failed_call_count: number;
  uncaptured_cost_count: number;
  total_estimated_cost_usd: number;
  web_cache_hit_rate: number;
};

export type CostBreakdownRow = {
  agent_name?: string | null;
  capability?: string | null;
  provider?: string | null;
  model_name?: string | null;
  mode?: string | null;
  cache_source?: string | null;
  call_count?: number;
  event_count?: number;
  cache_hit_count?: number;
  failure_count?: number;
  result_count?: number;
  total_tokens?: number;
  total_cost_usd?: number;
  max_cost_usd?: number;
};

export type CostCallType = 'all' | 'llm' | 'web';

export type CostCallRow = {
  call_type: 'llm' | 'web';
  id: number;
  run_id: string;
  capability?: string | null;
  agent_name?: string | null;
  provider?: string | null;
  model_name?: string | null;
  success: boolean;
  cost_usd?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  latency_ms?: number | null;
  source_trace_id?: string | null;
  evaluation_key?: string | null;
  agent_work_key?: string | null;
  cache_source?: string | null;
  cache_hit?: boolean;
  result_count?: number | null;
  has_ai_overview?: boolean;
  created_at?: string | null;
  decision?: string | null;
  summary_text?: string | null;
  source_module?: string | null;
  source_unique_id?: string | null;
  source_label?: string | null;
  component_key?: string | null;
  resolution_status?: string | null;
};

export type CostCallDetail = CostCallRow & {
  request_payload?: Record<string, unknown>;
  response_payload?: Record<string, unknown>;
  usage_payload?: Record<string, unknown>;
  error_payload?: Record<string, unknown>;
};

export type CostSummary = {
  run_id: string;
  totals: CostTotals;
  top_agents: CostBreakdownRow[];
  top_models: CostBreakdownRow[];
  web_by_provider: CostBreakdownRow[];
  top_expensive_calls: CostCallRow[];
};

export type PaginatedCostCalls = {
  page: number;
  page_size: number;
  total: number;
  items: CostCallRow[];
};

export type IssueRecord = {
  id: number;
  run_id: string;
  input_scope?: string;
  issue_key?: string;
  source_trace_id?: string | null;
  source_module?: string | null;
  source_unique_id?: string | null;
  component_key?: string | null;
  evaluation_key?: string | null;
  assigned_entity_id?: string | null;
  issue_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  status: string;
  reason: string;
  issue_scope?: 'source' | 'component' | 'run' | string;
  display_name?: string;
  plain_meaning?: string;
  operator_signal?: 'informational' | 'investigate' | 'requires_human_resolution' | string;
  source_entity_name?: string | null;
  source_entity_url?: string;
  group_key?: string | null;
  review_case_id?: string | null;
  issue_payload: Record<string, unknown>;
  created_at: string;
  updated_at?: string | null;
};

export type SourceRecordListItem = {
  run_id: string;
  source_trace_id: string;
  source_module: string;
  source_unique_id: string;
  transaction_id?: string | null;
  source_entity_name?: string | null;
  source_member_name?: string | null;
  source_entity_role?: string | null;
  phase: string;
  resolution_status?: string | null;
  decision_source?: string | null;
  assigned_entity_id?: string | null;
  assigned_entity_name?: string | null;
  matched_master_id?: string | null;
  candidate_count: number;
  viable_candidate_count: number;
  issue_count: number;
  lineages_target_record_ids: string[];
  derived_enrichment: Record<string, unknown>;
  updated_at?: string | null;
};

export type TraceSummary = SourceRecordListItem & {
  decision_story: string;
  has_issues: boolean;
  issue_severity?: string | null;
  issue_types: string[];
};

export type CandidateEvaluation = {
  candidate_entity_id: string;
  candidate_entity_name?: string | null;
  candidate_entity_url?: string | null;
  evaluation_status: string;
  final_candidate_status: string;
  decision_source?: string | null;
  agent_lane?: string | null;
  match_phase?: string | null;
  match_type?: string | null;
  name_match_type?: string | null;
  url_status?: string | null;
  url_decision?: string | null;
  blocked_reason?: string | null;
  resolution_route?: string | null;
  resolution_attempt_id?: string | null;
  agent_decision?: string | null;
  agent_confidence?: string | null;
  agent_reason?: string | null;
  suppression_reason?: string | null;
  evaluation_payload: Record<string, unknown>;
  updated_at?: string | null;
};

export type SourceEvaluationContext = {
  source_url_at_evaluation?: string | null;
  current_source_url?: string | null;
  raw_source_url?: string | null;
  source_url_missing_at_evaluation: boolean;
  url_matching_skipped_reason?: string | null;
  created_entity_id_initial?: string | null;
  assigned_entity_id_final?: string | null;
  changed_fields: string[];
  change_sources: Record<string, string[]>;
};

export type ResolutionTimelineEvent = {
  event_type: string;
  summary: string;
  occurred_at?: string | null;
  payload: Record<string, unknown>;
};

export type AgentActivityRecord = {
  lane: string;
  scope: string;
  subject: Record<string, unknown>;
  decision?: string | null;
  confidence?: string | null;
  reason?: string | null;
  used_web_search: boolean;
  raw_prompt_payload: Record<string, unknown>;
  raw_response_payload: Record<string, unknown>;
  occurred_at?: string | null;
};

export type MasterArtifactDetail = {
  entity_id: string;
  entity_name?: string | null;
  entity_url?: string | null;
  dba_name?: string | null;
  aliases: string[];
  business_name?: string | null;
  business_chain_name?: string | null;
  legal_name?: string | null;
  industry?: string | null;
  activity?: string | null;
  summary?: string | null;
  headquarters?: string | null;
  year_of_founding?: string | null;
  support_source_records: SourceRecordListItem[];
  historical_transaction_context?: Array<{
    run_id: string;
    transaction_id: string;
    participant_count: number;
    participants: Array<{
      source_module: string;
      source_unique_id: string;
      source_entity_name?: string | null;
      source_entity_url?: string | null;
      source_member_name?: string | null;
      source_entity_role?: string | null;
      transaction_id?: string | null;
    }>;
    matched_sources: Array<{
      source_trace_id: string;
      source_module: string;
      source_unique_id: string;
      resolution_status: string;
      decision_source: string;
    }>;
  }>;
};

export type MasterSearchResult = Omit<MasterArtifactDetail, 'support_source_records'>;

export type SourceRecordDetail = SourceRecordListItem & {
  source: Record<string, unknown>;
  raw_source: Record<string, unknown>;
  current_source: Record<string, unknown>;
  derived_enrichment: Record<string, unknown>;
  retrieval_summary: Record<string, unknown>;
  retrieval_debug: Record<string, unknown>;
  evaluation_context: SourceEvaluationContext;
  resolution_timeline: ResolutionTimelineEvent[];
  agent_activity: AgentActivityRecord[];
  resolution: Record<string, unknown>;
  candidate_evaluations: CandidateEvaluation[];
  decision_summaries?: Array<Record<string, unknown>>;
  issues: IssueRecord[];
  lineage: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
  llm_audit?: Array<Record<string, unknown>>;
  web_audit?: Array<Record<string, unknown>>;
  source_tracking?: Array<Record<string, unknown>>;
  review_cases?: Array<Record<string, unknown>>;
  master?: MasterArtifactDetail | null;
  transaction_context?: {
    transaction_id?: string | null;
    participants?: Array<{
      source_module: string;
      source_unique_id: string;
      source_entity_name?: string | null;
      source_entity_url?: string | null;
      source_member_name?: string | null;
      source_entity_role?: string | null;
      transaction_id?: string | null;
    }>;
  };
};

export type TraceDetail = SourceRecordDetail & {
  decision_story: string;
  has_issues: boolean;
  issue_severity?: string | null;
  issue_types: string[];
};

export type DisplayTone =
  | 'neutral'
  | 'positive'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted';

export type ReviewEvidenceItem = {
  title: string;
  detail: string;
  evidence_type: string;
  tone?: DisplayTone | string;
  source_label?: string | null;
  route?: string | null;
  next_step?: string | null;
};

export type ReviewSupportingChildGroup = {
  child_entity_key: string;
  child_entity_id?: string | null;
  child_entity_name: string;
  child_entity_url?: string | null;
  row_count: number;
  source_modules: string[];
  example_sources: Array<{
    source_trace_id: string;
    source_module: string;
    source_unique_id: string;
    source_entity_name?: string | null;
    source_entity_role?: string | null;
  }>;
  hidden_source_count: number;
};

export type ReviewCandidateSummary = {
  entity_id: string;
  entity_name?: string | null;
  entity_url?: string | null;
  dba_name?: string | null;
  aliases: string[];
  evaluation_status?: string | null;
  final_candidate_status?: string | null;
  status_label?: string | null;
  tone?: DisplayTone | string;
  plausibility_points: string[];
  risk_points: string[];
  is_unsafe: boolean;
  agent_lane?: string | null;
  agent_decision?: string | null;
  agent_confidence?: string | null;
  agent_reason?: string | null;
  evaluation_payload?: Record<string, unknown>;
  matches_supporting_child_entity?: boolean;
  matched_supporting_row_count?: number;
};

export type ReviewCaseListItem = {
  case_id: string;
  run_id: string;
  input_scope?: string | null;
  phase: string;
  case_type: string;
  review_status: 'open' | 'decided' | 'resolved' | 'superseded' | string;
  publish_status:
    | 'pending'
    | 'blocked'
    | 'published'
    | 'failed'
    | string;
  combined_table: string;
  representative_source_trace_id: string;
  representative_source_name?: string | null;
  source_count: number;
  workflow_id?: string | null;
  candidate_entity_ids: string[];
  issue_keys: string[];
  case_payload: Record<string, unknown>;
  decision_payload: Record<string, unknown>;
  decision_basis_payload: Record<string, unknown>;
  publish_payload: Record<string, unknown>;
  publish_blockers: Array<Record<string, unknown>>;
  decision_summary?: string | null;
  review_trigger_summary?: string | null;
  review_trigger_details?: Array<Record<string, unknown>>;
  case_question?: string | null;
  action_prompt?: string | null;
  case_conflict_summary?: string | null;
  primary_stop_reason?: string | null;
  supporting_child_groups: ReviewSupportingChildGroup[];
  candidate_summaries: ReviewCandidateSummary[];
  unsafe_candidate_ids: string[];
  suggested_review_checks: string[];
  evidence_highlights: ReviewEvidenceItem[];
  blocker_summaries: ReviewEvidenceItem[];
  technical_details: Record<string, unknown>;
  error_payload: Record<string, unknown>;
  superseded_by_case_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  reviewed_at?: string | null;
  published_at?: string | null;
};

export type ReviewEventView = {
  event_id?: number | null;
  run_id: string;
  case_id: string;
  event_type: string;
  actor_type: string;
  payload: Record<string, unknown>;
  created_at?: string | null;
};

export type ReviewCaseDetail = ReviewCaseListItem & {
  sources: SourceRecordListItem[];
  events: ReviewEventView[];
};

export type RunPublishSummary = {
  run_id: string;
  workflow_id?: string | null;
  combined_table?: string | null;
  open_review_case_count: number;
  decided_review_case_count: number;
  publish_blocked_case_count: number;
  failed_publish_case_count: number;
  published_case_count: number;
  parent_processing_status?: string;
  parent_processing_deferred?: boolean;
  deferred_parent_observation_count?: number;
  pre_sync_source_tables: Record<string, string>;
  post_sync_target_tables: Record<string, string>;
};

export type ReviewDecisionPayload = {
  decision_type:
    | 'assign_existing_entity'
    | 'create_new_entity';
  target_entity_id?: string | null;
  reason?: string | null;
};

export type ReviewPublishResponse = {
  status: string;
  message: string;
  publish_id: string;
  run_id: string;
  requested_case_ids: string[];
  check_status_url?: string;
};

export type ReviewPublishBatch = {
  publish_id: string;
  workflow_id: string;
  run_id: string;
  combined_table: string;
  request_mode: string;
  requested_case_ids: string[];
  selected_case_ids: string[];
  successful_case_ids: string[];
  blocked_case_ids: string[];
  failed_case_ids: string[];
  source_refs: Array<{ source_module: string; source_unique_id: string }>;
  status:
    | 'queued'
    | 'running'
    | 'completed'
    | 'completed_with_issues'
    | 'failed'
    | string;
  result_payload: Record<string, unknown>;
  error_payload: Record<string, unknown>;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
