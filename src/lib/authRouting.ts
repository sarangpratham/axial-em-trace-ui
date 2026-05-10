export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function resolveHomePath(status: AuthStatus): string | null {
  if (status === 'loading') return null;
  return status === 'authenticated' ? '/explorer' : '/login';
}

export function resolvePostLoginPath(from: unknown): string {
  if (typeof from !== 'string') return '/explorer';
  if (!from.startsWith('/') || from.startsWith('//') || from === '/login') {
    return '/explorer';
  }
  return from;
}
