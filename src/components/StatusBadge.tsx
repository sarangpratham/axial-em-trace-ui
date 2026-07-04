import {
  humanizeToken,
  normalizeSourceResolutionStatus,
} from '../lib/sourceResolution';
import { AlertTriangle, Check, CircleDot, Clock3, X } from 'lucide-react';
import { Badge } from './ui/badge';

type StatusBadgeProps = {
  label: string | null | undefined;
  variant?: 'status' | 'origin';
};

type StatusTone = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

const STATUS_MAP: Record<string, { tone: StatusTone; text: string; icon?: typeof Check }> = {
  assigned_existing_master: { tone: 'success', text: 'assigned existing master', icon: Check },
  created_new_master: { tone: 'default', text: 'created new master', icon: CircleDot },
  needs_review_multi_master: { tone: 'warning', text: 'needs review: multiple masters', icon: AlertTriangle },
  unresolved: { tone: 'warning', text: 'unresolved', icon: AlertTriangle },
  open: { tone: 'warning', text: 'needs review', icon: AlertTriangle },
  decided: { tone: 'default', text: 'decided', icon: Check },
  resolved: { tone: 'success', text: 'resolved', icon: Check },
  pending: { tone: 'secondary', text: 'pending publish', icon: Clock3 },
  publish_blocked: { tone: 'warning', text: 'publish blocked', icon: AlertTriangle },
  failed: { tone: 'destructive', text: 'failed', icon: X },
  published: { tone: 'success', text: 'published', icon: Check },
  deterministic: { tone: 'secondary', text: 'deterministic' },
  url_web_agent: { tone: 'default', text: 'url/web agent' },
  context_agent: { tone: 'default', text: 'context agent' },
  human_review: { tone: 'warning', text: 'human review' },
  selected: { tone: 'success', text: 'selected', icon: Check },
  deterministic_accept: { tone: 'success', text: 'deterministic accept', icon: Check },
  agent_accept: { tone: 'success', text: 'agent accept', icon: Check },
  rejected: { tone: 'destructive', text: 'rejected', icon: X },
  deterministic_reject: { tone: 'destructive', text: 'deterministic reject', icon: X },
  agent_reject: { tone: 'destructive', text: 'agent reject', icon: X },
  blocked: { tone: 'warning', text: 'blocked', icon: AlertTriangle },
  viable_not_selected: { tone: 'secondary', text: 'viable not selected' },
  suppressed: { tone: 'outline', text: 'suppressed' },
  agent_required: { tone: 'warning', text: 'agent required' },
  agent_insufficient: { tone: 'warning', text: 'agent insufficient' },
  master_entities: { tone: 'secondary', text: 'master' },
  incoming_entities: { tone: 'default', text: 'incoming' },
};

export function StatusBadge({ label }: StatusBadgeProps) {
  if (!label) return null;
  const mapped =
    STATUS_MAP[normalizeSourceResolutionStatus(label) ?? label]
    ?? STATUS_MAP[label];
  if (mapped) {
    const Icon = mapped.icon;
    return <Badge variant={mapped.tone}>{Icon && <Icon aria-hidden="true" />}{mapped.text}</Badge>;
  }
  return <Badge variant="outline">{humanizeToken(label, label)}</Badge>;
}
