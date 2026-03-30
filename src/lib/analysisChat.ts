import { useState } from 'react';
import type { Message, Thread, UserMessage } from '@openuidev/react-headless';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';

const STORAGE_KEY = 'axial-analysis-ui:analysis-user-key';

export const ANALYSIS_CHAT_API_URL = import.meta.env.VITE_ANALYSIS_CHAT_API_URL || 'http://localhost:5003/api/v1/analysis-chat';
export const ANALYSIS_THREADS_API_URL = import.meta.env.VITE_ANALYSIS_THREADS_API_URL || 'http://localhost:5003/api/v1/analysis-threads';
export const ANALYSIS_API_KEY = import.meta.env.VITE_ANALYSIS_API_KEY || '';

export const ANALYSIS_STARTER_PROMPTS = [
  'Summarize anomalies in this run',
  'Explain why this winner was chosen',
  'Compare this winner against master data',
  'Find traces with suspicious URL evidence',
];

function createBrowserScopedUserKey() {
  if (typeof window === 'undefined') return 'axial-analysis-server';
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const next = `axial-analysis-${window.crypto?.randomUUID?.() ?? `${Date.now()}`}`;
  window.localStorage.setItem(STORAGE_KEY, next);
  return next;
}

export function useAnalysisUserKey() {
  const [userKey] = useState(() => createBrowserScopedUserKey());
  return userKey;
}

export function createAnalysisContextSnapshot(explorer: TraceExplorerState) {
  return {
    currentRun: explorer.selectedRunId
      ? {
          runId: explorer.selectedRunId,
          route: 'analysis',
        }
      : null,
    selectedTrace: explorer.selectedTrace
      ? {
          runId: explorer.selectedTrace.run_id,
          sourceModule: explorer.selectedTrace.source_module,
          sourceUniqueId: explorer.selectedTrace.source_unique_id,
          sourceEntityName: explorer.selectedTrace.source_entity_name,
          finalStatus: explorer.selectedTrace.final_status,
          winnerEntityId: explorer.selectedTrace.winner_entity_id,
          winnerEntityName: explorer.selectedTrace.winner_entity_name,
        }
      : null,
    visibleFilters: {
      module: explorer.moduleFilter || null,
      finalStatus: explorer.statusFilter || null,
      query: explorer.searchInput || null,
    },
  };
}

function requestHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ANALYSIS_API_KEY) {
    headers['X-Api-Key'] = ANALYSIS_API_KEY;
  }
  return headers;
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAnalysisThreads(userKey: string, cursor?: string) {
  const url = new URL(`${ANALYSIS_THREADS_API_URL}/get`);
  url.searchParams.set('userKey', userKey);
  if (cursor) url.searchParams.set('cursor', cursor);
  return requestJson<{ threads: Thread[]; nextCursor?: string }>(url.toString(), { headers: requestHeaders() });
}

export async function createAnalysisThread(userKey: string, firstMessage: UserMessage, context: ReturnType<typeof createAnalysisContextSnapshot>) {
  return requestJson<Thread>(`${ANALYSIS_THREADS_API_URL}/create`, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({ userKey, messages: [firstMessage], context }),
  });
}

export async function loadAnalysisThread(userKey: string, threadId: string) {
  const url = new URL(`${ANALYSIS_THREADS_API_URL}/get/${encodeURIComponent(threadId)}`);
  url.searchParams.set('userKey', userKey);
  const payload = await requestJson<{ thread: Thread; messages: Message[] }>(url.toString(), { headers: requestHeaders() });
  return payload.messages;
}

export async function updateAnalysisThread(userKey: string, thread: Thread) {
  return requestJson<Thread>(`${ANALYSIS_THREADS_API_URL}/update/${encodeURIComponent(thread.id)}`, {
    method: 'PATCH',
    headers: requestHeaders(),
    body: JSON.stringify({ userKey, title: thread.title }),
  });
}

export async function deleteAnalysisThread(userKey: string, threadId: string) {
  const url = new URL(`${ANALYSIS_THREADS_API_URL}/delete/${encodeURIComponent(threadId)}`);
  url.searchParams.set('userKey', userKey);
  await fetch(url, { method: 'DELETE', headers: requestHeaders() });
}

export async function sendAnalysisMessage({
  threadId,
  messages,
  abortController,
  userKey,
  context,
}: {
  threadId: string;
  messages: Message[];
  abortController: AbortController;
  userKey: string;
  context: ReturnType<typeof createAnalysisContextSnapshot>;
}) {
  return fetch(ANALYSIS_CHAT_API_URL, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({
      threadId,
      userKey,
      messages,
      context,
    }),
    signal: abortController.signal,
  });
}
