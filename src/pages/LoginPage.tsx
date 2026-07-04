import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, Sparkles } from 'lucide-react';
import { animate, stagger, utils } from 'animejs';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/workbench/layout';
import { resolvePostLoginPath } from '@/lib/authRouting';
import { isApiErrorStatus } from '@/lib/http';
import { createMotionScope, MOTION, motionDistance, motionDuration } from '@/motion/anime';
import ditherArtwork from '@/assets/dither-orbit.jpg';

type LoginLocationState = { from?: string };

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const motionRoot = useRef<HTMLElement>(null);
  const destination = resolvePostLoginPath((location.state as LoginLocationState | null)?.from);

  useEffect(() => {
    if (status !== 'unauthenticated' || !motionRoot.current) return undefined;
    const scope = createMotionScope(motionRoot).add((self) => {
      if (!self) return;
      const duration = motionDuration(self, MOTION.hero);
      const shortDuration = motionDuration(self, MOTION.reveal);

      animate('.login-access-card', {
        x: { from: motionDistance(self, 16) },
        scale: { from: self.matches.reduceMotion ? 1 : 0.985 },
        duration,
        delay: self.matches.reduceMotion ? 0 : 120,
      });

      if (self.matches.smallScreen) return;
      animate('.login-dither-art', { opacity: { from: 0 }, duration });
      animate('.login-visual-brand', {
        y: { from: motionDistance(self, -8) },
        duration: shortDuration,
        delay: self.matches.reduceMotion ? 0 : 80,
      });
      animate('.login-motion-line', {
        y: { from: motionDistance(self, 18) },
        duration,
        delay: self.matches.reduceMotion ? 0 : stagger(75, { start: 130 }),
      });
      animate('.login-motion-support', {
        y: { from: motionDistance(self, 10) },
        duration: shortDuration,
        delay: self.matches.reduceMotion ? 0 : stagger(45, { start: 320 }),
      });

      if (!self.matches.reduceMotion) {
        const [art] = utils.$('.login-dither-art');
        if (art) {
          animate(art, {
            x: [-4, 4],
            y: [-3, 3],
            scale: [1.035, 1.015],
            duration: 15_000,
            ease: 'inOutSine',
            alternate: true,
            loop: true,
          });
        }
      }
    });
    return () => scope.revert();
  }, [status]);

  if (status === 'loading') return <div className="grid min-h-dvh place-items-center bg-background"><LoadingState /></div>;
  if (status === 'authenticated') return <Navigate replace to={destination} />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setIsSubmitting(true);
    try { await login(email, password); navigate(destination, { replace: true }); }
    catch (nextError) { setError(isApiErrorStatus(nextError, 401) ? 'Invalid email or password.' : nextError instanceof Error ? nextError.message : 'Unable to sign in right now.'); }
    finally { setIsSubmitting(false); }
  }

  return (
    <main ref={motionRoot} className="login-modern-shell">
      <section className="login-visual-panel">
        <img src={ditherArtwork} alt="" className="login-dither-art" aria-hidden="true" />
        <div className="login-dither-tint" />
        <div className="login-visual-grid" />
        <div className="login-visual-brand"><div className="grid size-9 place-items-center rounded-lg bg-white/14 text-white ring-1 ring-white/20"><Sparkles className="size-[18px]" /></div><div><div className="text-sm font-semibold text-white">Decision Tracer</div><div className="text-[11px] text-white/60">Entity matching workspace</div></div></div>
        <div className="login-visual-copy">
          <div className="login-visual-kicker login-motion-support">Operational clarity for every match</div>
          <h1><span className="login-motion-line">Trace decisions.</span><span className="login-motion-line">Resolve ambiguity.</span></h1>
          <p className="login-motion-support">Follow entity outcomes from source evidence to final resolution in one focused workspace.</p>
          <div className="login-capability-row">{['Decision evidence', 'Human review', 'Cost visibility'].map((item) => <span className="login-motion-support" key={item}><Check className="size-3" />{item}</span>)}</div>
        </div>
        <div className="login-visual-foot">Internal system / Authorized access only</div>
      </section>

      <section className="login-form-panel">
        <Card className="login-access-card">
          <CardHeader className="space-y-2 p-6 pb-4">
            <div className="mb-2 grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground lg:hidden"><Sparkles className="size-[18px]" /></div>
            <div className="text-xs font-semibold text-primary">Secure workspace access</div>
            <CardTitle className="text-[28px] leading-9 tracking-[-.035em]">Welcome back</CardTitle>
            <CardDescription>Sign in with your provisioned account.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-1.5"><span className="text-[11px] font-semibold">Email address</span><Input className="h-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="analyst@company.com" required /></label>
              <label className="block space-y-1.5"><span className="text-[11px] font-semibold">Password</span><div className="relative"><Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" className="h-10 pr-11" required /><button type="button" className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
              {error && <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive" role="alert">{error}</div>}
              <Button className="h-10 w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Button>
            </form>
            <div className="mt-5 border-t border-border pt-4 text-center text-[11px] text-muted-foreground">Protected internal workspace</div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
