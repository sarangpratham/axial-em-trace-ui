import {
  humanizeToken,
  normalizeSourceResolutionStatus,
} from '../lib/sourceResolution';

type StatusBadgeProps = {
  label: string | null | undefined;
  variant?: 'status' | 'origin';
};

const STATUS_MAP: Record<string, { cls: string; text: string }> = {
  assigned_existing_master: { cls: 'match', text: 'assigned existing master' },
  created_new_master: { cls: 'new_entity', text: 'created new master' },
  pending_review: { cls: 'review', text: 'pending review' },
  open: { cls: 'review', text: 'needs review' },
  reviewed: { cls: 'review_ready', text: 'reviewed' },
  ready: { cls: 'review_ready', text: 'ready to publish' },
  publish_blocked: { cls: 'review_blocked', text: 'publish blocked' },
  publish_failed: { cls: 'review_failed', text: 'publish failed' },
  published: { cls: 'review_published', text: 'published' },
  deterministic: { cls: 'master', text: 'deterministic' },
  url_web_agent: { cls: 'incoming', text: 'url/web agent' },
  context_agent: { cls: 'incoming', text: 'context agent' },
  human_review: { cls: 'review', text: 'human review' },
  selected: { cls: 'match', text: 'selected' },
  deterministic_accept: { cls: 'match', text: 'deterministic accept' },
  agent_accept: { cls: 'match', text: 'agent accept' },
  rejected: { cls: 'no_match', text: 'rejected' },
  deterministic_reject: { cls: 'no_match', text: 'deterministic reject' },
  agent_reject: { cls: 'no_match', text: 'agent reject' },
  blocked: { cls: 'review_blocked', text: 'blocked' },
  viable_not_selected: { cls: 'second_pass', text: 'viable not selected' },
  suppressed: { cls: 'neutral', text: 'suppressed' },
  agent_required: { cls: 'review_blocked', text: 'agent required' },
  agent_insufficient: { cls: 'review_blocked', text: 'agent insufficient' },
  master_entities: { cls: 'master', text: 'master' },
  incoming_entities: { cls: 'incoming', text: 'incoming' },
};

export function StatusBadge({ label }: StatusBadgeProps) {
  if (!label) return null;
  const mapped =
    STATUS_MAP[normalizeSourceResolutionStatus(label) ?? label]
    ?? STATUS_MAP[label];
  if (mapped) {
    return (
      <span className={`badge badge--${mapped.cls}`}>
        {mapped.text}
      </span>
    );
  }
  return <span className="badge badge--neutral">{humanizeToken(label, label)}</span>;
}
