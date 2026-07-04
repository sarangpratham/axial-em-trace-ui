import type { HTMLAttributes, ReactNode } from 'react';
import { AlertCircle, Inbox, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-motion-page className={cn('mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-5 lg:px-5 lg:py-5', className)} {...props} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>}
        <h2 className="text-[22px] font-semibold leading-7 tracking-[-0.025em] text-foreground">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-end gap-2 rounded-[10px] border border-border bg-card p-2.5 shadow-surface', className)}>
      {children}
    </div>
  );
}

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn('grid min-w-[124px] gap-1 text-[11px] font-medium text-muted-foreground', className)}><span>{label}</span>{children}</label>;
}

export function WorkspacePanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Card className={cn('min-w-0 overflow-hidden rounded-xl shadow-surface', className)} {...props} />;
}

export function MetricCard({ label, value, detail, tone = 'neutral' }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }) {
  const tones = { neutral: '', primary: 'border-primary/25', success: 'border-success/25', warning: 'border-warning/25', danger: 'border-destructive/25' };
  return <Card className={cn('rounded-[10px] p-3 shadow-surface', tones[tone])}><div className="text-[11px] font-medium text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold leading-6 tracking-[-0.03em] tabular-nums">{value}</div>{detail && <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{detail}</div>}</Card>;
}

export function EmptyState({ title = 'Nothing to show', description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return <div className="grid min-h-40 place-items-center p-6 text-center"><div className="max-w-sm"><div className="mx-auto mb-3 grid size-9 place-items-center rounded-full bg-muted text-muted-foreground"><Inbox className="size-4" /></div><h3 className="text-sm font-semibold">{title}</h3>{description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}{action && <div className="mt-3">{action}</div>}</div></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="grid min-h-40 place-items-center p-6 text-center"><div className="max-w-sm"><AlertCircle className="mx-auto mb-2 size-5 text-destructive" /><h3 className="text-sm font-semibold">Could not load this view</h3><p className="mt-1 text-xs text-muted-foreground">{message}</p>{onRetry && <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}><RotateCcw />Retry</Button>}</div></div>;
}

export function LoadingState({ label = 'Loading workspace' }: { label?: string }) {
  return <div className="grid min-h-40 place-items-center p-6"><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-3.5 animate-spin rounded-full border-2 border-border border-t-primary" />{label}</div></div>;
}
