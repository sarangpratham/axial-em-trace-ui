import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogAction = ({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Action>) => <AlertDialogPrimitive.Action className={cn(buttonVariants(), className)} {...props} />;
export const AlertDialogCancel = ({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Cancel>) => <AlertDialogPrimitive.Cancel className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />;

export function AlertDialogContent({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return <AlertDialogPrimitive.Portal><AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" /><AlertDialogPrimitive.Content className={cn('fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-6 shadow-2xl outline-none', className)} {...props} /></AlertDialogPrimitive.Portal>;
}
export const AlertDialogHeader = ({ className, ...props }: ComponentProps<'div'>) => <div className={cn('space-y-2', className)} {...props} />;
export const AlertDialogFooter = ({ className, ...props }: ComponentProps<'div'>) => <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
export const AlertDialogTitle = ({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Title>) => <AlertDialogPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />;
export const AlertDialogDescription = ({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Description>) => <AlertDialogPrimitive.Description className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />;
