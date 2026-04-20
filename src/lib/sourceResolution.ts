import type { SourceResolutionStatus } from '../types';

const SOURCE_STATUSES: Record<string, SourceResolutionStatus> = {
  assigned_existing_master: 'assigned_existing_master',
  created_new_master: 'created_new_master',
  pending_review: 'pending_review',
};

export function normalizeSourceResolutionStatus(
  value: string | null | undefined,
): SourceResolutionStatus | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return SOURCE_STATUSES[normalized] ?? null;
}

export function isAssignedExistingMaster(
  value: string | null | undefined,
): boolean {
  return normalizeSourceResolutionStatus(value) === 'assigned_existing_master';
}

export function isCreatedNewMaster(
  value: string | null | undefined,
): boolean {
  return normalizeSourceResolutionStatus(value) === 'created_new_master';
}

export function isPendingReview(
  value: string | null | undefined,
): boolean {
  return normalizeSourceResolutionStatus(value) === 'pending_review';
}

export function sourceResolutionLabel(
  value: string | null | undefined,
): string {
  switch (normalizeSourceResolutionStatus(value)) {
    case 'assigned_existing_master':
      return 'assigned existing master';
    case 'created_new_master':
      return 'created new master';
    case 'pending_review':
      return 'pending review';
    default:
      return humanizeToken(value);
  }
}

export function humanizeToken(
  value: string | null | undefined,
  fallback = '—',
): string {
  if (!value || !value.trim()) return fallback;
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function candidateDispositionLabel(
  value: string | null | undefined,
): string {
  switch ((value || '').trim().toLowerCase()) {
    case 'selected':
      return 'selected';
    case 'pending_review':
      return 'pending review';
    case 'viable_not_selected':
      return 'viable not selected';
    case 'suppressed':
      return 'suppressed';
    case 'agent_required':
      return 'blocked';
    case 'rejected':
      return 'rejected';
    default:
      return humanizeToken(value, 'unknown');
  }
}
