import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('cost workspace route and nav tab are registered', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const topbarSource = readFileSync(new URL('../src/components/AppTopbar.tsx', import.meta.url), 'utf8');
  const costSource = readFileSync(new URL('../src/pages/CostPage.tsx', import.meta.url), 'utf8');

  assert.match(appSource, /path="\/cost"/);
  assert.match(appSource, /<WorkspaceRoute view="cost" \/>/);
  assert.match(topbarSource, /to="\/cost"/);
  assert.match(topbarSource, />\s*Cost\s*</);
  assert.match(topbarSource, /topbar-run-picker/);
  assert.doesNotMatch(topbarSource, /runIds\.length\s*>\s*0/);
  assert.doesNotMatch(costSource, /Cost Workspace/);
  assert.doesNotMatch(costSource, /cost-hero/);
});
