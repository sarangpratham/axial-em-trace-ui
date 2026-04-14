import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGraphDensityBudget,
  shouldAnimateReviewEdge,
} from '../src/lib/graphDensity.ts';
import type { InsightsGraphEdge } from '../src/types.ts';

function makeReviewEdge(id: string, source: string, target: string, status: string): InsightsGraphEdge {
  return {
    id,
    source,
    target,
    kind: 'to_master',
    status,
    summary_status: status,
    status_tone: status === 'blocked' ? 'warning' : 'info',
    is_aggregate: false,
    edge_count: 1,
    intervention_kind: 'agent',
    intervention_actor: 'context_agent',
    intervention_outcome: status === 'blocked' ? 'still_blocked' : 'saved',
    outcome_effect: 'matched_company',
    audit_refs: [],
    meta: {},
  };
}

test('focus dense graph caps review edges but keeps structural edges', () => {
  const structural: InsightsGraphEdge[] = [
    {
      id: 'membership-1',
      source: 'source-1',
      target: 'cluster-1',
      kind: 'membership',
      status: 'matched',
      summary_status: 'matched',
      status_tone: 'positive',
      is_aggregate: false,
      edge_count: 1,
      intervention_kind: 'none',
      intervention_actor: 'none',
      intervention_outcome: 'none',
      outcome_effect: 'no_change',
      audit_refs: [],
      meta: {},
    },
    {
      id: 'assignment-1',
      source: 'cluster-1',
      target: 'company-1',
      kind: 'assignment',
      status: 'matched',
      summary_status: 'matched',
      status_tone: 'positive',
      is_aggregate: false,
      edge_count: 1,
      intervention_kind: 'none',
      intervention_actor: 'none',
      intervention_outcome: 'none',
      outcome_effect: 'no_change',
      audit_refs: [],
      meta: {},
    },
  ];
  const denseReviewEdges = Array.from({ length: 70 }, (_, index) =>
    makeReviewEdge(
      `review-${index + 1}`,
      `source-${(index % 14) + 1}`,
      'company-1',
      index % 5 === 0 ? 'blocked' : 'resolved',
    ),
  );

  const result = applyGraphDensityBudget({
    edges: [...structural, ...denseReviewEdges],
    mode: 'focus',
    zoomTier: 'mid',
    focusKind: 'master',
    focusId: 'company-1',
    edgeKindFilter: 'all',
  });

  assert.equal(result.densityMode, 'capped');
  assert.equal(result.totalReviewEdges, 70);
  assert.equal(result.visibleReviewEdges, 18);
  assert.equal(result.hiddenReviewEdges, 52);
  assert.equal(result.edges.filter((edge) => edge.kind === 'membership').length, 1);
  assert.equal(result.edges.filter((edge) => edge.kind === 'assignment').length, 1);
});

test('source-focused dense graph keeps review edges touching the selected source', () => {
  const denseReviewEdges = Array.from({ length: 40 }, (_, index) =>
    makeReviewEdge(
      `review-${index + 1}`,
      index < 12 ? 'source-priority' : `source-${index + 1}`,
      'company-1',
      index < 6 ? 'blocked' : 'resolved',
    ),
  );

  const result = applyGraphDensityBudget({
    edges: denseReviewEdges,
    mode: 'focus',
    zoomTier: 'far',
    focusKind: 'source_record',
    focusId: 'source-priority',
    selectedNodeId: 'source-priority',
    selectedNodeKind: 'source',
    edgeKindFilter: 'to_master',
  });

  const visiblePriorityEdges = result.edges.filter((edge) => edge.source === 'source-priority');
  assert.ok(visiblePriorityEdges.length > 0);
  assert.ok(result.hiddenReviewEdges > 0);
});

test('only explicitly focused review edges stay animated in capped mode', () => {
  const density = {
    edges: [],
    totalReviewEdges: 40,
    visibleReviewEdges: 18,
    hiddenReviewEdges: 22,
    densityMode: 'capped' as const,
  };
  const focusedEdge = makeReviewEdge('review-1', 'source-1', 'company-1', 'blocked');
  const unfocusedEdge = makeReviewEdge('review-2', 'source-2', 'company-1', 'blocked');

  assert.equal(shouldAnimateReviewEdge(focusedEdge, density, 'review-1', null, null), true);
  assert.equal(shouldAnimateReviewEdge(unfocusedEdge, density, 'review-1', null, null), false);
});
