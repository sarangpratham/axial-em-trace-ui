import type {
  GraphSnapshot,
  InsightsGraphEdge,
  InsightsGraphNode,
} from '../types';

export type GraphFilterState = {
  viewMode: 'intervention' | 'structure';
  outcomeFilter: string;
  actorFilter: string;
  impactFilter: string;
  edgeKindFilter: string;
  rawStatusFilter: string;
  phaseFilter: string;
};

export function applyGraphFilters(
  snapshot: GraphSnapshot | undefined,
  graph: GraphFilterState,
) {
  if (!snapshot) {
    return { nodes: [] as InsightsGraphNode[], edges: [] as InsightsGraphEdge[] };
  }

  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const filteredEdges = snapshot.edges.filter((edge) =>
    edgeMatchesFilters(edge, nodeById, graph),
  );

  if (graph.viewMode === 'intervention') {
    const hasInterventionFilter =
      graph.outcomeFilter !== 'all'
      || graph.actorFilter !== 'all'
      || graph.impactFilter !== 'all';

    if (!hasInterventionFilter) {
      return {
        nodes: snapshot.nodes.filter((node) => nodeMatchesPhase(node, graph.phaseFilter)),
        edges: filteredEdges,
      };
    }

    const visibleNodeIds = new Set<string>();
    const matchingInterventionEdges = filteredEdges.filter((edge) =>
      interventionMatchesFilters(edge, graph),
    );

    for (const edge of matchingInterventionEdges) {
      visibleNodeIds.add(edge.source);
      visibleNodeIds.add(edge.target);
    }

    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const edge of filteredEdges) {
        if (isInterventionEdge(edge)) continue;
        if (visibleNodeIds.has(edge.source) || visibleNodeIds.has(edge.target)) {
          if (!visibleNodeIds.has(edge.source)) {
            visibleNodeIds.add(edge.source);
            expanded = true;
          }
          if (!visibleNodeIds.has(edge.target)) {
            visibleNodeIds.add(edge.target);
            expanded = true;
          }
        }
      }
    }

    const visibleNodes = snapshot.nodes.filter(
      (node) => nodeMatchesPhase(node, graph.phaseFilter) && visibleNodeIds.has(node.id),
    );
    const visibleNodeIdSet = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = filteredEdges.filter((edge) => {
      if (!visibleNodeIdSet.has(edge.source) || !visibleNodeIdSet.has(edge.target)) {
        return false;
      }
      return isInterventionEdge(edge) ? interventionMatchesFilters(edge, graph) : true;
    });

    return { nodes: visibleNodes, edges: visibleEdges };
  }

  const baseVisibleNodes = snapshot.nodes.filter((node) => {
    if (!nodeMatchesPhase(node, graph.phaseFilter)) return false;
    if (graph.rawStatusFilter === 'all') return true;
    return normalizeStatus(node.status || node.status_label || '') === graph.rawStatusFilter;
  });
  const baseVisibleNodeIds = new Set(baseVisibleNodes.map((node) => node.id));
  const statusMatchedEdges = filteredEdges.filter((edge) => {
    if (graph.rawStatusFilter === 'all') return true;
    const edgeStatus = normalizeStatus(
      edge.post_review_status || edge.summary_status || edge.status || edge.display_status || '',
    );
    return edgeStatus === graph.rawStatusFilter;
  });
  const visibleNodeIds = new Set(baseVisibleNodeIds);
  for (const edge of statusMatchedEdges) {
    visibleNodeIds.add(edge.source);
    visibleNodeIds.add(edge.target);
  }
  const visibleNodes = snapshot.nodes.filter((node) => visibleNodeIds.has(node.id));
  const visibleEdges = filteredEdges.filter((edge) => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
      return false;
    }
    if (graph.rawStatusFilter === 'all') return true;
    const edgeStatus = normalizeStatus(
      edge.post_review_status || edge.summary_status || edge.status || edge.display_status || '',
    );
    return (
      edgeStatus === graph.rawStatusFilter
      || (baseVisibleNodeIds.has(edge.source) && baseVisibleNodeIds.has(edge.target))
    );
  });

  return { nodes: visibleNodes, edges: visibleEdges };
}

export function normalizeStatus(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function edgeMatchesFilters(
  edge: InsightsGraphEdge,
  nodeById: Map<string, InsightsGraphNode>,
  graph: GraphFilterState,
) {
  if (graph.edgeKindFilter !== 'all' && edge.kind !== graph.edgeKindFilter) {
    return false;
  }

  if (graph.rawStatusFilter !== 'all') {
    const edgeStatus = normalizeStatus(
      edge.post_review_status || edge.summary_status || edge.status || edge.display_status || '',
    );
    if (edgeStatus !== graph.rawStatusFilter) {
      return false;
    }
  }

  if (graph.phaseFilter !== 'all' && !edgeMatchesPhase(edge, nodeById, graph.phaseFilter)) {
    return false;
  }

  return true;
}

function interventionMatchesFilters(
  edge: InsightsGraphEdge,
  graph: GraphFilterState,
) {
  if (!isInterventionEdge(edge)) {
    return false;
  }

  if (graph.outcomeFilter !== 'all') {
    if (graph.outcomeFilter === 'saved_by_agent') {
      if (!(edge.intervention_outcome === 'saved' && edge.intervention_kind === 'agent')) {
        return false;
      }
    } else if (graph.outcomeFilter === 'saved_by_human') {
      if (!(edge.intervention_outcome === 'saved' && edge.intervention_kind === 'human')) {
        return false;
      }
    } else if (edge.intervention_outcome !== graph.outcomeFilter) {
      return false;
    }
  }

  if (graph.actorFilter !== 'all') {
    if (graph.actorFilter === 'human' && edge.intervention_actor !== 'human') return false;
    if (graph.actorFilter === 'url_agent' && edge.intervention_actor !== 'url_agent') return false;
    if (graph.actorFilter === 'context_agent' && edge.intervention_actor !== 'context_agent') return false;
  }

  if (graph.impactFilter !== 'all' && edge.outcome_effect !== graph.impactFilter) {
    return false;
  }

  return true;
}

function nodeMatchesPhase(node: InsightsGraphNode, phaseFilter: string) {
  return phaseFilter === 'all' || normalizeStatus(node.phase || '') === phaseFilter;
}

function edgeMatchesPhase(
  edge: InsightsGraphEdge,
  nodeById: Map<string, InsightsGraphNode>,
  phaseFilter: string,
) {
  const edgePhase = normalizeStatus(String(edge.meta.phase || edge.meta.match_phase || ''));
  if (edgePhase === phaseFilter) return true;
  const sourcePhase = normalizeStatus(nodeById.get(edge.source)?.phase || '');
  const targetPhase = normalizeStatus(nodeById.get(edge.target)?.phase || '');
  return sourcePhase === phaseFilter || targetPhase === phaseFilter;
}

function isInterventionEdge(edge: InsightsGraphEdge) {
  return edge.intervention_kind !== 'none' || edge.kind === 'peer' || edge.kind === 'to_master';
}
