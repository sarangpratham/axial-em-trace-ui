import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MarkerType, MiniMap, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TraceDetail } from '../types';

const nodeColors: Record<string, string> = {
  source: '#0f172a',
  enrichment: '#d97706',
  search: '#2563eb',
  winner: '#0f766e',
  outcome: '#7c3aed',
};

export function DecisionGraph({ detail }: { detail: TraceDetail }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = detail.graph.nodes.map((node, index) => ({
      id: node.id,
      position: { x: 220 * index, y: 100 + ((index % 2) * 80) },
      data: { label: node.label },
      style: {
        borderRadius: 18,
        padding: 12,
        color: 'white',
        border: 'none',
        background: nodeColors[node.type] || '#475569',
        minWidth: 180,
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
      },
    }));
    const edges: Edge[] = detail.graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    }));
    return { nodes, edges };
  }, [detail.graph.edges, detail.graph.nodes]);

  return (
    <div className="graph-shell">
      <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} elementsSelectable={false} panOnDrag>
        <MiniMap zoomable pannable />
        <Controls showInteractive={false} />
        <Background gap={18} color="#e2e8f0" />
      </ReactFlow>
    </div>
  );
}
