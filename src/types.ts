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