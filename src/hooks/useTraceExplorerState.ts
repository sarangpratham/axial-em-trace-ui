import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getRunSummary, getRuns, getTraceDetail, getTraces } from '../lib/api';
import {
  isAssignedExistingMaster,
  isCreatedNewMaster,
  normalizeSourceResolutionStatus,
} from '../lib/sourceResolution';
import {
  getReviewCase,
  getReviewCases,
  getRunPublishSummary,
} from '../lib/reviewApi';
import type { TraceSummary } from '../types';

export type TraceExplorerState = ReturnType<typeof useTraceExplorerState>;

const SESSION_KEYS = {
  runId: 'decision-tracer:selected-run-id',
  searchInput: 'decision-tracer:search-input',
  moduleFilter: 'decision-tracer:module-filter',
  statusFilter: 'decision-tracer:resolution-status-filter',
  decisionSourceFilter: 'decision-tracer:decision-source-filter',
  issuePresence: 'decision-tracer:issue-presence',
  issueType: 'decision-tracer:issue-type',
  selectedModule: 'decision-tracer:selected-module',
  selectedUniqueId: 'decision-tracer:selected-unique-id',
  reviewTab: 'decision-tracer:review-tab',
  selectedReviewCaseId: 'decision-tracer:selected-review-case-id',
} as const;

function readSessionString(key: string, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.sessionStorage.getItem(key);
    return stored ?? fallback;
  } catch {
    return fallback;
  }
}

function useSessionStringState(key: string, initialValue = '') {
  const [value, setValue] = useState(() => readSessionString(key, initialValue));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (value) {
        window.sessionStorage.setItem(key, value);
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // ignore storage availability issues
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function useTraceExplorerState() {
  const [params] = useSearchParams();
  const [jsonOpen, setJsonOpen] = useState(false);
  const [searchInput, setSearchInputState] = useSessionStringState(
    SESSION_KEYS.searchInput,
    params.get('q') ?? '',
  );
  const deferredSearch = useDeferredValue(searchInput);
  const [selectedRunId, setSelectedRunId] = useSessionStringState(
    SESSION_KEYS.runId,
    params.get('run_id') ?? '',
  );
  const [moduleFilter, setModuleFilter] = useSessionStringState(
    SESSION_KEYS.moduleFilter,
    params.get('module') ?? '',
  );
  const [statusFilter, setStatusFilter] = useSessionStringState(
    SESSION_KEYS.statusFilter,
    normalizeSourceResolutionStatus(params.get('resolution_status') ?? '')
      ?? params.get('resolution_status')
      ?? '',
  );
  const [decisionSourceFilter, setDecisionSourceFilter] = useSessionStringState(
    SESSION_KEYS.decisionSourceFilter,
    params.get('decision_source') ?? '',
  );
  const [issuePresenceFilter, setIssuePresenceFilterState] = useSessionStringState(
    SESSION_KEYS.issuePresence,
    params.get('issue_type')
      ? 'with'
      : params.get('has_issues') === 'true'
        ? 'with'
        : params.get('has_issues') === 'false'
          ? 'clean'
          : 'all',
  );
  const [issueTypeFilter, setIssueTypeFilterState] = useSessionStringState(
    SESSION_KEYS.issueType,
    params.get('issue_type') ?? '',
  );
  const [selectedModule, setSelectedModule] = useSessionStringState(
    SESSION_KEYS.selectedModule,
    params.get('selected_module') ?? '',
  );
  const [selectedUniqueId, setSelectedUniqueId] = useSessionStringState(
    SESSION_KEYS.selectedUniqueId,
    params.get('selected_unique_id') ?? '',
  );
  const [reviewTab, setReviewTabState] = useSessionStringState(
    SESSION_KEYS.reviewTab,
    params.get('review_tab') ?? 'needs_review',
  );
  const [selectedReviewCaseId, setSelectedReviewCaseId] = useSessionStringState(
    SESSION_KEYS.selectedReviewCaseId,
    params.get('review_case_id') ?? '',
  );

  const runsQuery = useQuery({
    queryKey: ['runs'],
    queryFn: getRuns,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!selectedRunId && runsQuery.data?.[0]) {
      setSelectedRunId(runsQuery.data[0]);
      return;
    }
    if (selectedRunId && runsQuery.data?.length && !runsQuery.data.includes(selectedRunId)) {
      setSelectedRunId(runsQuery.data[0]);
      setSelectedModule('');
      setSelectedUniqueId('');
      setSelectedReviewCaseId('');
    }
  }, [
    runsQuery.data,
    selectedRunId,
    setSelectedModule,
    setSelectedReviewCaseId,
    setSelectedRunId,
    setSelectedUniqueId,
  ]);

  const summaryQuery = useQuery({
    queryKey: ['summary', selectedRunId],
    queryFn: () => getRunSummary(selectedRunId),
    enabled: Boolean(selectedRunId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const tracesQuery = useQuery({
    queryKey: [
      'traces',
      selectedRunId,
      moduleFilter,
      statusFilter,
      decisionSourceFilter,
      deferredSearch,
      issuePresenceFilter,
      issueTypeFilter,
    ],
    queryFn: () =>
      getTraces({
        runId: selectedRunId,
        module: moduleFilter || undefined,
        resolutionStatus: statusFilter || undefined,
        decisionSource: decisionSourceFilter || undefined,
        query: deferredSearch || undefined,
        hasIssues:
          issuePresenceFilter === 'with'
            ? true
            : issuePresenceFilter === 'clean'
              ? false
              : undefined,
        issueType: issueTypeFilter || undefined,
      }),
    enabled: Boolean(selectedRunId),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });

  const availableIssueTypes = useMemo(() => {
    const entries = Object.entries(summaryQuery.data?.issue_by_type ?? {});
    return entries.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }, [summaryQuery.data?.issue_by_type]);

  useEffect(() => {
    if (!issueTypeFilter) return;
    if (availableIssueTypes.some(([type]) => type === issueTypeFilter)) return;
    setIssueTypeFilterState('');
    setIssuePresenceFilterState('all');
  }, [
    issueTypeFilter,
    availableIssueTypes,
    setIssuePresenceFilterState,
    setIssueTypeFilterState,
  ]);

  useEffect(() => {
    const normalized = normalizeSourceResolutionStatus(statusFilter);
    if (!normalized || normalized === statusFilter) return;
    setStatusFilter(normalized);
  }, [setStatusFilter, statusFilter]);

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
    setSelectedModule(selectedTrace.source_module);
    setSelectedUniqueId(selectedTrace.source_unique_id);
  }, [
    selectedModule,
    selectedTrace,
    selectedUniqueId,
    setSelectedModule,
    setSelectedUniqueId,
  ]);

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
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  const reviewFilters = useMemo(() => {
    switch (reviewTab) {
      case 'ready':
        return { reviewStatus: 'decided', publishStatus: 'pending' };
      case 'blocked':
        return { publishStatus: 'blocked' };
      case 'failed':
        return { publishStatus: 'failed' };
      case 'published':
        return { publishStatus: 'published' };
      case 'all':
        return {};
      case 'needs_review':
      default:
        return { reviewStatus: 'open' };
    }
  }, [reviewTab]);

  const reviewCasesQuery = useQuery({
    queryKey: ['review-cases', selectedRunId, reviewTab],
    queryFn: () =>
      getReviewCases({
        runId: selectedRunId,
        reviewStatus: reviewFilters.reviewStatus,
        publishStatus: reviewFilters.publishStatus,
      }),
    enabled: Boolean(selectedRunId),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });

  const publishSummaryQuery = useQuery({
    queryKey: ['publish-summary', selectedRunId],
    queryFn: () => getRunPublishSummary(selectedRunId),
    enabled: Boolean(selectedRunId),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });

  const selectedReviewCase = useMemo(() => {
    return (
      reviewCasesQuery.data?.find((item) => item.case_id === selectedReviewCaseId)
      ?? reviewCasesQuery.data?.[0]
      ?? null
    );
  }, [reviewCasesQuery.data, selectedReviewCaseId]);

  useEffect(() => {
    if (!selectedReviewCase) return;
    if (selectedReviewCase.case_id === selectedReviewCaseId) return;
    setSelectedReviewCaseId(selectedReviewCase.case_id);
  }, [selectedReviewCase, selectedReviewCaseId, setSelectedReviewCaseId]);

  const reviewCaseDetailQuery = useQuery({
    queryKey: ['review-case-detail', selectedRunId, selectedReviewCase?.case_id],
    queryFn: () => getReviewCase(selectedRunId, selectedReviewCase!.case_id),
    enabled: Boolean(selectedRunId && selectedReviewCase?.case_id),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });

  const traces = tracesQuery.data ?? [];
  const summary = summaryQuery.data;
  const detail = detailQuery.data;
  const reviewCases = reviewCasesQuery.data ?? [];
  const publishSummary = publishSummaryQuery.data;
  const reviewCaseDetail = reviewCaseDetailQuery.data;
  const resolution = detail?.resolution as Record<string, unknown> | null | undefined;
  const enrichment = detail?.derived_enrichment as Record<string, unknown> | null | undefined;
  const isMatch = isAssignedExistingMaster(detail?.resolution_status);
  const isNew = isCreatedNewMaster(detail?.resolution_status);

  const selectedTraceKey = selectedTrace
    ? `${selectedTrace.source_module}::${selectedTrace.source_unique_id}`
    : undefined;

  const updateParam = (key: string, value: string) => {
    switch (key) {
      case 'run_id':
        setSelectedRunId(value);
        setSelectedModule('');
        setSelectedUniqueId('');
        setSelectedReviewCaseId('');
        setJsonOpen(false);
        return;
      case 'module':
        setModuleFilter(value);
        return;
      case 'resolution_status':
        setStatusFilter(value);
        return;
      case 'decision_source':
        setDecisionSourceFilter(value);
        return;
      default:
        return;
    }
  };

  const setSearchInput = (value: string) => {
    setSearchInputState(value);
  };

  const setIssuePresenceFilter = (value: 'all' | 'with' | 'clean') => {
    setIssuePresenceFilterState(value);
    if (value === 'clean') setIssueTypeFilterState('');
  };

  const setIssueTypeFilter = (value: string) => {
    setIssueTypeFilterState(value);
    if (value) {
      setIssuePresenceFilterState('with');
    }
  };

  const selectTrace = (trace: TraceSummary) => {
    setJsonOpen(false);
    setSelectedModule(trace.source_module);
    setSelectedUniqueId(trace.source_unique_id);
  };

  const openSourceRecord = (sourceModule: string, sourceUniqueId: string) => {
    setJsonOpen(false);
    setSelectedModule(sourceModule);
    setSelectedUniqueId(sourceUniqueId);
  };

  const setReviewTab = (value: string) => {
    setReviewTabState(value);
    setSelectedReviewCaseId('');
  };

  const selectReviewCase = (caseId: string) => {
    setSelectedReviewCaseId(caseId);
  };

  return {
    searchInput,
    setSearchInput,
    deferredSearch,
    jsonOpen,
    setJsonOpen,
    runsQuery,
    selectedRunId,
    moduleFilter,
    statusFilter,
    decisionSourceFilter,
    issuePresenceFilter,
    issueTypeFilter,
    availableIssueTypes,
    selectedModule,
    selectedUniqueId,
    summaryQuery,
    tracesQuery,
    detailQuery,
    reviewCasesQuery,
    publishSummaryQuery,
    reviewCaseDetailQuery,
    summary,
    traces,
    selectedTrace,
    detail,
    reviewTab,
    reviewCases,
    selectedReviewCaseId,
    selectedReviewCase,
    reviewCaseDetail,
    publishSummary,
    resolution,
    enrichment,
    isMatch,
    isNew,
    selectedTraceKey,
    updateParam,
    setIssuePresenceFilter,
    setIssueTypeFilter,
    setReviewTab,
    selectReviewCase,
    selectTrace,
    openSourceRecord,
  };
}
