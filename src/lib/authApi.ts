import type { AuthenticatedUser } from '../types.ts';
import { INSIGHTS_API_BASE_URL, requestApiJson } from './http.ts';

export function loginWithPassword(email: string, password: string) {
  return requestApiJson<AuthenticatedUser>(INSIGHTS_API_BASE_URL, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logoutCurrentUser() {
  return requestApiJson<{ authenticated: boolean }>(INSIGHTS_API_BASE_URL, '/auth/logout', {
    method: 'POST',
  });
}

export function getCurrentUser() {
  return requestApiJson<AuthenticatedUser>(INSIGHTS_API_BASE_URL, '/auth/me');
}
