import type {
  ClusterArtifactDetail,
  EdgeArtifactDetail,
  GraphFocusKind,
  GraphSnapshot,
  MasterArtifactDetail,
  MasterSearchResult,
  SourceRecordDetail,
} from '../types';

const INSIGHTS_API_BASE_URL =
  import.meta.env.VITE_INSIGHTS_API_BASE_URL || 'http://localhost:5003/api/v1';

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${INSIGHTS_API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const payload = await response.json();
  return payload.data as T;
}

export function getGraphSnapshot(params: {
  runId: string;
  mode?: 'intervention' | 'structure';
  focusKind?: GraphFocusKind | null;
  focusId?: string | null;
}) {
  const search = new URLSearchParams();
  if (params.mode) search.set('mode', params.mode);
  if (params.focusKind) search.set('focus_kind', params.focusKind);
  if (params.focusId) search.set('focus_id', params.focusId);
  const suffix = search.size ? `?${search.toString()}` : '';
  return request<GraphSnapshot>(
    `/runs/${encodeURIComponent(params.runId)}/graph${suffix}`,
  );
}

export function getSourceRecordDetail(
  runId: string,
  sourceModule: string,
  sourceUniqueId: string,
) {
  return request<SourceRecordDetail>(
    `/runs/${encodeURIComponent(runId)}/source-records/${encodeURIComponent(sourceModule)}/${encodeURIComponent(sourceUniqueId)}`,
  );
}

export function getClusterDetail(runId: string, clusterId: string) {
  return request<ClusterArtifactDetail>(
    `/runs/${encodeURIComponent(runId)}/clusters/${encodeURIComponent(clusterId)}`,
  );
}

export function getEdgeDetail(runId: string, edgeKey: string) {
  return request<EdgeArtifactDetail>(
    `/runs/${encodeURIComponent(runId)}/edges/${encodeURIComponent(edgeKey)}`,
  );
}

export function getMasterDetail(runId: string, entityId: string) {
  return request<MasterArtifactDetail>(
    `/runs/${encodeURIComponent(runId)}/masters/${encodeURIComponent(entityId)}`,
  );
}

export function searchMasterEntities(params: {
  entityIds?: string[];
  query?: string;
  nameQuery?: string;
  urlDomain?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  for (const entityId of params.entityIds ?? []) {
    search.append('entity_id', entityId);
  }
  if (params.query?.trim()) search.set('q', params.query.trim());
  if (params.nameQuery?.trim()) search.set('name_q', params.nameQuery.trim());
  if (params.urlDomain?.trim()) search.set('url_domain', params.urlDomain.trim());
  if (params.limit != null) search.set('limit', String(params.limit));
  const suffix = search.size ? `?${search.toString()}` : '';
  return request<MasterSearchResult[]>(`/masters${suffix}`);
}
