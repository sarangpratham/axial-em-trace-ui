import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCostCallsPath } from '../src/lib/api.ts';

test('cost calls path encodes pagination filters and sorting', () => {
  const path = buildCostCallsPath({
    runId: 'run 1',
    type: 'llm',
    sort: 'tokens_desc',
    agent: 'context agent',
    provider: 'openai',
    success: 'failure',
    cacheSource: 'singleflight',
    query: 'edge-1',
    page: 3,
    pageSize: 20,
  });

  assert.equal(
    path,
    '/runs/run%201/cost/calls?type=llm&sort=tokens_desc&page=3&page_size=20&agent=context+agent&provider=openai&cache_source=singleflight&query=edge-1&success=false',
  );
});

test('cost calls path defaults to compact first page', () => {
  assert.equal(
    buildCostCallsPath({ runId: 'run-1' }),
    '/runs/run-1/cost/calls?type=all&sort=created_desc&page=1&page_size=20',
  );
});
