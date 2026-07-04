import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type={type} className={cn('flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-primary disabled:opacity-50', className)} {...props} />;
}
