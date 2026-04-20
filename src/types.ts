export type SourceResolutionStatus =
  | 'assigned_existing_master'
  | 'created_new_master'
  | 'pending_review';

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
  reviewed_unpublished_case_count?: number;
  publish_blocked_case_count?: number;
  publish_failed_case_count?: number;
  published_case_count?: number;
  parent_processing_status?: string;
  parent_processing_deferred?: boolean;
  deferred_parent_observation_count?: number;
  anomaly_total?: number;
  anomaly_by_type?: Record<string, number>;
  anomaly_by_severity?: Record<string, number>;
};

export type AnomalyRecord = {
  id: number;
  run_id: string;
  source_trace_id: string;
  source_module: string;
  source_unique_id: string;
  anomaly_type: string;
  anomaly_severity: 'low' | 'medium' | 'high' | 'critical';
  anomaly_reason: string;
  source_entity_name?: string;
  source_entity_url?: string;
  winner_entity_id?: string;
  winner_entity_name?: string;
  winner_match_phase?: string;
  winner_match_type?: string;
  winner_url_status?: string;
  total_candidates: number;
  matched_candidates: number;
  best_rank_key?: number[] | null;
  anomaly_details: Record<string, unknown>;
  created_at: string;
};

export type SourceRecordListItem = {
  run_id: string;
  source_trace_id: string;
  source_module: string;
  source_unique_id: string;
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
  anomaly_count: number;
  lineages_target_record_ids: string[];
  derived_enrichment: Record<string, unknown>;
  updated_at?: string | null;
};

export type TraceSummary = SourceRecordListItem & {
  decision_story: string;
  has_anomalies: boolean;
  anomaly_severity?: string | null;
  anomaly_types: string[];
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
};

export type MasterSearchResult = Omit<MasterArtifactDetail, 'support_source_records'>;

export type SourceRecordDetail = SourceRecordListItem & {
  source: Record<string, unknown>;
  derived_enrichment: Record<string, unknown>;
  retrieval_summary: Record<string, unknown>;
  resolution: Record<string, unknown>;
  candidate_evaluations: CandidateEvaluation[];
  anomalies: AnomalyRecord[];
  lineage: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
  master?: MasterArtifactDetail | null;
};

export type TraceDetail = SourceRecordDetail & {
  decision_story: string;
  has_anomalies: boolean;
  anomaly_severity?: string | null;
  anomaly_types: string[];
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
  status_label?: string | null;
  tone?: DisplayTone | string;
  plausibility_points: string[];
  risk_points: string[];
  is_unsafe: boolean;
  matches_supporting_child_entity?: boolean;
  matched_supporting_row_count?: number;
};

export type ReviewCaseListItem = {
  case_id: string;
  run_id: string;
  phase: string;
  case_type: string;
  review_status: 'open' | 'reviewed' | 'superseded' | string;
  publish_status:
    | 'not_ready'
    | 'ready'
    | 'blocked'
    | 'publishing'
    | 'published'
    | 'publish_failed'
    | string;
  combined_table: string;
  representative_source_trace_id: string;
  representative_source_name?: string | null;
  source_count: number;
  workflow_id?: string | null;
  candidate_entity_ids: string[];
  related_anomaly_refs: Array<Record<string, unknown>>;
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
  reviewed_unpublished_case_count: number;
  publish_blocked_case_count: number;
  publish_failed_case_count: number;
  published_case_count: number;
  parent_processing_status?: string;
  parent_processing_deferred?: boolean;
  deferred_parent_observation_count?: number;
  pre_sync_source_tables: Record<string, string>;
  post_sync_target_tables: Record<string, string>;
};

export type ReviewDecisionPayload = {
  decision:
    | 'assign_existing_master'
    | 'create_new_master'
    | 'consolidate_records_to_existing_master'
    | 'consolidate_records_to_new_master'
    | 'keep_record_sets_separate';
  target_entity_id?: string | null;
  reason?: string | null;
};

export type ReviewPublishResponse = {
  status: string;
  message: string;
  publish_id: string;
  run_id: string;
  requested_case_ids: string[];
  check_status_url: string;
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
