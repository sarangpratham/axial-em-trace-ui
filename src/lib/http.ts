const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

export const INSIGHTS_API_BASE_URL =
  runtimeEnv.VITE_INSIGHTS_API_BASE_URL || 'http://localhost:5003/api/v1';

export const REVIEW_API_BASE_URL =
  runtimeEnv.VITE_REVIEW_API_BASE_URL
  || INSIGHTS_API_BASE_URL.replace(/\/api\/v1$/, '/review-service/api/v1');

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isApiErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

export function subscribeUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized() {
  for (const listener of unauthorizedListeners) {
    listener();
  }
}

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
  });
  if (response.status === 401) {
    notifyUnauthorized();
    throw new ApiError('Authentication required', 401);
  }
  return response;
}

export async function requestJson<T>(input: string | URL, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetchWithAuth(input, {
    ...init,
    headers,
  });
  if (!response.ok) {
    let detail = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      detail = String(payload.detail || payload.message || detail);
    } catch {
      // ignore body parse errors
    }
    throw new ApiError(detail, response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await response.json();
  return (payload.data ?? payload) as T;
}

export function requestApiJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(`${baseUrl}${path}`, init);
}
