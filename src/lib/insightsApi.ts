import type {
  MasterSearchResult,
} from '../types';

const INSIGHTS_API_BASE_URL =
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {}).VITE_INSIGHTS_API_BASE_URL
  || 'http://localhost:5003/api/v1';

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${INSIGHTS_API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const payload = await response.json();
  return payload.data as T;
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
