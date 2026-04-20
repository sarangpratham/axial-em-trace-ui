import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSourceResolutionStatus,
  sourceResolutionLabel,
} from '../src/lib/sourceResolution.ts';

test('accepts only canonical source outcomes', () => {
  assert.equal(normalizeSourceResolutionStatus('assigned_existing_master'), 'assigned_existing_master');
  assert.equal(normalizeSourceResolutionStatus('created_new_master'), 'created_new_master');
  assert.equal(normalizeSourceResolutionStatus('pending_review'), 'pending_review');
  assert.equal(normalizeSourceResolutionStatus('master_match'), null);
});

test('source resolution labels always use sequential wording', () => {
  assert.equal(sourceResolutionLabel('assigned_existing_master'), 'assigned existing master');
  assert.equal(sourceResolutionLabel('created_new_master'), 'created new master');
  assert.equal(sourceResolutionLabel('pending_review'), 'pending review');
});
