export type TraceSummary = {
  run_id: string;
  source_trace_id: string;
  source_module: string;
  source_unique_id: string;
  source_entity_name: string;
  source_member_name: string;
  source_entity_role: string;
  search_stage: string | null;
  final_status: string | null;
  winner_entity_id: string | null;
  winner_entity_name: string | null;
  winner_origin: string | null;
  candidate_count: number;
  matched_candidate_count: number;
  decision_story: string;
  pre_match_enrichment?: Record<string, unknown> | null;
  // Anomaly fields (optional for backward compatibility)
  has_anomalies?: boolean;
  anomaly_count?: number;
  anomaly_severity?: string | null;
  anomaly_types?: string[];
};

export type CandidateEvaluation = {
  search_kind: string;
  candidate_id: string;
  candidate_name: string;
  candidate_url: string;
  is_match: boolean;
  match_phase: string;
  match_type: string;
  name_match_type?: string;
  url_status: string;
  url_decision: string;
  source_field?: string;
  target_field?: string;
  matched_source_name?: string;
  matched_target_name?: string;
  context_reason?: string;
  rank_key?: number[];
};

export type GraphNode = {
  id: string;
  type: string;
  label: string;
  meta: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type TraceDetail = TraceSummary & {
  trace_payload: {
    source_entity: Record<string, unknown>;
    searches: Array<Record<string, unknown>>;
    final_outcome?: Record<string, unknown> | null;
    pre_match_enrichment?: Record<string, unknown> | null;
  };
  ranked_candidate_results: CandidateEvaluation[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  // Anomaly fields (attached by backend)
  anomalies?: AnomalyRecord[];
  anomaly_count?: number;
};

export type RunSummary = {
  total_traces: number;
  matched_count: number;
  new_entity_count: number;
  no_match_count: number;
  open_review_case_count?: number;
  reviewed_unpublished_case_count?: number;
  publish_blocked_case_count?: number;
  publish_failed_case_count?: number;
  published_case_count?: number;
  parent_processing_status?: string;
  parent_processing_deferred?: boolean;
  deferred_parent_observation_count?: number;
  // Anomaly aggregates
  anomaly_total?: number;
  anomaly_by_type?: Record<string, number>;
  anomaly_by_severity?: Record<string, number>;
  unexpected_phase_winner?: number;
  url_blocked_good_match?: number;
  no_match_with_good_candidates?: number;
  multiple_master_duplicates?: number;
  embedding_override_exact_url?: number;
  cross_url_winner?: number;
  context_winner?: number;
  tie_in_ranking?: number;
  master_id_inconsistency?: number;
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

export type GraphTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info' | 'muted';

export type GraphBadgeView = {
  label: string;
  tone: GraphTone;
};

export type GraphMetricView = {
  label: string;
  value: string;
  tone: GraphTone;
};

export type GraphNodeKind = 'source' | 'cluster' | 'master';
export type GraphEdgeKind = 'membership' | 'assignment' | 'peer' | 'to_master';
export type GraphFocusKind = 'source_record' | 'cluster' | 'master' | 'edge';
export type GraphViewMode = 'intervention' | 'structure';

export type InsightsGraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  status_label?: string | null;
  status_tone: GraphTone;
  is_aggregate: boolean;
  phase?: string | null;
  anomaly_count: number;
  member_count: number;
  preview_items: string[];
  overflow_count: number;
  saved_by_agent_count: number;
  saved_by_human_count: number;
  still_blocked_count: number;
  rejected_count: number;
  pending_review_count: number;
  reviewed_unpublished_count?: number;
  publish_blocked_count?: number;
  publish_failed_count?: number;
  published_human_count?: number;
  intervention_summary_label?: string | null;
  focus_target_kind?: GraphFocusKind | null;
  focus_target_id?: string | null;
  badges: GraphBadgeView[];
  preview_metrics: GraphMetricView[];
  meta: Record<string, unknown>;
};

export type InsightsGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
  status?: string | null;
  display_status?: string | null;
  status_tone: GraphTone;
  is_aggregate: boolean;
  edge_count: number;
  summary_status?: string | null;
  blocked_reason?: string | null;
  resolution_route?: string | null;
  agent_type?: string | null;
  agent_badge?: string | null;
  agent_decision?: string | null;
  agent_confidence?: string | null;
  intervention_kind: 'none' | 'agent' | 'human';
  intervention_actor: 'none' | 'agent' | 'url_agent' | 'context_agent' | 'human';
  intervention_outcome: 'none' | 'saved' | 'rejected' | 'pending' | 'still_blocked';
  outcome_effect: 'no_change' | 'joined_group' | 'matched_company' | 'prevented_bad_match';
  pre_review_status?: string | null;
  post_review_status?: string | null;
  decision_summary?: string | null;
  review_case_id?: string | null;
  review_status?: string | null;
  publish_status?: string | null;
  audit_refs: Array<Record<string, unknown>>;
  preview_label?: string | null;
  focus_target_kind?: GraphFocusKind | null;
  focus_target_id?: string | null;
  meta: Record<string, unknown>;
};

export type GraphSnapshot = {
  run_id: string;
  mode: 'overview' | 'focus';
  view_mode: GraphViewMode;
  focus_kind?: GraphFocusKind | null;
  focus_id?: string | null;
  nodes: InsightsGraphNode[];
  edges: InsightsGraphEdge[];
  stats: Record<string, number>;
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
  stage?: string | null;
  fidelity: 'full' | 'legacy_best_effort';
  final_status?: string | null;
  assignment_kind?: string | null;
  cluster_id?: string | null;
  assigned_entity_id?: string | null;
  assigned_entity_name?: string | null;
  matched_master_id?: string | null;
  matched_master_name?: string | null;
  candidate_count: number;
  matched_candidate_count: number;
  peer_edge_count: number;
  total_edge_count: number;
  anomaly_count: number;
  lineages_target_record_ids: string[];
  updated_at?: string | null;
  graph_links: Record<string, unknown>;
};

export type EdgeArtifactDetail = {
  run_id: string;
  edge_key: string;
  edge_kind: string;
  source_id: string;
  target_id: string;
  status: string;
  match_type?: string | null;
  match_phase?: string | null;
  url_decision?: string | null;
  blocked_reason?: string | null;
  resolution_route?: string | null;
  score?: number | null;
  agent_decision?: string | null;
  agent_reason?: string | null;
  agent_confidence?: string | null;
  resolution_attempt_id?: string | null;
  intervention_kind: 'none' | 'agent' | 'human';
  intervention_actor: 'none' | 'agent' | 'url_agent' | 'context_agent' | 'human';
  intervention_outcome: 'none' | 'saved' | 'rejected' | 'pending' | 'still_blocked';
  outcome_effect: 'no_change' | 'joined_group' | 'matched_company' | 'prevented_bad_match';
  before_review_status?: string | null;
  after_review_status?: string | null;
  changed_final_outcome: boolean;
  narrative_summary?: string | null;
  review_case_id?: string | null;
  review_status?: string | null;
  publish_status?: string | null;
  review_case?: Record<string, unknown> | null;
  review_events: Array<Record<string, unknown>>;
  audit_refs: Array<Record<string, unknown>>;
  source_record?: SourceRecordListItem | null;
  target_source_record?: SourceRecordListItem | null;
  target_master?: MasterArtifactDetail | null;
  anomalies: AnomalyRecord[];
  decision_traces: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
  lineage: Array<Record<string, unknown>>;
};

export type ClusterArtifactDetail = {
  run_id: string;
  cluster_id: string;
  representative_source_trace_id: string;
  assigned_entity_id: string;
  assignment_kind: string;
  matched_master_id?: string | null;
  member_source_trace_ids: string[];
  members: SourceRecordListItem[];
  anomalies: AnomalyRecord[];
  decision_traces: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
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
  support_clusters: string[];
};

export type MasterSearchResult = {
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
};

export type SourceRecordDetail = SourceRecordListItem & {
  source: Record<string, unknown>;
  searches: Array<Record<string, unknown>>;
  derived_enrichment: Record<string, unknown>;
  counts: Record<string, unknown>;
  assignment: Record<string, unknown>;
  anomalies: AnomalyRecord[];
  lineage: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
  edge_details: EdgeArtifactDetail[];
  cluster?: ClusterArtifactDetail | null;
  master?: MasterArtifactDetail | null;
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
  related_cluster_ids: string[];
  candidate_master_ids: string[];
  related_edge_keys: string[];
  related_anomaly_refs: Array<Record<string, unknown>>;
  case_payload: Record<string, unknown>;
  decision_payload: Record<string, unknown>;
  decision_basis_payload: Record<string, unknown>;
  publish_payload: Record<string, unknown>;
  publish_blockers: Array<Record<string, unknown>>;
  decision_summary?: string | null;
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
    | 'create_new_entity'
    | 'merge_clusters_and_assign_existing_master'
    | 'merge_clusters_and_create_new_entity'
    | 'keep_clusters_separate';
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
  status: 'queued' | 'running' | 'completed' | 'completed_with_issues' | 'failed' | string;
  result_payload: Record<string, unknown>;
  error_payload: Record<string, unknown>;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
