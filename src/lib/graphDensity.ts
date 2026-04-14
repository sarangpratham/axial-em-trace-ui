import type { GraphFocusKind, InsightsGraphEdge } from '../types';

export type GraphZoomTier = 'far' | 'mid' | 'near';

type DensityParams = {
  edges: InsightsGraphEdge[];
  mode: 'overview' | 'focus';
  zoomTier: GraphZoomTier;
  focusKind?: GraphFocusKind | null;
  focusId?: string | null;
  selectedNodeId?: string | null;
  selectedNodeKind?: 'source' | 'cluster' | 'master' | null;
  selectedEdgeId?: string | null;
  edgeKindFilter?: string;
};

export type GraphDensityResult = {
  edges: InsightsGraphEdge[];
  totalReviewEdges: number;
  visibleReviewEdges: number;
  hiddenReviewEdges: number;
  densityMode: 'full' | 'capped';
};

const REVIEW_EDGE_KINDS = new Set(['peer', 'to_master']);

export function applyGraphDensityBudget({
  edges,
  mode,
  zoomTier,
  focusKind,
  focusId,
  selectedNodeId,
  selectedNodeKind,
  selectedEdgeId,
  edgeKindFilter = 'all',
}: DensityParams): GraphDensityResult {
  if (mode === 'overview') {
    return {
      edges,
      totalReviewEdges: 0,
      visibleReviewEdges: 0,
      hiddenReviewEdges: 0,
      densityMode: 'full',
    };
  }

  const reviewEdges = edges.filter((edge) => REVIEW_EDGE_KINDS.has(edge.kind));
  const budget = reviewBudgetFor(zoomTier, edgeKindFilter);

  if (reviewEdges.length <= budget) {
    return {
      edges,
      totalReviewEdges: reviewEdges.length,
      visibleReviewEdges: reviewEdges.length,
      hiddenReviewEdges: 0,
      densityMode: 'full',
    };
  }

  const prioritizedNodeId =
    selectedNodeKind === 'source'
      ? (selectedNodeId ?? null)
      : focusKind === 'source_record'
        ? (focusId ?? null)
        : null;
  const pinnedEdgeIds = new Set<string>();
  const pinnedEndpointIds = new Set<string>();

  if (selectedEdgeId) {
    pinnedEdgeIds.add(selectedEdgeId);
  }
  if (focusKind === 'edge' && focusId) {
    pinnedEdgeIds.add(focusId);
  }

  for (const edge of reviewEdges) {
    if (pinnedEdgeIds.has(edge.id)) {
      pinnedEndpointIds.add(edge.source);
      pinnedEndpointIds.add(edge.target);
    }
  }

  const sortedReviewEdges = [...reviewEdges].sort((left, right) => {
    const scoreGap =
      scoreReviewEdge(right, prioritizedNodeId, pinnedEdgeIds, pinnedEndpointIds)
      - scoreReviewEdge(left, prioritizedNodeId, pinnedEdgeIds, pinnedEndpointIds);
    if (scoreGap !== 0) return scoreGap;
    return right.edge_count - left.edge_count;
  });

  const forcedIds = new Set(
    sortedReviewEdges
      .filter(
        (edge) =>
          pinnedEdgeIds.has(edge.id)
          || (prioritizedNodeId != null
            && (edge.source === prioritizedNodeId || edge.target === prioritizedNodeId))
      )
      .slice(0, Math.min(budget, forceCapFor(zoomTier)))
      .map((edge) => edge.id)
  );

  const perNodeCap = perNodeBudgetFor(zoomTier, edgeKindFilter);
  const visibleIds = new Set<string>();
  const nodeUsage = new Map<string, number>();
  const deferred: InsightsGraphEdge[] = [];

  for (const edge of sortedReviewEdges) {
    if (visibleIds.size >= budget) break;

    const isForced = forcedIds.has(edge.id);
    const sourceUsage = nodeUsage.get(edge.source) ?? 0;
    const targetUsage = nodeUsage.get(edge.target) ?? 0;

    if (!isForced && (sourceUsage >= perNodeCap || targetUsage >= perNodeCap)) {
      deferred.push(edge);
      continue;
    }

    visibleIds.add(edge.id);
    nodeUsage.set(edge.source, sourceUsage + 1);
    nodeUsage.set(edge.target, targetUsage + 1);
  }

  for (const edge of deferred) {
    if (visibleIds.size >= budget) break;
    if (visibleIds.has(edge.id)) continue;
    visibleIds.add(edge.id);
  }

  const visibleEdges = edges.filter(
    (edge) => !REVIEW_EDGE_KINDS.has(edge.kind) || visibleIds.has(edge.id),
  );

  return {
    edges: visibleEdges,
    totalReviewEdges: reviewEdges.length,
    visibleReviewEdges: visibleIds.size,
    hiddenReviewEdges: Math.max(0, reviewEdges.length - visibleIds.size),
    densityMode: 'capped',
  };
}

export function shouldAnimateReviewEdge(
  edge: InsightsGraphEdge,
  density: GraphDensityResult,
  selectedEdgeId?: string | null,
  focusKind?: GraphFocusKind | null,
  focusId?: string | null,
) {
  if (!REVIEW_EDGE_KINDS.has(edge.kind)) return false;
  if (selectedEdgeId && edge.id === selectedEdgeId) return true;
  if (focusKind === 'edge' && focusId && edge.id === focusId) return true;
  return density.densityMode === 'full' && density.visibleReviewEdges <= 6;
}

function reviewBudgetFor(zoomTier: GraphZoomTier, edgeKindFilter: string) {
  const reviewOnly = edgeKindFilter === 'peer' || edgeKindFilter === 'to_master';
  if (zoomTier === 'far') return reviewOnly ? 12 : 8;
  if (zoomTier === 'mid') return reviewOnly ? 26 : 18;
  return reviewOnly ? 56 : 32;
}

function perNodeBudgetFor(zoomTier: GraphZoomTier, edgeKindFilter: string) {
  const reviewOnly = edgeKindFilter === 'peer' || edgeKindFilter === 'to_master';
  if (zoomTier === 'far') return reviewOnly ? 3 : 2;
  if (zoomTier === 'mid') return reviewOnly ? 5 : 3;
  return reviewOnly ? 9 : 5;
}

function forceCapFor(zoomTier: GraphZoomTier) {
  if (zoomTier === 'far') return 4;
  if (zoomTier === 'mid') return 8;
  return 14;
}

function scoreReviewEdge(
  edge: InsightsGraphEdge,
  prioritizedNodeId: string | null,
  pinnedEdgeIds: Set<string>,
  pinnedEndpointIds: Set<string>,
) {
  let score = statusPriority(edge.intervention_outcome || edge.summary_status || edge.status || edge.display_status || '') * 100;

  if (pinnedEdgeIds.has(edge.id)) score += 1000;
  if (prioritizedNodeId && (edge.source === prioritizedNodeId || edge.target === prioritizedNodeId)) {
    score += 500;
  }
  if (pinnedEndpointIds.has(edge.source) || pinnedEndpointIds.has(edge.target)) {
    score += 250;
  }
  if (edge.intervention_kind === 'human') score += 80;
  if (edge.intervention_kind === 'agent') score += 60;
  if (edge.outcome_effect === 'matched_company') score += 55;
  if (edge.outcome_effect === 'joined_group') score += 40;
  if (edge.outcome_effect === 'prevented_bad_match') score += 65;
  if (edge.intervention_actor === 'context_agent' || edge.intervention_actor === 'url_agent') {
    score += 20;
  }

  return score + Math.min(edge.edge_count, 20);
}

function statusPriority(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  switch (normalized) {
    case 'still_blocked':
    case 'blocked':
    case 'rejected':
      return 5;
    case 'saved':
    case 'needs_review':
    case 'pending':
    case 'resolved':
      return 4;
    case 'parent_processing':
      return 3;
    case 'no_match':
      return 2;
    case 'matched':
      return 1;
    default:
      return 0;
  }
}
