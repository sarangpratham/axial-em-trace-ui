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
};

export type RunSummary = {
  total_traces: number;
  matched_count: number;
  new_entity_count: number;
  no_match_count: number;
};