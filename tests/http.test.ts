import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, requestJson, subscribeUnauthorized } from '../src/lib/http.ts';

test('requestJson sends credentialed requests and unwraps data payloads', async () => {
  const originalFetch = globalThis.fetch;
  let seenInit: RequestInit | undefined;

  globalThis.fetch = (async (_input, init) => {
    seenInit = init;
    return new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const payload = await requestJson<{ ok: boolean }>('http://example.test/value');
    assert.deepEqual(payload, { ok: true });
    assert.equal(seenInit?.credentials, 'include');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('requestJson notifies unauthorized listeners when the session expires', async () => {
  const originalFetch = globalThis.fetch;
  let unauthorizedCount = 0;

  globalThis.fetch = (async () => new Response(JSON.stringify({ detail: 'Authentication required' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;

  const unsubscribe = subscribeUnauthorized(() => {
    unauthorizedCount += 1;
  });

  try {
    await assert.rejects(
      () => requestJson('http://example.test/protected'),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
    assert.equal(unauthorizedCount, 1);
  } finally {
    unsubscribe();
    globalThis.fetch = originalFetch;
  }
});
