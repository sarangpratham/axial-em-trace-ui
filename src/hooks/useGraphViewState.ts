import { useSearchParams } from 'react-router-dom';
import type { GraphFocusKind } from '../types';
import type { TraceExplorerState } from './useTraceExplorerState';

export type GraphViewState = ReturnType<typeof useGraphViewState>;

export function useGraphViewState(explorer: TraceExplorerState) {
  const [params, setParams] = useSearchParams();

  const viewMode = (params.get('graph_mode') as 'intervention' | 'structure' | null) ?? 'intervention';
  const focusKind = (params.get('graph_focus_kind') as GraphFocusKind | null) ?? null;
  const focusId = params.get('graph_focus_id');
  const outcomeFilter = params.get('graph_outcome') ?? 'all';
  const actorFilter = params.get('graph_actor') ?? 'all';
  const impactFilter = params.get('graph_impact') ?? 'all';
  const edgeKindFilter = params.get('graph_edge_kind') ?? 'all';
  const rawStatusFilter = params.get('graph_raw_status') ?? 'all';
  const phaseFilter = params.get('graph_phase') ?? 'all';

  const updateGraphParam = (key: string, value?: string | null) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const clearFocus = () => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('graph_focus_kind');
      next.delete('graph_focus_id');
      return next;
    });
  };

  const setFocus = (kind: GraphFocusKind, id: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('graph_focus_kind', kind);
      next.set('graph_focus_id', id);
      return next;
    });
  };

  return {
    params,
    runId: explorer.selectedRunId,
    selectedModule: explorer.selectedModule,
    selectedUniqueId: explorer.selectedUniqueId,
    viewMode,
    focusKind,
    focusId,
    outcomeFilter,
    actorFilter,
    impactFilter,
    edgeKindFilter,
    rawStatusFilter,
    phaseFilter,
    updateGraphParam,
    clearFocus,
    setFocus,
  };
}
