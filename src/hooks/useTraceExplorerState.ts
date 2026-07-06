import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router-dom';
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

const SOURCE_PAGE_SIZE = 50;

function positivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

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
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const isExplorerRoute = location.pathname === '/explorer';
  const isIssuesRoute = location.pathname === '/issues';
  const isReviewRoute = location.pathname === '/review';
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
  const [sourcePage, setSourcePageState] = useState(() => positivePage(params.get('source_page')));

  const runsQuery = useQuery({
    queryKey: ['runs'],
    queryFn: ({ signal }) => getRuns({ signal }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!selectedRunId && runsQuery.data?.[0]) {
      setSelectedRunId(runsQuery.data[0]);
      return;
    }
  }, [
    runsQuery.data,
    selectedRunId,
    setSelectedRunId,
  ]);

  const summaryQuery = useQuery({
    queryKey: ['summary', selectedRunId],
    queryFn: () => getRunSummary(selectedRunId),
    enabled: Boolean(selectedRunId && (isExplorerRoute || isIssuesRoute)),
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
      sourcePage,
    ],
    queryFn: ({ signal }) =>
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
        limit: SOURCE_PAGE_SIZE,
        offset: (sourcePage - 1) * SOURCE_PAGE_SIZE,
        signal,
      }),
    enabled: Boolean(selectedRunId && isExplorerRoute),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
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
    return tracesQuery.data?.items.find(
      (trace) =>
        trace.source_module === selectedModule &&
        trace.source_unique_id === selectedUniqueId,
    );
  }, [selectedModule, selectedUniqueId, tracesQuery.data]);

  const detailQuery = useQuery({
    queryKey: [
      'trace-detail',
      selectedRunId,
      selectedModule,
      selectedUniqueId,
    ],
    queryFn: ({ signal }) =>
      getTraceDetail(
        selectedRunId,
        selectedModule,
        selectedUniqueId,
        undefined,
        signal,
      ),
    enabled: Boolean(selectedRunId && selectedModule && selectedUniqueId && isExplorerRoute),
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
    enabled: Boolean(selectedRunId && isReviewRoute),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });

  const publishSummaryQuery = useQuery({
    queryKey: ['publish-summary', selectedRunId],
    queryFn: () => getRunPublishSummary(selectedRunId),
    enabled: Boolean(selectedRunId && isReviewRoute),
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
    enabled: Boolean(selectedRunId && selectedReviewCase?.case_id && isReviewRoute),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });

  const traces = tracesQuery.data?.items ?? [];
  const summary = summaryQuery.data;
  const detail = detailQuery.data;
  const reviewCases = reviewCasesQuery.data ?? [];
  const publishSummary = publishSummaryQuery.data;
  const reviewCaseDetail = reviewCaseDetailQuery.data;
  const resolution = detail?.resolution as Record<string, unknown> | null | undefined;
  const enrichment = detail?.derived_enrichment as Record<string, unknown> | null | undefined;
  const isMatch = isAssignedExistingMaster(detail?.resolution_status);
  const isNew = isCreatedNewMaster(detail?.resolution_status);

  const selectedTraceKey = selectedModule && selectedUniqueId
    ? `${selectedModule}::${selectedUniqueId}`
    : undefined;

  const writeParams = (updates: Record<string, string>) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      return next;
    }, { replace: true });
  };

  const updateParam = (key: string, value: string) => {
    writeParams({ [key]: value, source_page: key === 'run_id' ? '' : '1' });
    setSourcePageState(1);
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
    setSourcePageState(1);
    writeParams({ q: value, source_page: '' });
  };

  const setIssuePresenceFilter = (value: 'all' | 'with' | 'clean') => {
    setIssuePresenceFilterState(value);
    setSourcePageState(1);
    writeParams({ has_issues: value === 'all' ? '' : String(value === 'with'), issue_type: value === 'clean' ? '' : issueTypeFilter, source_page: '' });
    if (value === 'clean') setIssueTypeFilterState('');
  };

  const setIssueTypeFilter = (value: string) => {
    setIssueTypeFilterState(value);
    setSourcePageState(1);
    writeParams({ issue_type: value, has_issues: value ? 'true' : issuePresenceFilter === 'all' ? '' : String(issuePresenceFilter === 'with'), source_page: '' });
    if (value) {
      setIssuePresenceFilterState('with');
    }
  };

  const selectTrace = (trace: TraceSummary) => {
    setJsonOpen(false);
    setSelectedModule(trace.source_module);
    setSelectedUniqueId(trace.source_unique_id);
    writeParams({ selected_module: trace.source_module, selected_unique_id: trace.source_unique_id });
  };

  const openSourceRecord = (sourceModule: string, sourceUniqueId: string) => {
    setJsonOpen(false);
    setSelectedModule(sourceModule);
    setSelectedUniqueId(sourceUniqueId);
    writeParams({ selected_module: sourceModule, selected_unique_id: sourceUniqueId });
  };

  const setSourcePage = (page: number) => {
    const nextPage = Math.max(1, page);
    setSourcePageState(nextPage);
    writeParams({ source_page: nextPage === 1 ? '' : String(nextPage) });
  };

  const setReviewTab = (value: string) => {
    setReviewTabState(value);
    setSelectedReviewCaseId('');
    writeParams({ review_tab: value, review_case_id: '' });
  };

  const selectReviewCase = (caseId: string) => {
    setSelectedReviewCaseId(caseId);
    writeParams({ review_case_id: caseId });
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
    sourcePage,
    sourcePageSize: SOURCE_PAGE_SIZE,
    hasNextSourcePage: tracesQuery.data?.hasMore ?? false,
    setSourcePage,
    updateParam,
    setIssuePresenceFilter,
    setIssueTypeFilter,
    setReviewTab,
    selectReviewCase,
    selectTrace,
    openSourceRecord,
  };
}
