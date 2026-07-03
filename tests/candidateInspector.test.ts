import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('candidate inspector does not show synthetic scores', () => {
  const source = readFileSync(new URL('../src/components/CandidateInspector.tsx', import.meta.url), 'utf8');

  assert.match(source, /<th>Outcome<\/th>/);
  assert.doesNotMatch(source, /Evaluation Score/);
  assert.doesNotMatch(source, /evidence-score/);
  assert.doesNotMatch(source, /scoreForCandidate/);
});
