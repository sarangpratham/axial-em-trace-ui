import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  getBezierPath,
  type Edge as FlowEdge,
  type EdgeProps,
  type Node as FlowNode,
  type NodeProps,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useNavigate } from 'react-router-dom';
import { AppTopbar } from '../components/AppTopbar';
import { useGraphViewState } from '../hooks/useGraphViewState';
import {
  applyGraphDensityBudget,
  shouldAnimateReviewEdge,
  type GraphDensityResult,
} from '../lib/graphDensity';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
import { applyGraphFilters } from '../lib/graphFilters';
import {
  getClusterDetail,
  getEdgeDetail,
  getGraphSnapshot,
  getMasterDetail,
  getSourceRecordDetail,
} from '../lib/insightsApi';
import type {
  ClusterArtifactDetail,
  EdgeArtifactDetail,
  GraphTone,
  GraphSnapshot,
  InsightsGraphEdge,
  InsightsGraphNode,
  MasterArtifactDetail,
  SourceRecordDetail,
} from '../types';

type ZoomTier = 'far' | 'mid' | 'near';

type GraphNodeData = {
  node: InsightsGraphNode;
  zoomTier: ZoomTier;
  mode: 'overview' | 'focus';
};

type GraphEdgeData = {
  edge: InsightsGraphEdge;
  zoomTier: ZoomTier;
  mode: 'overview' | 'focus';
  viewMode: 'intervention' | 'structure';
  densityMode: GraphDensityResult['densityMode'];
  onSelect: (edge: InsightsGraphEdge) => void;
};

type InspectorSelection =
  | { kind: 'source'; node: InsightsGraphNode; detail?: SourceRecordDetail | null }
  | { kind: 'cluster'; node: InsightsGraphNode; detail?: ClusterArtifactDetail | null }
  | { kind: 'master'; node: InsightsGraphNode; detail?: MasterArtifactDetail | null }
  | { kind: 'edge'; edge: InsightsGraphEdge; detail?: EdgeArtifactDetail | null }
  | null;

type JumpTarget = {
  id: string;
  title: string;
  subtitle: string;
  kind: InsightsGraphNode['kind'];
  statusLabel: string;
  score: number;
  node: InsightsGraphNode;
};

type DetailField = {
  label: string;
  value: ReactNode;
};

const NODE_WIDTH = 264;
const NODE_MIN_HEIGHT = 148;
const NODE_GAP = 36;
const NODE_TOP_OFFSET = 56;
const COLUMN_X = {
  source: 32,
  cluster: 420,
  master: 808,
} as const;

function classForTone(tone: GraphTone) {
  return `graph-tone graph-tone--${tone}`;
}

const OverviewRecordNode = memo(function OverviewRecordNode({
  data,
}: NodeProps<GraphNodeData>) {
  return <GraphCard node={data.node} zoomTier={data.zoomTier} variant="overview-record" />;
});

const OverviewGroupNode = memo(function OverviewGroupNode({
  data,
}: NodeProps<GraphNodeData>) {
  return <GraphCard node={data.node} zoomTier={data.zoomTier} variant="overview-group" />;
});

const OverviewCompanyNode = memo(function OverviewCompanyNode({
  data,
}: NodeProps<GraphNodeData>) {
  return <GraphCard node={data.node} zoomTier={data.zoomTier} variant="overview-company" />;
});

const FocusRecordNode = memo(function FocusRecordNode({ data }: NodeProps<GraphNodeData>) {
  return <GraphCard node={data.node} zoomTier={data.zoomTier} variant="focus-record" />;
});

const FocusGroupNode = memo(function FocusGroupNode({ data }: NodeProps<GraphNodeData>) {
  return <GraphCard node={data.node} zoomTier={data.zoomTier} variant="focus-group" />;
});

const FocusCompanyNode = memo(function FocusCompanyNode({
  data,
}: NodeProps<GraphNodeData>) {
  return <GraphCard node={data.node} zoomTier={data.zoomTier} variant="focus-company" />;
});

function GraphCard({
  node,
  zoomTier,
  variant,
}: {
  node: InsightsGraphNode;
  zoomTier: ZoomTier;
  variant: string;
}) {
  const isNear = zoomTier === 'near';
  const isMid = zoomTier !== 'far';
  const visibleBadges = useMemo(
    () => node.badges.filter((badge) => !isRedundantNodeBadge(badge.label, node.subtitle)),
    [node.badges, node.subtitle],
  );
  const visibleStats = useMemo(
    () => node.preview_metrics.filter((metric) => !isRedundantStat(metric.label, metric.value)),
    [node.preview_metrics],
  );

  return (
    <div className={`graph-card graph-card--${variant}${node.is_aggregate ? ' graph-card--aggregate' : ''}`}>
      <Handle type="target" position={Position.Left} className="graph-card-handle" />
      <Handle type="source" position={Position.Right} className="graph-card-handle" />

      <div className="graph-card-top">
        <span className={`graph-status-pill ${classForTone(node.status_tone)}`}>
          {node.status_label || 'Selection'}
        </span>
        {isMid && visibleBadges.length > 0 && (
          <div className="graph-card-badges">
            {visibleBadges.slice(0, isNear ? 2 : 1).map((badge) => (
              <span key={`${badge.label}:${badge.tone}`} className={`graph-badge ${classForTone(badge.tone)}`}>
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="graph-card-title">{node.title}</div>
      {isMid && node.subtitle && <div className="graph-card-subtitle">{node.subtitle}</div>}

      {node.overflow_count > 0 && isMid && (
        <div className="graph-card-overflow-note">
          {node.overflow_count} more item{node.overflow_count === 1 ? '' : 's'} behind this card
        </div>
      )}

      {isMid && visibleStats.length > 0 && (
        <div className={`graph-card-stats${isNear ? ' graph-card-stats--near' : ''}`}>
          {visibleStats.slice(0, isNear ? 3 : 2).map((metric) => (
            <div
              key={`${metric.label}:${metric.value}`}
              className={`graph-card-stat graph-card-stat--${metric.tone}`}
            >
              <span>{metric.label}</span>
              <strong className={classForTone(metric.tone)}>{metric.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const OverviewAggregateEdge = memo(function OverviewAggregateEdge(props: EdgeProps<GraphEdgeData>) {
  return <LabeledEdge {...props} variant="overview" />;
});

const FocusConnectorEdge = memo(function FocusConnectorEdge(props: EdgeProps<GraphEdgeData>) {
  return <LabeledEdge {...props} variant="focus" />;
});

const FocusReviewEdge = memo(function FocusReviewEdge(props: EdgeProps<GraphEdgeData>) {
  return <LabeledEdge {...props} variant="review" />;
});

function LabeledEdge(
  props: EdgeProps<GraphEdgeData> & { variant: 'overview' | 'focus' | 'review' },
) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, variant } = props;
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const edge = data?.edge;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: edgeStrokeColor(edge, data?.viewMode || 'structure'),
          strokeWidth:
            edgeStrokeWidth(edge, variant, data?.viewMode || 'structure'),
          strokeDasharray:
            edgeStrokeDash(edge, variant, data?.viewMode || 'structure'),
          opacity: edgeOpacity(edge, variant, data?.viewMode || 'structure', data?.densityMode || 'full'),
        }}
      />

      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        className="graph-edge-hit"
        onClick={() => edge && data?.onSelect(edge)}
      />
    </>
  );
}

const nodeTypes = {
  overviewRecord: OverviewRecordNode,
  overviewGroup: OverviewGroupNode,
  overviewCompany: OverviewCompanyNode,
  focusRecord: FocusRecordNode,
  focusGroup: FocusGroupNode,
  focusCompany: FocusCompanyNode,
};

const edgeTypes = {
  overviewAggregate: OverviewAggregateEdge,
  focusConnector: FocusConnectorEdge,
  focusReview: FocusReviewEdge,
};

export function GraphPage({ explorer }: { explorer: TraceExplorerState }) {
  const graph = useGraphViewState(explorer);
  const navigate = useNavigate();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [zoomTier, setZoomTier] = useState<ZoomTier>('near');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState('');
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const jumpInputRef = useRef<HTMLInputElement | null>(null);
  const jumpPanelRef = useRef<HTMLDivElement | null>(null);
  const filterDrawerRef = useRef<HTMLDivElement | null>(null);
  const resetGraphFilters = () => {
    graph.updateGraphParam('graph_outcome', null);
    graph.updateGraphParam('graph_actor', null);
    graph.updateGraphParam('graph_impact', null);
    graph.updateGraphParam('graph_edge_kind', null);
    graph.updateGraphParam('graph_raw_status', null);
    graph.updateGraphParam('graph_phase', null);
  };

  const graphQuery = useQuery({
    queryKey: ['insights-graph', graph.runId, graph.viewMode, graph.focusKind, graph.focusId],
    queryFn: () =>
      getGraphSnapshot({
        runId: graph.runId,
        mode: graph.viewMode,
        focusKind: graph.focusKind,
        focusId: graph.focusId,
      }),
    enabled: Boolean(graph.runId),
  });

  const snapshot = graphQuery.data;
  const isOverview = snapshot?.mode !== 'focus';

  const selectedNode = useMemo(() => {
    if (!snapshot || !graph.focusKind || !graph.focusId) return null;
    return (
      snapshot.nodes.find((node) => node.id === graph.focusId)
      || snapshot.nodes.find((node) => node.focus_target_id === graph.focusId)
      || null
    );
  }, [graph.focusId, graph.focusKind, snapshot]);

  const selectedEdge = useMemo(
    () => snapshot?.edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [selectedEdgeId, snapshot],
  );

  const handleReviewEdgeSelect = useCallback(
    (edge: InsightsGraphEdge) => {
      if (edge.kind === 'peer' || edge.kind === 'to_master') {
        if (edge.focus_target_kind && edge.focus_target_id) {
          graph.setFocus(edge.focus_target_kind, edge.focus_target_id);
        }
        return;
      }
      setSelectedEdgeId(edge.id);
    },
    [graph],
  );

  const openReviewCase = useCallback((reviewCaseId: string) => {
    if (!reviewCaseId) return;
    explorer.selectReviewCase(reviewCaseId);
    navigate('/review');
  }, [explorer, navigate]);

  useEffect(() => {
    setSelectedEdgeId(null);
  }, [graph.focusId, graph.focusKind]);

  const sourceDetailQuery = useQuery({
    queryKey: [
      'graph-source-detail',
      graph.runId,
      selectedNode?.kind === 'source' ? selectedNode.meta.source_module : null,
      selectedNode?.kind === 'source' ? selectedNode.meta.source_unique_id : null,
    ],
    queryFn: () =>
      getSourceRecordDetail(
        graph.runId,
        String(selectedNode?.meta.source_module || ''),
        String(selectedNode?.meta.source_unique_id || ''),
      ),
    enabled: Boolean(
      graph.runId
        && selectedNode?.kind === 'source'
        && !selectedNode.is_aggregate
        && selectedNode.meta.source_module
        && selectedNode.meta.source_unique_id,
    ),
  });

  const clusterDetailQuery = useQuery({
    queryKey: [
      'graph-cluster-detail',
      graph.runId,
      selectedNode?.kind === 'cluster' ? selectedNode.meta.cluster_id : null,
    ],
    queryFn: () => getClusterDetail(graph.runId, String(selectedNode?.meta.cluster_id || '')),
    enabled: Boolean(
      graph.runId
        && selectedNode?.kind === 'cluster'
        && !selectedNode.is_aggregate
        && selectedNode.meta.cluster_id,
    ),
  });

  const masterDetailQuery = useQuery({
    queryKey: [
      'graph-master-detail',
      graph.runId,
      selectedNode?.kind === 'master' ? selectedNode.meta.entity_id : null,
    ],
    queryFn: () => getMasterDetail(graph.runId, String(selectedNode?.meta.entity_id || '')),
    enabled: Boolean(
      graph.runId
        && selectedNode?.kind === 'master'
        && !selectedNode.is_aggregate
        && selectedNode.meta.entity_id,
    ),
  });

  const rawEdgeKey =
    snapshot?.mode === 'focus'
      && graph.focusKind === 'edge'
      && graph.focusId
      && (snapshot.edges.find((edge) => edge.id === graph.focusId)?.kind === 'peer'
        || snapshot.edges.find((edge) => edge.id === graph.focusId)?.kind === 'to_master')
      ? graph.focusId
      : null;

  const edgeDetailQuery = useQuery({
    queryKey: ['graph-edge-detail', graph.runId, rawEdgeKey],
    queryFn: () => getEdgeDetail(graph.runId, rawEdgeKey || ''),
    enabled: Boolean(graph.runId && rawEdgeKey),
  });

  const filteredGraph = useMemo(
    () => applyGraphFilters(snapshot, graph),
    [graph, snapshot],
  );
  const hasFilteredResults = filteredGraph.nodes.length > 0 || filteredGraph.edges.length > 0;
  const densityGraph = useMemo(
    () =>
      applyGraphDensityBudget({
        edges: filteredGraph.edges,
        mode: snapshot?.mode || 'overview',
        zoomTier,
        focusKind: graph.focusKind,
        focusId: graph.focusId,
        selectedNodeId: selectedNode?.id ?? null,
        selectedNodeKind: selectedNode?.kind ?? null,
        selectedEdgeId,
        edgeKindFilter: graph.edgeKindFilter,
      }),
    [
      filteredGraph.edges,
      graph.edgeKindFilter,
      graph.focusId,
      graph.focusKind,
      selectedEdgeId,
      selectedNode?.id,
      selectedNode?.kind,
      snapshot?.mode,
      zoomTier,
    ],
  );

  const flowNodes = useMemo(
    () => buildFlowNodes(filteredGraph.nodes, snapshot?.mode || 'overview', zoomTier),
    [filteredGraph.nodes, snapshot?.mode, zoomTier],
  );

  const flowEdges = useMemo(
    () =>
      buildFlowEdges({
        edges: densityGraph.edges,
        mode: snapshot?.mode || 'overview',
        viewMode: graph.viewMode,
        zoomTier,
        density: densityGraph,
        selectedEdgeId,
        focusKind: graph.focusKind,
        focusId: graph.focusId,
        onSelect: handleReviewEdgeSelect,
      }),
    [
      densityGraph,
      graph.focusId,
      graph.focusKind,
      graph.viewMode,
      handleReviewEdgeSelect,
      selectedEdgeId,
      snapshot?.mode,
      zoomTier,
    ],
  );

  const inspectorSelection: InspectorSelection = useMemo(() => {
    if (selectedNode?.kind === 'source') {
      return { kind: 'source', node: selectedNode, detail: sourceDetailQuery.data };
    }
    if (selectedNode?.kind === 'cluster') {
      return { kind: 'cluster', node: selectedNode, detail: clusterDetailQuery.data };
    }
    if (selectedNode?.kind === 'master') {
      return { kind: 'master', node: selectedNode, detail: masterDetailQuery.data };
    }
    if (snapshot?.mode === 'focus' && graph.focusKind === 'edge' && graph.focusId) {
      const focusedEdge = snapshot.edges.find((edge) => edge.id === graph.focusId) ?? null;
      if (focusedEdge) {
        return { kind: 'edge', edge: focusedEdge, detail: edgeDetailQuery.data };
      }
    }
    if (selectedEdge) {
      return { kind: 'edge', edge: selectedEdge, detail: edgeDetailQuery.data };
    }
    return null;
  }, [
    clusterDetailQuery.data,
    edgeDetailQuery.data,
    graph.focusId,
    graph.focusKind,
    masterDetailQuery.data,
    selectedEdge,
    selectedNode,
    snapshot,
    sourceDetailQuery.data,
  ]);

  const jumpTargets = useMemo(
    () => buildJumpTargets(filteredGraph.nodes, jumpQuery),
    [filteredGraph.nodes, jumpQuery],
  );

  const jumpToLane = useCallback(
    (kind: InsightsGraphNode['kind']) => {
      if (!flowInstance) return;
      const laneNodes = flowNodes.filter((node) => node.data.node.kind === kind);
      if (laneNodes.length === 0) return;
      void flowInstance.fitView({
        nodes: laneNodes.map((node) => ({ id: node.id })),
        padding: 0.22,
        duration: 280,
        minZoom: 0.55,
        maxZoom: 1.15,
      });
    },
    [flowInstance, flowNodes],
  );

  const jumpToSelection = useCallback(() => {
    if (!flowInstance) return;
    const selectedId = selectedNode?.id || graph.focusId;
    if (!selectedId) return;
    void flowInstance.fitView({
      nodes: [{ id: selectedId }],
      padding: 0.5,
      duration: 260,
      minZoom: 0.75,
      maxZoom: 1.2,
    });
  }, [flowInstance, graph.focusId, selectedNode?.id]);

  const jumpToNode = useCallback(
    (node: InsightsGraphNode) => {
      setJumpOpen(false);
      setJumpQuery('');
      setSelectedEdgeId(null);
      if (node.focus_target_kind && node.focus_target_id) {
        graph.setFocus(node.focus_target_kind, node.focus_target_id);
        return;
      }
      void flowInstance?.fitView({
        nodes: [{ id: node.id }],
        padding: 0.45,
        duration: 260,
        minZoom: 0.75,
        maxZoom: 1.2,
      });
    },
    [flowInstance, graph],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setJumpOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useLayoutEffect(() => {
    if (!jumpOpen) return;
    const focusInput = () => {
      const input = jumpInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.select();
    };
    focusInput();
    const timer = window.setTimeout(focusInput, 60);
    return () => window.clearTimeout(timer);
  }, [jumpOpen]);

  useEffect(() => {
    if (!jumpOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setJumpOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [jumpOpen]);

  useEffect(() => {
    if (!jumpOpen && !filtersOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (jumpOpen) {
        const insideJumpPanel = jumpPanelRef.current?.contains(target) ?? false;
        const jumpToggle = (target instanceof Element)
          ? target.closest('[aria-expanded]')
          : null;
        const isJumpToggle = jumpToggle?.classList.contains('graph-floating-button') ?? false;
        if (!insideJumpPanel && !isJumpToggle) {
          setJumpOpen(false);
        }
      }

      if (filtersOpen) {
        const insideFilterDrawer = filterDrawerRef.current?.contains(target) ?? false;
        const filterToggle = (target instanceof Element)
          ? target.closest('[aria-expanded]')
          : null;
        const isFilterToggle = filterToggle?.classList.contains('graph-floating-button') ?? false;
        if (!insideFilterDrawer && !isFilterToggle) {
          setFiltersOpen(false);
        }
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [filtersOpen, jumpOpen]);

  return (
    <div className="shell graph-shell">
      <AppTopbar
        currentView="graph"
        graphSearch={window.location.search}
        statusSlot={<span className="topbar-status-chip">{graph.runId ? `Run ${graph.runId}` : 'Match map'}</span>}
      />

      {!graph.runId ? (
        <div className="graph-empty-state">
          <span className="empty-icon">◎</span>
          <p>Select a run in Explorer first, then open Graph to inspect how records move into match groups and companies.</p>
        </div>
      ) : (
        <div className="graph-layout">
          <section className="graph-main">
            <div className="graph-canvas-shell">
              <div className="graph-canvas-topbar">
                <div className="graph-canvas-actions">
                  <button
                    type="button"
                    className={`graph-floating-button${filtersOpen ? ' graph-floating-button--active' : ''}`}
                    onClick={() => setFiltersOpen((value) => !value)}
                    aria-expanded={filtersOpen}
                  >
                    {filtersOpen ? 'Hide filters' : 'Filters'}
                  </button>
                  <button
                    type="button"
                    className={`graph-floating-button${jumpOpen ? ' graph-floating-button--active' : ''}`}
                    onClick={() => setJumpOpen((value) => !value)}
                    aria-expanded={jumpOpen}
                  >
                    Jump
                  </button>
                  <div className="graph-mode-switch">
                    <button
                      type="button"
                      className={`graph-floating-button${graph.viewMode === 'intervention' ? ' graph-floating-button--active' : ''}`}
                      onClick={() => graph.updateGraphParam('graph_mode', null)}
                    >
                      Interventions
                    </button>
                    <button
                      type="button"
                      className={`graph-floating-button${graph.viewMode === 'structure' ? ' graph-floating-button--active' : ''}`}
                      onClick={() => graph.updateGraphParam('graph_mode', 'structure')}
                    >
                      Structure
                    </button>
                  </div>
                  {!isOverview && (
                    <button
                      type="button"
                      className="graph-floating-button"
                      onClick={() => graph.clearFocus()}
                    >
                      Back to overview
                    </button>
                  )}
                </div>
                {densityGraph.hiddenReviewEdges > 0 && (
                  <div className="graph-density-note">
                    Showing {densityGraph.visibleReviewEdges} of {densityGraph.totalReviewEdges} review links at this zoom.
                  </div>
                )}
              </div>

              <div className={`graph-drawer${filtersOpen ? ' graph-drawer--open' : ''}`}>
                <div className="graph-drawer-panel" ref={filterDrawerRef}>
                  <div className="graph-drawer-header">
                    <div>
                      <div className="graph-drawer-title">Graph controls</div>
                      <div className="graph-drawer-subtitle">Filter the match map without shrinking the canvas.</div>
                    </div>
                    <button
                      type="button"
                      className="graph-drawer-close"
                      onClick={() => setFiltersOpen(false)}
                    >
                      Close
                    </button>
                  </div>

                  <div className="graph-filterbar">
                    {graph.viewMode === 'intervention' ? (
                      <>
                        <FilterGroup
                          label="Outcome"
                          value={graph.outcomeFilter}
                          options={[
                            ['all', 'All'],
                            ['saved_by_agent', 'Saved by agent'],
                            ['saved_by_human', 'Saved by human'],
                            ['still_blocked', 'Still blocked'],
                            ['rejected', 'Rejected'],
                            ['pending', 'Pending review'],
                          ]}
                          onChange={(value) => graph.updateGraphParam('graph_outcome', value === 'all' ? null : value)}
                        />

                        <FilterGroup
                          label="Actor"
                          value={graph.actorFilter}
                          options={[
                            ['all', 'Any'],
                            ['url_agent', 'URL agent'],
                            ['context_agent', 'Context agent'],
                            ['human', 'Human'],
                          ]}
                          onChange={(value) => graph.updateGraphParam('graph_actor', value === 'all' ? null : value)}
                        />

                        <FilterGroup
                          label="Impact"
                          value={graph.impactFilter}
                          options={[
                            ['all', 'Any'],
                            ['joined_group', 'Changed group'],
                            ['matched_company', 'Changed company'],
                            ['prevented_bad_match', 'Prevented bad match'],
                            ['no_change', 'No final change'],
                          ]}
                          onChange={(value) => graph.updateGraphParam('graph_impact', value === 'all' ? null : value)}
                        />
                      </>
                    ) : (
                      <FilterGroup
                        label="Edge kind"
                        value={graph.edgeKindFilter}
                        options={[
                          ['all', 'All'],
                          ['membership', 'Membership'],
                          ['assignment', 'Assignment'],
                          ['peer', 'Peer review'],
                          ['to_master', 'Company review'],
                        ]}
                        onChange={(value) => graph.updateGraphParam('graph_edge_kind', value === 'all' ? null : value)}
                      />
                    )}

                    <FilterGroup
                      label="Raw status"
                      value={graph.rawStatusFilter}
                      options={[
                        ['all', 'All'],
                        ['matched', 'Matched'],
                        ['needs_review', 'Needs review'],
                        ['blocked', 'Blocked'],
                        ['resolved', 'Resolved'],
                        ['rejected', 'Rejected'],
                        ['no_match', 'No match'],
                        ['parent_processing', 'Parent processing'],
                      ]}
                      onChange={(value) => graph.updateGraphParam('graph_raw_status', value === 'all' ? null : value)}
                    />

                    <FilterGroup
                      label="Phase"
                      value={graph.phaseFilter}
                      options={[
                        ['all', 'All'],
                        ['main', 'Main'],
                        ['parent_processing', 'Parent processing'],
                      ]}
                      onChange={(value) => graph.updateGraphParam('graph_phase', value === 'all' ? null : value)}
                    />

                    {graph.viewMode === 'intervention' && (
                      <FilterGroup
                        label="Edge kind"
                        value={graph.edgeKindFilter}
                        options={[
                          ['all', 'All'],
                          ['peer', 'Peer review'],
                          ['to_master', 'Company review'],
                          ['membership', 'Membership'],
                          ['assignment', 'Assignment'],
                        ]}
                        onChange={(value) => graph.updateGraphParam('graph_edge_kind', value === 'all' ? null : value)}
                      />
                    )}

                    <div className="graph-filter-actions">
                      <button
                        type="button"
                        className="graph-filter-button graph-filter-button--ghost"
                        onClick={resetGraphFilters}
                      >
                        Reset filters
                      </button>
                    </div>
                  </div>

                  <div className="graph-legendbar graph-legendbar--drawer">
                    <span className="graph-legend-title">
                      {graph.viewMode === 'intervention' ? 'Intervention guide' : 'Edge guide'}
                    </span>
                    <div className="graph-legend-items">
                      {graph.viewMode === 'intervention' ? (
                        <>
                          <EdgeLegendItem tone="positive" label="Saved by agent" />
                          <EdgeLegendItem tone="info" label="Saved by human" />
                          <EdgeLegendItem tone="warning" label="Still blocked or pending" />
                          <EdgeLegendItem tone="danger" dashed label="Rejected path" />
                        </>
                      ) : (
                        <>
                          <EdgeLegendItem tone="info" label="Grouped overview link" />
                          <EdgeLegendItem tone="positive" label="Matched path" />
                          <EdgeLegendItem tone="warning" label="Blocked or review-needed path" />
                          <EdgeLegendItem tone="danger" dashed label="Rejected review edge" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`graph-jump-palette${jumpOpen ? ' graph-jump-palette--open' : ''}`}>
                <div className="graph-jump-panel" ref={jumpPanelRef}>
                  <div className="graph-jump-header">
                    <div>
                      <div className="graph-jump-title">Jump to item</div>
                      <div className="graph-jump-subtitle">
                        Search visible records, match groups, and companies.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="graph-drawer-close"
                      onClick={() => setJumpOpen(false)}
                    >
                      Close
                    </button>
                  </div>

                  <div className="graph-jump-search">
                    <input
                      ref={jumpInputRef}
                      autoFocus={jumpOpen}
                      className="graph-jump-input"
                      value={jumpQuery}
                      onChange={(event) => setJumpQuery(event.target.value)}
                      placeholder="Search by name, module, ID, or status…"
                    />
                    <span className="graph-jump-shortcut">Ctrl/Cmd + K</span>
                  </div>

                  <div className="graph-jump-list">
                    {jumpTargets.length === 0 ? (
                      <div className="graph-jump-empty">
                        No visible items match this search. Try a shorter query or adjust filters.
                      </div>
                    ) : (
                      jumpTargets.map((target) => (
                        <button
                          key={target.id}
                          type="button"
                          className="graph-jump-item"
                          onClick={() => jumpToNode(target.node)}
                        >
                          <div className="graph-jump-item-top">
                            <span className={`graph-jump-kind graph-jump-kind--${target.kind}`}>
                              {jumpKindLabel(target.kind)}
                            </span>
                            <span className="graph-jump-status">{target.statusLabel}</span>
                          </div>
                          <div className="graph-jump-name">{target.title}</div>
                          <div className="graph-jump-meta">{target.subtitle}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="graph-canvas-nav">
                <button type="button" className="graph-floating-button" onClick={() => jumpToLane('source')}>
                  Records
                </button>
                <button type="button" className="graph-floating-button" onClick={() => jumpToLane('cluster')}>
                  Match Groups
                </button>
                <button type="button" className="graph-floating-button" onClick={() => jumpToLane('master')}>
                  Companies
                </button>
                <button
                  type="button"
                  className="graph-floating-button"
                  onClick={() => flowInstance?.fitView({ padding: 0.22, duration: 300, minZoom: 0.55 })}
                >
                  Fit
                </button>
                {(selectedNode || graph.focusId) && (
                  <button
                    type="button"
                    className="graph-floating-button graph-floating-button--active"
                    onClick={jumpToSelection}
                  >
                    Selection
                  </button>
                )}
              </div>

              {graphQuery.isLoading ? (
                <div className="loading-state">
                  <div className="loading-spinner" />
                  loading match map…
                </div>
              ) : graphQuery.isError ? (
                <div className="error-state">
                  <span>⚠</span>
                  Failed to load graph data
                </div>
              ) : !hasFilteredResults ? (
                <div className="graph-filter-empty-state">
                  <span className="graph-filter-empty-icon">◌</span>
                  <h3>No graph items match these filters</h3>
                  <p>Try resetting the current filters, or switch back to overview to see the broader match map again.</p>
                  <div className="graph-filter-empty-actions">
                    <button
                      type="button"
                      className="graph-filter-button graph-filter-button--active"
                      onClick={resetGraphFilters}
                    >
                      Reset filters
                    </button>
                    {!isOverview && (
                      <button
                        type="button"
                        className="graph-filter-button graph-filter-button--ghost"
                        onClick={() => {
                          resetGraphFilters();
                          graph.clearFocus();
                        }}
                      >
                        Back to overview
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <ReactFlow
                  fitView
                  fitViewOptions={{ padding: 0.22, minZoom: 0.55 }}
                  nodes={flowNodes}
                  edges={flowEdges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                  elevateEdgesOnSelect={false}
                  minZoom={0.45}
                  maxZoom={1.35}
                  className="graph-flow"
                  proOptions={{ hideAttribution: true }}
                  onNodeClick={(_event, node) => {
                    setSelectedEdgeId(null);
                    const graphNode = node.data.node;
                    if (graphNode.focus_target_kind && graphNode.focus_target_id) {
                      graph.setFocus(graphNode.focus_target_kind, graphNode.focus_target_id);
                    }
                  }}
                  onPaneClick={() => {
                    setSelectedEdgeId(null);
                  }}
                  onInit={(instance: ReactFlowInstance) => {
                    setFlowInstance(instance);
                    setZoomTier(deriveZoomTier(instance.getZoom()));
                  }}
                  onMoveEnd={(_event, viewport) => {
                    setZoomTier(deriveZoomTier(viewport.zoom));
                  }}
                >
                  <Background color="rgba(120, 136, 170, 0.2)" gap={22} size={1} />
                  <MiniMap
                    position="bottom-right"
                    pannable
                    zoomable
                    className="graph-minimap"
                    nodeColor={(node) => toneColor((node.data as GraphNodeData).node.status_tone)}
                    maskColor="rgba(4, 7, 12, 0.6)"
                  />
                  <Controls showInteractive={false} position="bottom-left" />
                </ReactFlow>
              )}
            </div>
          </section>

          <aside className="graph-inspector">
            <GraphSidebarSummary
              graph={graph}
              snapshot={snapshot}
              selection={inspectorSelection}
            />
            <GraphInspector
              selection={inspectorSelection}
              isLoading={
                sourceDetailQuery.isLoading
                || clusterDetailQuery.isLoading
                || masterDetailQuery.isLoading
                || edgeDetailQuery.isLoading
              }
              onOpenReviewCase={openReviewCase}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function GraphSidebarSummary({
  graph,
  snapshot,
  selection,
}: {
  graph: ReturnType<typeof useGraphViewState>;
  snapshot: GraphSnapshot | undefined;
  selection: InspectorSelection;
}) {
  const stats = snapshot?.stats ?? {};
  return (
    <div className="graph-sidebar-summary">
      <div className="graph-sidebar-summary-head">
        <div>
          <div className="graph-sidebar-summary-title">Match map</div>
          <div className="graph-sidebar-summary-subtitle">
            {graph.viewMode === 'intervention' ? 'Interventions' : 'Structure'}
            {selection && ` · ${selection.kind === 'edge' ? 'review edge' : selection.kind}`}
          </div>
        </div>
      </div>
      <div className="graph-sidebar-stats">
        <div className="graph-sidebar-stat">
          <span>Records</span>
          <strong>{stats.source_count ?? 0}</strong>
        </div>
        <div className="graph-sidebar-stat">
          <span>Match groups</span>
          <strong>{stats.cluster_count ?? 0}</strong>
        </div>
        <div className="graph-sidebar-stat">
          <span>Companies</span>
          <strong>{stats.master_count ?? 0}</strong>
        </div>
        <div className="graph-sidebar-stat">
          <span>Agent saved</span>
          <strong>{stats.saved_by_agent_count ?? 0}</strong>
        </div>
        <div className="graph-sidebar-stat">
          <span>Human saved</span>
          <strong>{stats.saved_by_human_count ?? 0}</strong>
        </div>
        <div className="graph-sidebar-stat">
          <span>Pending</span>
          <strong>{stats.pending_review_count ?? 0}</strong>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="graph-filter-group">
      <span className="graph-filter-label">{label}</span>
      <div className="graph-filter-options">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            className={`graph-filter-button${value === optionValue ? ' graph-filter-button--active' : ''}`}
            onClick={() => onChange(optionValue)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function EdgeLegendItem({
  tone,
  label,
  dashed = false,
}: {
  tone: GraphTone;
  label: string;
  dashed?: boolean;
}) {
  return (
    <div className="graph-legend-item">
      <span
        className={`graph-legend-swatch graph-legend-swatch--${tone}${dashed ? ' graph-legend-swatch--dashed' : ''}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}

function GraphInspector({
  selection,
  isLoading,
  onOpenReviewCase,
}: {
  selection: InspectorSelection;
  isLoading: boolean;
  onOpenReviewCase: (reviewCaseId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="graph-inspector-empty">
        <div className="loading-spinner" />
        loading details…
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="graph-inspector-empty">
        <span className="graph-inspector-icon">◌</span>
        <p>Click a card to focus its neighborhood. The sidebar will explain what happened first, then offer deeper evidence and technical detail when you need it.</p>
      </div>
    );
  }

  if (selection.kind === 'source') {
    const detail = selection.detail;
    const identifiers: DetailField[] = [
      { label: 'Record', value: selection.node.title },
      { label: 'Trace ID', value: String(selection.node.meta.source_trace_id || '—') },
      { label: 'Module', value: String(selection.node.meta.source_module || '—') },
      { label: 'Unique ID', value: String(selection.node.meta.source_unique_id || '—') },
      { label: 'Match group', value: String(selection.node.meta.cluster_id || '—') },
      { label: 'Company ID', value: String(selection.node.meta.assigned_entity_id || '—') },
    ];
    const decisionFields: DetailField[] = [
      { label: 'Outcome', value: selection.node.status_label || 'Needs review' },
      { label: 'Assignment kind', value: asText(detail?.assignment?.assignment_kind || detail?.assignment_kind) },
      { label: 'Candidates', value: String(detail?.candidate_count ?? selection.node.member_count) },
      { label: 'Edges evaluated', value: String(detail?.total_edge_count ?? 0) },
      { label: 'Anomalies', value: String(detail?.anomaly_count ?? selection.node.anomaly_count) },
    ];
    const auditFields: DetailField[] = [
      { label: 'Audit entries', value: String(detail?.audit.length ?? 0) },
      {
        label: 'Agent-reviewed edges',
        value: String(
          detail?.edge_details.filter((edge) => edge.agent_decision || edge.resolution_route).length ?? 0,
        ),
      },
    ];
    const lineageFields: DetailField[] = [
      { label: 'Lineage records', value: String(detail?.lineage.length ?? 0) },
      {
        label: 'Targets',
        value:
          detail?.lineages_target_record_ids.length
            ? detail.lineages_target_record_ids.slice(0, 4).join(', ')
            : '—',
      },
    ];

    return (
      <InspectorLayout
        eyebrow="Record"
        title={selection.node.title}
        subtitle={selection.node.subtitle || undefined}
        statusLabel={selection.node.status_label || 'Needs review'}
        tone={selection.node.status_tone}
      >
        <InspectorSection title="What happened">
          <p>
            {detail?.source_entity_name || selection.node.title} finished as{' '}
            <strong>{selection.node.status_label || 'Needs review'}</strong>
            {detail?.assigned_entity_name ? ` and currently points to ${detail.assigned_entity_name}.` : '.'}
          </p>
        </InspectorSection>

        <InspectorSection title="What changed">
          <p>
            {asText(detail?.assignment?.assignment_reason)
              || 'This record view summarizes the final outcome, the size of the candidate set, and any anomaly or audit evidence attached to the decision.'}
          </p>
        </InspectorSection>

        <InspectorSection title="Evidence">
          <MetricList
            items={[
              ['Candidates', String(detail?.candidate_count ?? 0)],
              ['Matched candidates', String(detail?.matched_candidate_count ?? 0)],
              ['Anomalies', String(detail?.anomaly_count ?? selection.node.anomaly_count)],
              ['Lineage records', String(detail?.lineage.length ?? 0)],
            ]}
          />
        </InspectorSection>

        <InspectorSection title="Related items">
          <RelatedList
            items={[
              detail?.cluster?.cluster_id ? `Match group ${detail.cluster.cluster_id}` : null,
              detail?.master?.entity_name ? `Company ${detail.master.entity_name}` : null,
              ...(detail?.anomalies.slice(0, 3).map((item) => item.anomaly_type) ?? []),
            ]}
          />
        </InspectorSection>

        <TechnicalDetails
          identifiers={identifiers}
          decisionFields={decisionFields}
          auditFields={auditFields}
          lineageFields={lineageFields}
          rawPayload={{
            source: detail?.source ?? selection.node.meta,
            assignment: detail?.assignment ?? {},
            derived_enrichment: detail?.derived_enrichment ?? {},
            counts: detail?.counts ?? {},
          }}
        />
      </InspectorLayout>
    );
  }

  if (selection.kind === 'cluster') {
    const detail = selection.detail;
    const identifiers: DetailField[] = [
      { label: 'Match group', value: String(selection.node.meta.cluster_id || '—') },
      { label: 'Representative', value: String(selection.node.meta.representative_source_trace_id || '—') },
      { label: 'Assigned company', value: String(selection.node.meta.assigned_entity_id || '—') },
      { label: 'Matched master', value: String(selection.node.meta.matched_master_id || '—') },
    ];
    const decisionFields: DetailField[] = [
      { label: 'Outcome', value: selection.node.status_label || 'Needs review' },
      { label: 'Assignment kind', value: asText(detail?.assignment_kind || selection.node.meta.assignment_kind) },
      { label: 'Records in group', value: String(detail?.members.length ?? selection.node.member_count) },
      { label: 'Anomalies', value: String(detail?.anomalies.length ?? selection.node.anomaly_count) },
      { label: 'Saved by agent', value: String(selection.node.saved_by_agent_count ?? 0) },
      { label: 'Saved by human', value: String(selection.node.saved_by_human_count ?? 0) },
      { label: 'Still blocked', value: String(selection.node.still_blocked_count ?? 0) },
    ];
    const auditFields: DetailField[] = [
      { label: 'Audit entries', value: String(detail?.audit.length ?? 0) },
      { label: 'Decision traces', value: String(detail?.decision_traces.length ?? 0) },
    ];

    return (
      <InspectorLayout
        eyebrow="Match Group"
        title={selection.node.title}
        subtitle={selection.node.subtitle || undefined}
        statusLabel={selection.node.status_label || 'Needs review'}
        tone={selection.node.status_tone}
      >
        <InspectorSection title="What happened">
          <p>
            This match group currently holds{' '}
            <strong>{detail?.members.length ?? selection.node.member_count}</strong> record
            {(detail?.members.length ?? selection.node.member_count) === 1 ? '' : 's'} and is marked as{' '}
            <strong>{selection.node.status_label || 'Needs review'}</strong>.
          </p>
        </InspectorSection>

        <InspectorSection title="What changed">
          <p>
            {selection.node.intervention_summary_label
              ? `${selection.node.intervention_summary_label} affected this group before its current assignment settled.`
              : detail?.assignment_kind
                ? `The current assignment path is ${detail.assignment_kind.replace(/_/g, ' ')}.`
                : 'This group is shown because it represents one visible decision neighborhood in the run.'}
          </p>
        </InspectorSection>

        <InspectorSection title="Evidence">
          <MetricList
            items={[
              ['Records', String(detail?.members.length ?? selection.node.member_count)],
              ['Anomalies', String(detail?.anomalies.length ?? 0)],
              ['Audit entries', String(detail?.audit.length ?? 0)],
              ['Decision traces', String(detail?.decision_traces.length ?? 0)],
              ['Agent saved', String(selection.node.saved_by_agent_count ?? 0)],
              ['Human saved', String(selection.node.saved_by_human_count ?? 0)],
              ['Blocked', String(selection.node.still_blocked_count ?? 0)],
            ]}
          />
        </InspectorSection>

        <InspectorSection title="Related items">
          <RelatedList
            items={[
              ...(detail?.members.slice(0, 5).map((member) => member.source_entity_name || member.source_unique_id || 'Record') ?? []),
            ]}
          />
        </InspectorSection>

        <TechnicalDetails
          identifiers={identifiers}
          decisionFields={decisionFields}
          auditFields={auditFields}
          lineageFields={[]}
          rawPayload={{
            cluster: detail ?? selection.node.meta,
          }}
        />
      </InspectorLayout>
    );
  }

  if (selection.kind === 'master') {
    const detail = selection.detail;
    const identifiers: DetailField[] = [
      { label: 'Company', value: detail?.entity_name || selection.node.title },
      { label: 'Entity ID', value: String(detail?.entity_id || selection.node.meta.entity_id || '—') },
      { label: 'URL', value: asText(detail?.entity_url || selection.node.meta.entity_url) },
      { label: 'Legal name', value: asText(detail?.legal_name) },
    ];
    const decisionFields: DetailField[] = [
      { label: 'Support records', value: String(detail?.support_source_records.length ?? selection.node.member_count) },
      { label: 'Support groups', value: String(detail?.support_clusters.length ?? 0) },
      { label: 'Industry', value: asText(detail?.industry) },
      { label: 'Headquarters', value: asText(detail?.headquarters) },
      { label: 'Saved by agent', value: String(selection.node.saved_by_agent_count ?? 0) },
      { label: 'Saved by human', value: String(selection.node.saved_by_human_count ?? 0) },
      { label: 'Still blocked', value: String(selection.node.still_blocked_count ?? 0) },
    ];

    return (
      <InspectorLayout
        eyebrow="Company"
        title={detail?.entity_name || selection.node.title}
        subtitle={detail?.entity_url || selection.node.subtitle || undefined}
        statusLabel={selection.node.status_label || 'Company'}
        tone={selection.node.status_tone}
      >
        <InspectorSection title="What happened">
          <p>
            This company currently has support from{' '}
            <strong>{detail?.support_source_records.length ?? selection.node.member_count}</strong> record
            {(detail?.support_source_records.length ?? selection.node.member_count) === 1 ? '' : 's'} in the selected run.
          </p>
        </InspectorSection>

        <InspectorSection title="What changed">
          <p>
            {selection.node.intervention_summary_label
              ? `${selection.node.intervention_summary_label} contributed to why support accumulated on this company.`
              : detail?.summary
                || 'The connected match groups in this run ultimately assigned into this company record.'}
          </p>
        </InspectorSection>

        <InspectorSection title="Evidence">
          <MetricList
            items={[
              ['Support records', String(detail?.support_source_records.length ?? selection.node.member_count)],
              ['Support groups', String(detail?.support_clusters.length ?? 0)],
              ['Aliases', String(detail?.aliases.length ?? 0)],
              ['Industry', detail?.industry || 'Unknown'],
              ['Agent saved', String(selection.node.saved_by_agent_count ?? 0)],
              ['Human saved', String(selection.node.saved_by_human_count ?? 0)],
            ]}
          />
        </InspectorSection>

        <InspectorSection title="Related items">
          <RelatedList
            items={[
              ...(detail?.support_source_records.slice(0, 5).map((record) => record.source_entity_name || record.source_unique_id || 'Record') ?? []),
            ]}
          />
        </InspectorSection>

        <TechnicalDetails
          identifiers={identifiers}
          decisionFields={decisionFields}
          auditFields={[]}
          lineageFields={[]}
          rawPayload={{
            company: detail ?? selection.node.meta,
          }}
        />
      </InspectorLayout>
    );
  }

  const detail = selection.detail;
  const isAggregateEdge = selection.edge.is_aggregate;
  const identifiers: DetailField[] = [
    { label: 'Edge', value: selection.edge.id },
    { label: 'Type', value: selection.edge.kind },
    { label: 'From', value: selection.edge.source },
    { label: 'To', value: selection.edge.target },
  ];
  const decisionFields: DetailField[] = [
    { label: 'Status', value: selection.edge.display_status || selection.edge.status || '—' },
    { label: 'Actor', value: interventionActorLabel(detail?.intervention_actor || selection.edge.intervention_actor) },
    { label: 'Outcome', value: interventionOutcomeLabel(detail?.intervention_outcome || selection.edge.intervention_outcome) },
    { label: 'Impact', value: outcomeEffectLabel(detail?.outcome_effect || selection.edge.outcome_effect) },
    { label: 'Links represented', value: String(selection.edge.edge_count || 0) },
    { label: 'Before review', value: asText(detail?.before_review_status || selection.edge.pre_review_status) },
    { label: 'After review', value: asText(detail?.after_review_status || selection.edge.post_review_status) },
    { label: 'Blocked reason', value: asText(detail?.blocked_reason || selection.edge.blocked_reason) },
  ];
  const auditFields: DetailField[] = [
    { label: 'Resolution route', value: asText(detail?.resolution_route || selection.edge.resolution_route) },
    { label: 'Agent decision', value: asText(detail?.agent_decision || selection.edge.agent_decision) },
    { label: 'Confidence', value: asText(detail?.agent_confidence || selection.edge.agent_confidence) },
    { label: 'Audit entries', value: String(detail?.audit.length ?? 0) },
    { label: 'Review case', value: asText(detail?.review_case_id || selection.edge.review_case_id) },
  ];
  const lineageFields: DetailField[] = [
    { label: 'Lineage records', value: String(detail?.lineage.length ?? 0) },
    { label: 'Anomalies', value: String(detail?.anomalies.length ?? 0) },
  ];

  return (
      <InspectorLayout
        eyebrow={isAggregateEdge ? 'Grouped link' : 'Review edge'}
        title={selection.edge.preview_label || selection.edge.kind}
        subtitle={selection.edge.display_status || undefined}
        statusLabel={selection.edge.display_status || 'Pending review'}
      tone={selection.edge.status_tone}
    >
      <InspectorSection title="What happened">
        <p>
          {isAggregateEdge
            ? `This grouped connector summarizes ${selection.edge.edge_count} underlying relationship${selection.edge.edge_count === 1 ? '' : 's'} in the overview.`
            : detail?.narrative_summary
              || selection.edge.decision_summary
              || `This review edge is marked ${selection.edge.display_status || 'Pending review'}.`}
        </p>
      </InspectorSection>

      <InspectorSection title="Who intervened">
        <p>
          {isAggregateEdge
            ? 'Grouped links keep the overview readable. Drill into the connected card to see the actual record-level neighborhood.'
            : `${interventionActorLabel(detail?.intervention_actor || selection.edge.intervention_actor)} made the decisive intervention on this path.`}
        </p>
      </InspectorSection>

      <InspectorSection title="What changed">
        <p>
          {isAggregateEdge
            ? 'This connector is structural context only.'
            : `${interventionOutcomeLabel(detail?.intervention_outcome || selection.edge.intervention_outcome)} with impact ${outcomeEffectLabel(detail?.outcome_effect || selection.edge.outcome_effect)}.`}
        </p>
      </InspectorSection>

      <InspectorSection title="Why">
        <p>
          {isAggregateEdge
            ? 'Grouped links keep the overview readable. Drill into the connected card to see the actual record-level neighborhood.'
            : asText(detail?.agent_reason || detail?.resolution_route || selection.edge.blocked_reason || selection.edge.agent_badge)
              || 'This relationship needed additional evaluation before the decision could be trusted.'}
        </p>
      </InspectorSection>

      <InspectorSection title="Evidence">
        <MetricList
          items={[
            ['Links represented', String(selection.edge.edge_count || 0)],
            ['Audit entries', String(detail?.audit.length ?? 0)],
            ['Anomalies', String(detail?.anomalies.length ?? 0)],
            ['Lineage records', String(detail?.lineage.length ?? 0)],
            ['Review events', String(detail?.review_events.length ?? 0)],
            ['Changed final outcome', detail?.changed_final_outcome ? 'Yes' : 'No'],
          ]}
        />
      </InspectorSection>

      <InspectorSection title="Related items">
        <RelatedList
          items={[
            detail?.source_record?.source_entity_name || detail?.source_record?.source_unique_id || null,
            detail?.target_source_record?.source_entity_name || detail?.target_source_record?.source_unique_id || null,
            detail?.target_master?.entity_name || null,
          ]}
        />
      </InspectorSection>

      {(detail?.review_case_id || selection.edge.review_case_id) && (
        <InspectorSection title="Review">
          <button
            type="button"
            className="detail-action-button"
            onClick={() => onOpenReviewCase(String(detail?.review_case_id || selection.edge.review_case_id || ''))}
          >
            Open in Review
          </button>
        </InspectorSection>
      )}

      <TechnicalDetails
        identifiers={identifiers}
        decisionFields={decisionFields}
        auditFields={auditFields}
        lineageFields={lineageFields}
        rawPayload={{
          edge: detail ?? selection.edge,
        }}
      />
    </InspectorLayout>
  );
}

function InspectorLayout({
  eyebrow,
  title,
  subtitle,
  statusLabel,
  tone,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  statusLabel: string;
  tone: GraphTone;
  children: ReactNode;
}) {
  return (
    <div className="graph-inspector-shell">
      <header className="graph-inspector-header">
        <div className="graph-inspector-eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
        <span className={`graph-status-pill ${classForTone(tone)}`}>{statusLabel}</span>
      </header>
      <div className="graph-inspector-scroll">{children}</div>
    </div>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="graph-inspector-section">
      <div className="graph-inspector-section-title">{title}</div>
      {children}
    </section>
  );
}

function MetricList({ items }: { items: [string, string][] }) {
  return (
    <div className="graph-inspector-metrics">
      {items.map(([label, value]) => (
        <div key={label} className="graph-inspector-metric">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function RelatedList({ items }: { items: Array<string | null | undefined> }) {
  const filtered = items.filter(Boolean) as string[];
  if (filtered.length === 0) {
    return <p className="graph-related-empty">No related items surfaced for this selection.</p>;
  }
  return (
    <div className="graph-related-list">
      {filtered.map((item) => (
        <span key={item} className="graph-related-pill">
          {item}
        </span>
      ))}
    </div>
  );
}

function TechnicalDetails({
  identifiers,
  decisionFields,
  auditFields,
  lineageFields,
  rawPayload,
}: {
  identifiers: DetailField[];
  decisionFields: DetailField[];
  auditFields: DetailField[];
  lineageFields: DetailField[];
  rawPayload: Record<string, unknown>;
}) {
  return (
    <section className="graph-inspector-section">
      <div className="graph-inspector-section-title">Technical details</div>
      <div className="graph-technical-stack">
        <TechnicalAccordion title="Identifiers" defaultOpen>
          <FieldTable fields={identifiers} />
        </TechnicalAccordion>
        <TechnicalAccordion title="Decision fields" defaultOpen>
          <FieldTable fields={decisionFields} />
        </TechnicalAccordion>
        {auditFields.length > 0 && (
          <TechnicalAccordion title="Audit / agent data">
            <FieldTable fields={auditFields} />
          </TechnicalAccordion>
        )}
        {lineageFields.length > 0 && (
          <TechnicalAccordion title="Lineage">
            <FieldTable fields={lineageFields} />
          </TechnicalAccordion>
        )}
        <TechnicalAccordion title="Raw payload">
          <pre>{JSON.stringify(rawPayload, null, 2)}</pre>
        </TechnicalAccordion>
      </div>
    </section>
  );
}

function TechnicalAccordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="graph-technical" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="graph-technical-body">{children}</div>
    </details>
  );
}

function FieldTable({ fields }: { fields: DetailField[] }) {
  return (
    <div className="graph-field-table">
      {fields.map((field) => (
        <div key={field.label} className="graph-field-row">
          <span className="graph-field-label">{field.label}</span>
          <span className="graph-field-value">{field.value}</span>
        </div>
      ))}
    </div>
  );
}

function buildJumpTargets(nodes: InsightsGraphNode[], query: string): JumpTarget[] {
  const normalized = query.trim().toLowerCase();
  return nodes
    .map((node) => {
      const title = node.title || node.label || node.id;
      const subtitle = [node.subtitle, node.id, node.status_label]
        .filter(Boolean)
        .join(' · ');
      const haystack = [
        title,
        subtitle,
        node.label,
        node.id,
        node.status_label,
        stringifyMeta(node.meta.source_module),
        stringifyMeta(node.meta.source_unique_id),
        stringifyMeta(node.meta.cluster_id),
        stringifyMeta(node.meta.entity_id),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const score = normalized ? rankJumpTarget(haystack, title.toLowerCase(), normalized) : 1;
      return {
        id: node.id,
        title,
        subtitle: subtitle || jumpKindLabel(node.kind),
        kind: node.kind,
        statusLabel: node.status_label || 'Selection',
        score,
        node,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 24);
}

function rankJumpTarget(haystack: string, title: string, query: string) {
  if (!query) return 1;
  if (title === query) return 10;
  if (title.startsWith(query)) return 8;
  if (haystack.includes(query)) return 5;
  const parts = query.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((part) => haystack.includes(part))) return 3;
  return 0;
}

function jumpKindLabel(kind: InsightsGraphNode['kind']) {
  switch (kind) {
    case 'source':
      return 'Record';
    case 'cluster':
      return 'Match Group';
    case 'master':
      return 'Company';
    default:
      return 'Item';
  }
}

function stringifyMeta(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function buildFlowNodes(
  nodes: InsightsGraphNode[],
  mode: 'overview' | 'focus',
  zoomTier: ZoomTier,
): Array<FlowNode<GraphNodeData>> {
  const grouped = {
    source: [] as InsightsGraphNode[],
    cluster: [] as InsightsGraphNode[],
    master: [] as InsightsGraphNode[],
  };

  for (const node of nodes) {
    grouped[node.kind].push(node);
  }

  return (['source', 'cluster', 'master'] as const).flatMap((kind) => {
    let currentY = NODE_TOP_OFFSET;

    return grouped[kind].map((node) => {
      const height = estimateNodeHeight(node, zoomTier);
      const flowNode: FlowNode<GraphNodeData> = {
        id: node.id,
        type: resolveNodeType(node, mode),
        position: {
          x: COLUMN_X[kind],
          y: currentY,
        },
        data: {
          node,
          zoomTier,
          mode,
        },
        draggable: false,
        selectable: true,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: { width: NODE_WIDTH, height, minHeight: height },
      };
      currentY += height + NODE_GAP;
      return flowNode;
    });
  });
}

function buildFlowEdges({
  edges,
  mode,
  viewMode,
  zoomTier,
  density,
  selectedEdgeId,
  focusKind,
  focusId,
  onSelect,
}: {
  edges: InsightsGraphEdge[];
  mode: 'overview' | 'focus';
  viewMode: 'intervention' | 'structure';
  zoomTier: ZoomTier;
  density: GraphDensityResult;
  selectedEdgeId?: string | null;
  focusKind?: 'source_record' | 'cluster' | 'master' | 'edge' | null;
  focusId?: string | null;
  onSelect: (edge: InsightsGraphEdge) => void;
}) {
  return edges.map<FlowEdge<GraphEdgeData>>((edge) => ({
    id: edge.id,
    type:
      mode === 'overview'
        ? 'overviewAggregate'
        : edge.kind === 'peer' || edge.kind === 'to_master'
          ? 'focusReview'
          : 'focusConnector',
    source: edge.source,
    target: edge.target,
    animated:
      mode === 'focus'
      && shouldAnimateReviewEdge(edge, density, selectedEdgeId, focusKind, focusId),
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: toneColor(edge.status_tone),
    },
    data: {
      edge,
      zoomTier,
      mode,
      viewMode,
      densityMode: density.densityMode,
      onSelect,
    },
  }));
}

function resolveNodeType(node: InsightsGraphNode, mode: 'overview' | 'focus') {
  if (mode === 'overview') {
    if (node.kind === 'source') return 'overviewRecord';
    if (node.kind === 'cluster') return 'overviewGroup';
    return 'overviewCompany';
  }
  if (node.kind === 'source') return 'focusRecord';
  if (node.kind === 'cluster') return 'focusGroup';
  return 'focusCompany';
}

function deriveZoomTier(zoom: number): ZoomTier {
  if (zoom < 0.72) return 'far';
  if (zoom < 0.98) return 'mid';
  return 'near';
}

function estimateNodeHeight(node: InsightsGraphNode, zoomTier: ZoomTier) {
  const isMid = zoomTier !== 'far';
  const visibleBadges = node.badges.filter((badge) => !isRedundantNodeBadge(badge.label, node.subtitle));
  const visibleStats = node.preview_metrics.filter((metric) => !isRedundantStat(metric.label, metric.value));
  let height = NODE_MIN_HEIGHT;

  height += estimateWrappedTextExtra(node.title, 18, 28);

  if (isMid && node.subtitle) {
    height += 24;
    height += estimateWrappedTextExtra(node.subtitle, 30, 18);
  }

  if (isMid && visibleBadges.length > 0) {
    const shownBadgeCount = Math.min(visibleBadges.length, zoomTier === 'near' ? 2 : 1);
    height += Math.ceil(shownBadgeCount / 2) * 24;
  }

  if (isMid && node.overflow_count > 0) {
    height += 24;
  }

  if (isMid && visibleStats.length > 0) {
    const shownStatCount = Math.min(visibleStats.length, zoomTier === 'near' ? 3 : 2);
    height += zoomTier === 'near' && shownStatCount >= 3 ? 56 : 38;
  }

  return Math.max(NODE_MIN_HEIGHT, height);
}

function estimateWrappedTextExtra(text: string | null | undefined, charsPerLine: number, lineHeight: number) {
  if (!text) return 0;
  const normalized = text.trim();
  if (!normalized) return 0;
  const lineCount = Math.max(1, Math.ceil(normalized.length / charsPerLine));
  return Math.max(0, lineCount - 1) * lineHeight;
}

function toneColor(tone: GraphTone) {
  switch (tone) {
    case 'positive':
      return '#23b26d';
    case 'warning':
      return '#e3a428';
    case 'danger':
      return '#d4555f';
    case 'info':
      return '#4f8df7';
    case 'muted':
      return '#708198';
    default:
      return '#9fb0c5';
  }
}

function edgeStrokeColor(
  edge: InsightsGraphEdge | undefined,
  viewMode: 'intervention' | 'structure',
) {
  if (!edge) return toneColor('neutral');
  if (viewMode === 'intervention') {
    if (edge.intervention_kind === 'human') return '#4f8df7';
    if (edge.intervention_outcome === 'saved') return '#23b26d';
    if (edge.intervention_outcome === 'rejected') return '#d4555f';
    if (edge.intervention_outcome === 'pending' || edge.intervention_outcome === 'still_blocked') {
      return '#e3a428';
    }
    if (edge.kind === 'membership' || edge.kind === 'assignment') return 'rgba(159, 176, 197, 0.45)';
  }
  return toneColor(edge.status_tone || 'neutral');
}

function edgeStrokeWidth(
  edge: InsightsGraphEdge | undefined,
  variant: 'overview' | 'focus' | 'review',
  viewMode: 'intervention' | 'structure',
) {
  if (viewMode === 'intervention' && edge && edge.intervention_kind !== 'none') {
    return variant === 'review' ? 3.2 : 2.8;
  }
  return variant === 'overview' ? 2.4 : variant === 'review' ? 2.6 : 2.2;
}

function edgeStrokeDash(
  edge: InsightsGraphEdge | undefined,
  variant: 'overview' | 'focus' | 'review',
  viewMode: 'intervention' | 'structure',
) {
  if (!edge) return undefined;
  if (viewMode === 'intervention') {
    if (edge.intervention_kind === 'human') return '2 0';
    if (edge.intervention_outcome === 'rejected') return '4 7';
    if (edge.intervention_outcome === 'pending' || edge.intervention_outcome === 'still_blocked') {
      return '10 6';
    }
    if (edge.kind === 'membership' || edge.kind === 'assignment') return '3 8';
  }
  if (variant !== 'review') return undefined;
  if (edge.status === 'resolved') return '7 6';
  if (edge.status === 'rejected') return '4 7';
  if (edge.status === 'blocked') return '10 6';
  return '7 6';
}

function edgeOpacity(
  edge: InsightsGraphEdge | undefined,
  variant: 'overview' | 'focus' | 'review',
  viewMode: 'intervention' | 'structure',
  densityMode: GraphDensityResult['densityMode'],
) {
  if (viewMode === 'intervention' && edge && (edge.kind === 'membership' || edge.kind === 'assignment')) {
    return variant === 'overview' ? 0.32 : 0.42;
  }
  return variant === 'overview' ? 0.8 : densityMode === 'capped' ? 0.9 : 1;
}

function asText(value: unknown) {
  if (value == null || value === '') return '—';
  return String(value);
}

function interventionActorLabel(value: string | null | undefined) {
  switch (value) {
    case 'human':
      return 'Human review';
    case 'url_agent':
      return 'URL agent';
    case 'context_agent':
      return 'Context agent';
    case 'agent':
      return 'Agent review';
    default:
      return 'No explicit reviewer';
  }
}

function interventionOutcomeLabel(value: string | null | undefined) {
  switch (value) {
    case 'saved':
      return 'Saved';
    case 'rejected':
      return 'Rejected';
    case 'pending':
      return 'Pending review';
    case 'still_blocked':
      return 'Still blocked';
    default:
      return 'No intervention';
  }
}

function outcomeEffectLabel(value: string | null | undefined) {
  switch (value) {
    case 'joined_group':
      return 'Changed group';
    case 'matched_company':
      return 'Changed company';
    case 'prevented_bad_match':
      return 'Prevented bad match';
    default:
      return 'No final change';
  }
}

function isRedundantNodeBadge(label: string, subtitle?: string | null) {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'record') return true;
  if (subtitle && normalized === subtitle.trim().toLowerCase()) return true;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) return true;
  if (/^\d+/.test(normalized) && /(record|records|anomaly|anomalies|group|groups|company|companies)$/.test(normalized)) {
    return true;
  }
  return false;
}

function isRedundantStat(label: string, value: string) {
  const normalizedLabel = label.trim().toLowerCase();
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedLabel) return true;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedValue)) return true;
  return false;
}
