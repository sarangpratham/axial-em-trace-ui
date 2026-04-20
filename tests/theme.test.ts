import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THEME_MODE,
  readStoredThemeMode,
  resolveThemeMode,
  writeStoredThemeMode,
} from '../src/lib/theme.ts';

test('theme defaults to dark when no storage is available', () => {
  assert.equal(readStoredThemeMode(null), DEFAULT_THEME_MODE);
  assert.equal(resolveThemeMode(null), 'dark');
});

test('theme reads a persisted light preference', () => {
  const storage = {
    getItem(key: string) {
      assert.equal(key, 'decision-tracer:theme-mode');
      return 'light';
    },
  };

  assert.equal(readStoredThemeMode(storage), 'light');
});

test('invalid stored theme falls back to dark and persisted writes use the theme key', () => {
  const writes: Array<[string, string]> = [];
  const storage = {
    getItem() {
      return 'sepia';
    },
    setItem(key: string, value: string) {
      writes.push([key, value]);
    },
  };

  assert.equal(readStoredThemeMode(storage), 'dark');
  writeStoredThemeMode('light', storage);
  assert.deepEqual(writes, [['decision-tracer:theme-mode', 'light']]);
});
