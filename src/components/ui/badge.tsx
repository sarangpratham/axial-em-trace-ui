import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4', {
  variants: {
    variant: {
      default: 'border-primary/30 bg-primary/10 text-primary',
      secondary: 'border-border bg-secondary text-secondary-foreground',
      success: 'border-success/25 bg-success/10 text-success',
      warning: 'border-warning/25 bg-warning/10 text-warning',
      destructive: 'border-destructive/25 bg-destructive/10 text-destructive',
      outline: 'border-border text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
