import { useState } from 'react';
import type { Message, Thread, UserMessage } from '@openuidev/react-headless';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
import { INSIGHTS_API_BASE_URL, fetchWithAuth, requestJson } from './http.ts';

const STORAGE_KEY = 'axial-analysis-ui:analysis-user-key';

export const ANALYSIS_CHAT_API_URL = `${INSIGHTS_API_BASE_URL}/chat/stream`;
export const ANALYSIS_THREADS_API_URL = `${INSIGHTS_API_BASE_URL}/chat/threads`;

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
          route: 'chat',
        }
      : null,
    selectedSourceRecord: null,
    selectedMaster: null,
    visibleFilters: {
      module: explorer.moduleFilter || null,
      resolutionStatus: explorer.statusFilter || null,
      decisionSource: explorer.decisionSourceFilter || null,
      query: explorer.searchInput || null,
    },
  };
}

export async function fetchAnalysisThreads(userKey: string, cursor?: string) {
  const url = new URL(ANALYSIS_THREADS_API_URL);
  url.searchParams.set('userKey', userKey);
  if (cursor) url.searchParams.set('cursor', cursor);
  return requestJson<{ threads: Thread[]; nextCursor?: string }>(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function createAnalysisThread(userKey: string, firstMessage: UserMessage, context: ReturnType<typeof createAnalysisContextSnapshot>) {
  return requestJson<Thread>(ANALYSIS_THREADS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userKey, messages: [firstMessage], context }),
  });
}

export async function loadAnalysisThread(userKey: string, threadId: string) {
  const url = new URL(`${ANALYSIS_THREADS_API_URL}/${encodeURIComponent(threadId)}`);
  url.searchParams.set('userKey', userKey);
  const payload = await requestJson<{ thread: Thread; messages: Message[] }>(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
  });
  return payload.messages;
}

export async function updateAnalysisThread(userKey: string, thread: Thread) {
  return requestJson<Thread>(`${ANALYSIS_THREADS_API_URL}/${encodeURIComponent(thread.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userKey, title: thread.title }),
  });
}

export async function deleteAnalysisThread(userKey: string, threadId: string) {
  const url = new URL(`${ANALYSIS_THREADS_API_URL}/${encodeURIComponent(threadId)}`);
  url.searchParams.set('userKey', userKey);
  const response = await fetchWithAuth(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
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
  return fetchWithAuth(ANALYSIS_CHAT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threadId,
      userKey,
      messages,
      context,
    }),
    signal: abortController.signal,
  });
}
