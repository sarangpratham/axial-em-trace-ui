import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppTopbar } from '../components/AppTopbar';
import { ReviewWorkspace } from '../components/review/ReviewWorkspace';
import type { TraceExplorerState } from '../hooks/useTraceExplorerState';
import {
  createReviewPublish,
  getReviewPublish,
  saveReviewDecision,
} from '../lib/reviewApi';
import type {
  ReviewDecisionPayload,
  ReviewPublishBatch,
} from '../types';

const TERMINAL_PUBLISH_STATUSES = new Set([
  'completed',
  'completed_with_issues',
  'failed',
]);

export function ReviewPage({ explorer }: { explorer: TraceExplorerState }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    selectedRunId,
    reviewCaseDetail,
  } = explorer;
  const [decision, setDecision] = useState('');
  const [targetEntityId, setTargetEntityId] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [activePublishId, setActivePublishId] = useState<string | null>(null);
  const [lastPublishBatch, setLastPublishBatch] = useState<ReviewPublishBatch | null>(null);
  const [publishBatchError, setPublishBatchError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCaseIds((current) =>
      current.filter((caseId) => explorer.reviewCases.some((item) => item.case_id === caseId)),
    );
  }, [explorer.reviewCases]);

  useEffect(() => {
    setActivePublishId(null);
    setLastPublishBatch(null);
    setPublishBatchError(null);
  }, [selectedRunId]);

  useEffect(() => {
    if (!reviewCaseDetail) {
      setDecision('');
      setTargetEntityId('');
      setDecisionReason('');
      return;
    }
    const savedDecision =
      typeof reviewCaseDetail.decision_payload?.decision === 'string'
        ? String(reviewCaseDetail.decision_payload.decision)
        : '';
    const savedTarget =
      typeof reviewCaseDetail.decision_payload?.target_entity_id === 'string'
        ? String(reviewCaseDetail.decision_payload.target_entity_id)
        : '';
    const savedReason =
      typeof reviewCaseDetail.decision_payload?.reason === 'string'
        ? String(reviewCaseDetail.decision_payload.reason)
        : '';
    setDecision(savedDecision);
    setTargetEntityId(savedTarget);
    setDecisionReason(savedReason);
  }, [reviewCaseDetail?.case_id]);

  const saveDecisionMutation = useMutation({
    mutationFn: ({ caseId, payload }: { caseId: string; payload: ReviewDecisionPayload }) =>
      saveReviewDecision(caseId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['review-cases', selectedRunId] }),
        queryClient.invalidateQueries({ queryKey: ['review-case-detail', selectedRunId] }),
        queryClient.invalidateQueries({ queryKey: ['publish-summary', selectedRunId] }),
        queryClient.invalidateQueries({ queryKey: ['summary', selectedRunId] }),
      ]);
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ runId, caseIds }: { runId: string; caseIds: string[] }) =>
      createReviewPublish(runId, caseIds),
    onMutate: () => {
      setPublishBatchError(null);
    },
    onSuccess: (response) => {
      setActivePublishId(response.publish_id);
      setLastPublishBatch(null);
      setPublishBatchError(null);
      setSelectedCaseIds([]);
    },
  });

  const publishBatchQuery = useQuery({
    queryKey: ['review-publish', activePublishId],
    queryFn: () => getReviewPublish(activePublishId!),
    enabled: Boolean(activePublishId),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) => {
      if (query.state.error) return false;
      const status = String(query.state.data?.status ?? '');
      return TERMINAL_PUBLISH_STATUSES.has(status) ? false : 2_000;
    },
  });

  useEffect(() => {
    if (!activePublishId || !publishBatchQuery.error) return;
    setPublishBatchError(
      publishBatchQuery.error instanceof Error
        ? publishBatchQuery.error.message
        : 'Failed to load publish batch status.',
    );
    setActivePublishId(null);
  }, [activePublishId, publishBatchQuery.error]);

  useEffect(() => {
    const batch = publishBatchQuery.data;
    if (!batch || !TERMINAL_PUBLISH_STATUSES.has(batch.status)) return;
    setPublishBatchError(null);
    setLastPublishBatch(batch);
    setActivePublishId(null);
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['review-cases', selectedRunId] }),
      queryClient.invalidateQueries({ queryKey: ['review-case-detail', selectedRunId] }),
      queryClient.invalidateQueries({ queryKey: ['publish-summary', selectedRunId] }),
      queryClient.invalidateQueries({ queryKey: ['summary', selectedRunId] }),
      queryClient.invalidateQueries({ queryKey: ['traces', selectedRunId] }),
      queryClient.invalidateQueries({ queryKey: ['trace-detail', selectedRunId] }),
    ]);
  }, [publishBatchQuery.data, queryClient, selectedRunId]);

  const publishBatch = useMemo(
    () => publishBatchQuery.data ?? lastPublishBatch,
    [lastPublishBatch, publishBatchQuery.data],
  );

  const openSourceRecord = (_source: NonNullable<typeof reviewCaseDetail>['sources'][number]) => {
    navigate('/explorer');
  };

  return (
    <div className="shell shell--review">
      <AppTopbar
        currentView="review"
        runIds={explorer.runsQuery.data ?? []}
        selectedRunId={explorer.selectedRunId}
        onRunChange={(runId) => explorer.updateParam('run_id', runId)}
      />

      <div className="review-page-shell">
        <ReviewWorkspace
          explorer={explorer}
          selectedCaseIds={selectedCaseIds}
          setSelectedCaseIds={setSelectedCaseIds}
          decision={decision}
          setDecision={setDecision}
          targetEntityId={targetEntityId}
          setTargetEntityId={setTargetEntityId}
          decisionReason={decisionReason}
          setDecisionReason={setDecisionReason}
          saveDecisionMutation={saveDecisionMutation}
          publishMutation={publishMutation}
          publishBatch={publishBatch}
          publishBatchError={publishBatchError}
          isPublishTracking={Boolean(activePublishId)}
          onSourceRecordSelected={openSourceRecord}
        />
      </div>
    </div>
  );
}
