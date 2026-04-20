import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisContextSnapshot } from '../src/lib/analysisChat.ts';

test('chat context stays run-scoped and does not pre-pin source or master state', () => {
  const context = createAnalysisContextSnapshot({
    selectedRunId: 'run-9',
    selectedTrace: {
      run_id: 'run-9',
      source_module: 'news',
      source_unique_id: 'src-1',
      source_entity_name: 'Acme Holdings',
      resolution_status: 'assigned_existing_master',
      assigned_entity_id: 'master-123',
      assigned_entity_name: 'Acme Holdings LLC',
    },
    detail: null,
    moduleFilter: 'news',
    statusFilter: 'pending_review',
    decisionSourceFilter: 'context_agent',
    searchInput: 'acme',
  } as any);

  assert.deepEqual(context.currentRun, {
    runId: 'run-9',
    route: 'chat',
  });
  assert.equal(context.selectedSourceRecord, null);
  assert.equal(context.selectedMaster, null);
  assert.deepEqual(context.visibleFilters, {
    module: 'news',
    resolutionStatus: 'pending_review',
    decisionSource: 'context_agent',
    query: 'acme',
  });
});
