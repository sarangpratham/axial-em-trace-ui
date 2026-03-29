import type { RunSummary, TraceDetail, TraceSummary, AnomalyRecord } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const payload = await response.json();
  return payload.data as T;
}

export function getRuns() {
  return request<string[]>('/traces/runs');
}

export function getRunSummary(runId: string) {
  return request<RunSummary>(`/traces/summary?run_id=${encodeURIComponent(runId)}`);
}

export function getTraces(params: {
  runId: string;
  module?: string;
  finalStatus?: string;
  winnerOrigin?: string;
  query?: string;
}) {
  const search = new URLSearchParams({ run_id: params.runId, limit: '500', offset: '0' });
  if (params.module) search.set('module', params.module);
  if (params.finalStatus) search.set('final_status', params.finalStatus);
  if (params.winnerOrigin) search.set('winner_origin', params.winnerOrigin);
  if (params.query) search.set('q', params.query);
  return request<TraceSummary[]>(`/traces?${search.toString()}`);
}

export function getTraceDetail(runId: string, sourceModule: string, sourceUniqueId: string) {
  return request<TraceDetail>(
    `/traces/${encodeURIComponent(runId)}/${encodeURIComponent(sourceModule)}/${encodeURIComponent(sourceUniqueId)}`,
  );
}

export function getAnomalies(params: {
  runId: string;
  sourceModule?: string;
  sourceUniqueId?: string;
  anomalyType?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams({ run_id: params.runId });
  if (params.sourceModule) search.set('source_module', params.sourceModule);
  if (params.sourceUniqueId) search.set('source_unique_id', params.sourceUniqueId);
  if (params.anomalyType) search.set('anomaly_type', params.anomalyType);
  if (params.severity) search.set('severity', params.severity);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.offset) search.set('offset', String(params.offset));
  return request<AnomalyRecord[]>(`/anomalies?${search.toString()}`);
}