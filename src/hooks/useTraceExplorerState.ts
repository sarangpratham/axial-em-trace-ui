import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getRunSummary, getRuns, getTraceDetail, getTraces } from '../lib/api';
import type { TraceSummary } from '../types';

export type TraceExplorerState = ReturnType<typeof useTraceExplorerState>;

export function useTraceExplorerState() {
  const [params, setParams] = useSearchParams();
  const [jsonOpen, setJsonOpen] = useState(false);
  const searchInput = params.get('q') ?? '';
  const deferredSearch = useDeferredValue(searchInput);

  const runsQuery = useQuery({ queryKey: ['runs'], queryFn: getRuns });
  const selectedRunId = params.get('run_id') ?? runsQuery.data?.[0] ?? '';
  const moduleFilter = params.get('module') ?? '';
  const statusFilter = params.get('final_status') ?? '';
  const originFilter = params.get('winner_origin') ?? '';
  const anomalyPresenceParam = params.get('has_anomalies');
  const anomalyTypeFilter = params.get('anomaly_type') ?? '';
  const selectedModule = params.get('selected_module') ?? '';
  const selectedUniqueId = params.get('selected_unique_id') ?? '';
  const anomalyPresenceFilter =
    anomalyTypeFilter || anomalyPresenceParam === 'true'
      ? 'with'
      : anomalyPresenceParam === 'false'
        ? 'clean'
        : 'all';

  useEffect(() => {
    if (!selectedRunId && runsQuery.data?.[0]) {
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set('run_id', runsQuery.data[0]);
        return next;
      });
    }
  }, [runsQuery.data, selectedRunId, setParams]);

  const summaryQuery = useQuery({
    queryKey: ['summary', selectedRunId],
    queryFn: () => getRunSummary(selectedRunId),
    enabled: Boolean(selectedRunId),
  });

  const tracesQuery = useQuery({
    queryKey: [
      'traces',
      selectedRunId,
      moduleFilter,
      statusFilter,
      originFilter,
      deferredSearch,
      anomalyPresenceParam,
      anomalyTypeFilter,
    ],
    queryFn: () =>
      getTraces({
        runId: selectedRunId,
        module: moduleFilter || undefined,
        finalStatus: statusFilter || undefined,
        winnerOrigin: originFilter || undefined,
        query: deferredSearch || undefined,
        hasAnomalies:
          anomalyPresenceFilter === 'with'
            ? true
            : anomalyPresenceFilter === 'clean'
              ? false
              : undefined,
        anomalyType: anomalyTypeFilter || undefined,
      }),
    enabled: Boolean(selectedRunId),
  });

  const availableAnomalyTypes = useMemo(() => {
    const entries = Object.entries(summaryQuery.data?.anomaly_by_type ?? {});
    return entries.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }, [summaryQuery.data?.anomaly_by_type]);

  useEffect(() => {
    if (!anomalyTypeFilter) return;
    if (availableAnomalyTypes.some(([type]) => type === anomalyTypeFilter)) return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('anomaly_type');
      if (next.get('has_anomalies') === 'true') next.delete('has_anomalies');
      return next;
    });
  }, [anomalyTypeFilter, availableAnomalyTypes, setParams]);

  const selectedTrace = useMemo(() => {
    return (
      tracesQuery.data?.find(
        (trace) =>
          trace.source_module === selectedModule &&
          trace.source_unique_id === selectedUniqueId,
      ) ?? tracesQuery.data?.[0]
    );
  }, [selectedModule, selectedUniqueId, tracesQuery.data]);

  useEffect(() => {
    if (!selectedTrace) return;
    if (
      selectedTrace.source_module === selectedModule &&
      selectedTrace.source_unique_id === selectedUniqueId
    ) {
      return;
    }
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('selected_module', selectedTrace.source_module);
      next.set('selected_unique_id', selectedTrace.source_unique_id);
      return next;
    });
  }, [selectedModule, selectedTrace, selectedUniqueId, setParams]);

  const detailQuery = useQuery({
    queryKey: [
      'trace-detail',
      selectedRunId,
      selectedTrace?.source_module,
      selectedTrace?.source_unique_id,
    ],
    queryFn: () =>
      getTraceDetail(
        selectedRunId,
        selectedTrace!.source_module,
        selectedTrace!.source_unique_id,
      ),
    enabled: Boolean(selectedRunId && selectedTrace),
  });

  const traces = tracesQuery.data ?? [];
  const summary = summaryQuery.data;
  const detail = detailQuery.data;
  const outcome = detail?.trace_payload.final_outcome as Record<string, unknown> | null | undefined;
  const enrichment = detail?.pre_match_enrichment as Record<string, unknown> | null | undefined;
  const isMatch =
    detail?.final_status === 'master_match' ||
    detail?.final_status === 'incoming_second_pass_match';
  const isNew = detail?.final_status === 'new_entity_created';

  const selectedTraceKey = selectedTrace
    ? `${selectedTrace.source_module}::${selectedTrace.source_unique_id}`
    : undefined;

  const updateParam = (key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const setSearchInput = (value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set('q', value);
      else next.delete('q');
      return next;
    });
  };

  const setAnomalyPresenceFilter = (value: 'all' | 'with' | 'clean') => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 'with') next.set('has_anomalies', 'true');
      else if (value === 'clean') next.set('has_anomalies', 'false');
      else next.delete('has_anomalies');

      if (value === 'clean') next.delete('anomaly_type');
      return next;
    });
  };

  const setAnomalyTypeFilter = (value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) {
        next.set('anomaly_type', value);
        next.set('has_anomalies', 'true');
      } else {
        next.delete('anomaly_type');
      }
      return next;
    });
  };

  const selectTrace = (trace: TraceSummary) => {
    setJsonOpen(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('run_id', selectedRunId);
      next.set('selected_module', trace.source_module);
      next.set('selected_unique_id', trace.source_unique_id);
      return next;
    });
  };

  return {
    params,
    searchInput,
    setSearchInput,
    deferredSearch,
    jsonOpen,
    setJsonOpen,
    runsQuery,
    selectedRunId,
    moduleFilter,
    statusFilter,
    originFilter,
    anomalyPresenceFilter,
    anomalyTypeFilter,
    availableAnomalyTypes,
    selectedModule,
    selectedUniqueId,
    summaryQuery,
    tracesQuery,
    detailQuery,
    summary,
    traces,
    selectedTrace,
    detail,
    outcome,
    enrichment,
    isMatch,
    isNew,
    selectedTraceKey,
    updateParam,
    setAnomalyPresenceFilter,
    setAnomalyTypeFilter,
    selectTrace,
  };
}
