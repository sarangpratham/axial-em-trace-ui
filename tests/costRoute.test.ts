import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('cost workspace route and nav tab are registered', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const shellSource = readFileSync(new URL('../src/components/workbench/AppShell.tsx', import.meta.url), 'utf8');
  const runSelectorSource = readFileSync(new URL('../src/components/workbench/RunSelector.tsx', import.meta.url), 'utf8');
  const costSource = readFileSync(new URL('../src/pages/CostPage.tsx', import.meta.url), 'utf8');

  assert.match(appSource, /path="\/cost"/);
  assert.match(appSource, /<WorkspaceRoute view="cost" \/>/);
  assert.match(shellSource, /href: '\/cost'/);
  assert.match(shellSource, /label: 'Cost'/);
  assert.match(shellSource, /<RunSelector/);
  assert.match(runSelectorSource, /Search run IDs/);
  assert.doesNotMatch(costSource, /Cost Workspace/);
  assert.doesNotMatch(costSource, /cost-hero/);
});
