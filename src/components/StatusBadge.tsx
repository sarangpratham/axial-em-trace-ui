type StatusBadgeProps = {
  label: string | null | undefined;
  variant?: 'status' | 'origin';
};

const STATUS_MAP: Record<string, { cls: string; text: string }> = {
  master_match: { cls: 'match', text: '⬤ master match' },
  incoming_second_pass_match: { cls: 'second_pass', text: '⬤ 2nd pass' },
  new_entity_created: { cls: 'new_entity', text: '⬤ new entity' },
  no_match: { cls: 'no_match', text: '⬤ no match' },
  pending_human_review: { cls: 'review', text: 'review pending' },
  open: { cls: 'review', text: 'needs review' },
  reviewed: { cls: 'review_ready', text: 'reviewed' },
  ready: { cls: 'review_ready', text: 'ready to publish' },
  blocked: { cls: 'review_blocked', text: 'publish blocked' },
  publish_failed: { cls: 'review_failed', text: 'publish failed' },
  published: { cls: 'review_published', text: 'published' },
  master_entities: { cls: 'master', text: 'master' },
  incoming_entities: { cls: 'incoming', text: 'incoming' },
  new_entity: { cls: 'new_entity', text: 'new' },
};

export function StatusBadge({ label }: StatusBadgeProps) {
  if (!label) return null;
  const mapped = STATUS_MAP[label];
  if (mapped) {
    return (
      <span className={`badge badge--${mapped.cls}`}>
        {mapped.text}
      </span>
    );
  }
  return <span className="badge badge--neutral">{label}</span>;
}
