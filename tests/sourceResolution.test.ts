import test from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateDispositionLabel,
  normalizeSourceResolutionStatus,
  sourceResolutionLabel,
} from '../src/lib/sourceResolution.ts';

test('accepts only canonical source outcomes', () => {
  assert.equal(normalizeSourceResolutionStatus('assigned_existing_master'), 'assigned_existing_master');
  assert.equal(normalizeSourceResolutionStatus('created_new_master'), 'created_new_master');
  assert.equal(normalizeSourceResolutionStatus('needs_review_multi_master'), 'needs_review_multi_master');
  assert.equal(normalizeSourceResolutionStatus('unresolved'), 'unresolved');
  assert.equal(normalizeSourceResolutionStatus('pending_review'), null);
  assert.equal(normalizeSourceResolutionStatus('master_match'), null);
});

test('source resolution labels use current graph wording', () => {
  assert.equal(sourceResolutionLabel('assigned_existing_master'), 'assigned existing master');
  assert.equal(sourceResolutionLabel('created_new_master'), 'created new master');
  assert.equal(sourceResolutionLabel('needs_review_multi_master'), 'needs review: multiple masters');
  assert.equal(sourceResolutionLabel('unresolved'), 'unresolved');
});

test('candidate outcome labels use graph evaluation wording', () => {
  assert.equal(candidateDispositionLabel('deterministic_accept'), 'accepted by rules');
  assert.equal(candidateDispositionLabel('deterministic_reject'), 'rejected by rules');
  assert.equal(candidateDispositionLabel('agent_accept'), 'accepted by agent');
  assert.equal(candidateDispositionLabel('agent_reject'), 'rejected by agent');
  assert.equal(candidateDispositionLabel('agent_insufficient'), 'needs review');
});
