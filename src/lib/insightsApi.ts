import type {
  MasterSearchResult,
} from '../types';
import { INSIGHTS_API_BASE_URL, requestApiJson } from './http.ts';

async function request<T>(path: string): Promise<T> {
  return requestApiJson<T>(INSIGHTS_API_BASE_URL, path);
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
