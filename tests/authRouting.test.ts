import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHomePath, resolvePostLoginPath } from '../src/lib/authRouting.ts';

test('home routing follows auth state', () => {
  assert.equal(resolveHomePath('loading'), null);
  assert.equal(resolveHomePath('authenticated'), '/explorer');
  assert.equal(resolveHomePath('unauthenticated'), '/login');
});

test('post-login routing keeps only safe internal destinations', () => {
  assert.equal(resolvePostLoginPath('/review?case=1'), '/review?case=1');
  assert.equal(resolvePostLoginPath('/login'), '/explorer');
  assert.equal(resolvePostLoginPath('https://evil.example'), '/explorer');
  assert.equal(resolvePostLoginPath('//evil.example'), '/explorer');
  assert.equal(resolvePostLoginPath(null), '/explorer');
});
