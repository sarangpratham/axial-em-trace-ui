import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getRuns } from '@/lib/api';

export function RunSelector({
  runs,
  value,
  onChange,
  compact = false,
}: {
  runs: string[];
  value: string;
  onChange: (runId: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const localMatches = deferredQuery
    ? runs.filter((run) => run.toLowerCase().includes(deferredQuery))
    : runs;
  const searchQuery = useQuery({
    queryKey: ['runs', 'search', deferredQuery],
    queryFn: ({ signal }) => getRuns({ query: deferredQuery, limit: 100, signal }),
    enabled: open && Boolean(deferredQuery),
    staleTime: 30_000,
  });
  const filteredRuns = deferredQuery
    ? searchQuery.data ?? localMatches
    : runs;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="outline" className={cn('justify-between font-mono text-xs', compact ? 'w-44' : 'w-64')} aria-label="Select run">
          <span className="truncate">{value || 'Select a run'}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-[70] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-2xl">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search run IDs" className="pl-9 font-mono text-xs" autoFocus />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filteredRuns.map((run) => (
              <button key={run} type="button" className="flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 text-left font-mono text-xs hover:bg-accent" onClick={() => { onChange(run); setOpen(false); setQuery(''); }}>
                <Check className={cn('size-4 text-primary', value === run ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{run}</span>
              </button>
            ))}
            {searchQuery.isFetching && deferredQuery && <div className="px-3 py-2 text-center text-xs text-muted-foreground">Searching all runs…</div>}
            {!searchQuery.isFetching && filteredRuns.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted-foreground">No matching runs</div>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
