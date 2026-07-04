import { useEffect, useState, type FocusEvent, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  CircleDollarSign,
  Command,
  LogOut,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { TraceExplorerState } from '@/hooks/useTraceExplorerState';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme';
import { RunSelector } from './RunSelector';

export type WorkspaceView = 'explorer' | 'issues' | 'review' | 'cost';

const NAV_ITEMS = [
  { id: 'explorer', label: 'Explorer', hint: 'Trace entity decisions', href: '/explorer', icon: Search },
  { id: 'issues', label: 'Issues', hint: 'Investigate quality signals', href: '/issues', icon: AlertTriangle },
  { id: 'review', label: 'Review', hint: 'Resolve human cases', href: '/review', icon: ShieldCheck },
  { id: 'cost', label: 'Cost', hint: 'Understand model spend', href: '/cost', icon: CircleDollarSign },
] as const;

const VIEW_COPY: Record<WorkspaceView, { title: string; eyebrow: string }> = {
  explorer: { title: 'Decision Explorer', eyebrow: 'Entity matching' },
  issues: { title: 'Issues', eyebrow: 'Quality and follow-up' },
  review: { title: 'Review Queue', eyebrow: 'Human decisions' },
  cost: { title: 'Cost', eyebrow: 'Usage and spend' },
};

function Navigation({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1 px-3" aria-label="Workspace navigation">
      {NAV_ITEMS.map(({ label, hint, href, icon: Icon }) => (
        <NavLink
          key={href}
          to={href}
          onClick={onNavigate}
          className={({ isActive }) => cn(
            'group flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent',
            isActive && 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground',
            !expanded && 'justify-center px-0',
          )}
          title={expanded ? undefined : label}
        >
          <span className="grid size-6 shrink-0 place-items-center"><Icon className="size-[18px]" /></span>
          <span className={cn('min-w-0 overflow-hidden transition-[width,opacity] duration-200 ease-out', expanded ? 'w-[164px] opacity-100' : 'w-0 opacity-0')}>
            <span className="block whitespace-nowrap font-medium leading-4">{label}</span>
            <span className="mt-0.5 block whitespace-nowrap text-[11px] opacity-70">{hint}</span>
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({ currentView, explorer, children }: { currentView: WorkspaceView; explorer: TraceExplorerState; children: ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const [railHovered, setRailHovered] = useState(false);
  const [railFocused, setRailFocused] = useState(false);
  const [railPinned, setRailPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const expanded = railHovered || railFocused || railPinned;
  const copy = VIEW_COPY[currentView];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setRailPinned((value) => !value);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function closeRailAfterNavigation() {
    setRailFocused(false);
    setRailPinned(false);
    setMobileOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  function handleRailFocus(event: FocusEvent<HTMLElement>) {
    if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) {
      setRailFocused(true);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  const sidebarBody = (isExpanded: boolean) => (
    <>
      <div className="flex h-16 items-center">
        <div className="grid w-[72px] shrink-0 place-items-center"><div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Sparkles className="size-[18px]" /></div></div>
        <div className={cn('min-w-0 overflow-hidden transition-[width,opacity] duration-200 ease-out', isExpanded ? 'w-40 opacity-100' : 'w-0 opacity-0')}>
          <div className="whitespace-nowrap text-sm font-semibold tracking-[-0.01em]">Decision Tracer</div>
          <div className="whitespace-nowrap text-[11px] text-muted-foreground">Entity matching workspace</div>
        </div>
      </div>
      <Separator />
      <div className="flex-1 py-3"><Navigation expanded={isExpanded} onNavigate={closeRailAfterNavigation} /></div>
      <div className="space-y-1 border-t border-border p-3">
        <Button variant="ghost" className={cn('w-full justify-start [&_svg]:mx-1', !isExpanded && 'justify-center px-0 [&_svg]:mx-0')} onClick={toggleMode} title={isExpanded ? undefined : 'Switch theme'}>
          {mode === 'dark' ? <Moon /> : <Sun />}<span className={cn('overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 ease-out', isExpanded ? 'w-28 opacity-100' : 'w-0 opacity-0')}>{mode === 'dark' ? 'Dark theme' : 'Light theme'}</span>
        </Button>
        {user && <div className={cn('overflow-hidden rounded-lg bg-muted transition-[max-height,opacity,padding] duration-200 ease-out', isExpanded ? 'max-h-14 px-3 py-2 opacity-100' : 'max-h-0 p-0 opacity-0')}><div className="whitespace-nowrap text-[11px] text-muted-foreground">Signed in as</div><div className="truncate whitespace-nowrap text-xs font-medium" title={user.email}>{user.email}</div></div>}
        <Button variant="ghost" className={cn('w-full justify-start text-muted-foreground [&_svg]:mx-1', !isExpanded && 'justify-center px-0 [&_svg]:mx-0')} onClick={() => void handleLogout()} disabled={loggingOut} title={isExpanded ? undefined : 'Sign out'}>
          <LogOut /><span className={cn('overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 ease-out', isExpanded ? 'w-24 opacity-100' : 'w-0 opacity-0')}>{loggingOut ? 'Signing out' : 'Sign out'}</span>
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <div className="relative hidden w-[72px] shrink-0 md:block">
        <aside
          className={cn('absolute inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-border bg-card shadow-sm transition-[width] duration-200 ease-[cubic-bezier(.22,1,.36,1)] will-change-[width]', expanded ? 'w-[248px] shadow-xl' : 'w-[72px]')}
          onMouseEnter={() => setRailHovered(true)}
          onMouseLeave={() => setRailHovered(false)}
          onFocusCapture={handleRailFocus}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setRailFocused(false); }}
          aria-label="Primary navigation"
        >
          {sidebarBody(expanded)}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation"><Menu /></Button></SheetTrigger>
              <SheetContent className="flex p-0" side="left"><SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle></SheetHeader><div className="flex w-full flex-col">{sidebarBody(true)}</div></SheetContent>
            </Sheet>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium text-muted-foreground">{copy.eyebrow}</div>
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em]">{copy.title}</h1>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden lg:block"><RunSelector runs={explorer.runsQuery.data ?? []} value={explorer.selectedRunId} onChange={(runId) => explorer.updateParam('run_id', runId)} /></div>
            <Button variant="outline" size="sm" className="hidden gap-2 text-muted-foreground sm:flex" onClick={() => setCommandOpen(true)}><Command /><span className="hidden xl:inline">Commands</span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd></Button>
          </div>
        </header>
        <div className="border-b border-border bg-card px-4 py-2 lg:hidden"><RunSelector runs={explorer.runsQuery.data ?? []} value={explorer.selectedRunId} onChange={(runId) => explorer.updateParam('run_id', runId)} compact /></div>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>

      <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-[16%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl outline-none">
            <Dialog.Title className="sr-only">Command menu</Dialog.Title>
            <div className="flex items-center gap-2 border-b border-border px-4"><Search className="size-4 text-muted-foreground" /><input className="h-13 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Go to a page or switch theme…" autoFocus /></div>
            <div className="p-2"><div className="px-2 py-2 text-xs font-medium text-muted-foreground">Navigate</div>{NAV_ITEMS.map(({ label, href, icon: Icon }) => <button key={href} type="button" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-accent" onClick={() => { navigate(href); setCommandOpen(false); }}><Icon className="size-4 text-muted-foreground" />{label}</button>)}</div>
            <Separator />
            <button type="button" className="flex min-h-11 w-full items-center gap-3 px-5 text-sm hover:bg-accent" onClick={() => { toggleMode(); setCommandOpen(false); }}>{mode === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}Switch to {mode === 'dark' ? 'light' : 'dark'} theme</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
