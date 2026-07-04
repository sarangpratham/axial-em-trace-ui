import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

export function SheetContent({ className, side = 'left', children, ...props }: ComponentProps<typeof SheetPrimitive.Content> & { side?: 'left' | 'right' | 'bottom' }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <SheetPrimitive.Content className={cn('fixed z-50 border-border bg-popover p-5 shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out', side === 'left' && 'inset-y-0 left-0 w-[88vw] max-w-sm border-r', side === 'right' && 'inset-y-0 right-0 w-[88vw] max-w-lg border-l', side === 'bottom' && 'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl border-t', className)} {...props}>
        {children}
        <SheetPrimitive.Close className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close panel"><X className="size-4" /></SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
export const SheetHeader = ({ className, ...props }: ComponentProps<'div'>) => <div className={cn('mb-5 space-y-1', className)} {...props} />;
export const SheetTitle = ({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) => <SheetPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />;
export const SheetDescription = ({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) => <SheetPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
