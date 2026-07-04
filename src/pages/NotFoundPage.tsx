import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '../components/ui/button';

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Compass className="size-7" /></div>
        <div className="text-sm font-medium text-primary">404 · Page not found</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-.03em]">Let’s get you back to the work.</h1>
        <p className="mt-3 leading-6 text-muted-foreground">This destination may have moved, or the link is no longer valid.</p>
        <Button asChild className="mt-7"><Link to="/explorer"><ArrowLeft />Return to Explorer</Link></Button>
      </div>
    </div>
  );
}
