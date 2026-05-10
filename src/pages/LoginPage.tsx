import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';
import { resolvePostLoginPath } from '../lib/authRouting.ts';
import { isApiErrorStatus } from '../lib/http.ts';

type LoginLocationState = {
  from?: string;
};

function LoginLoadingState() {
  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      loading workspace…
    </div>
  );
}

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const destination = resolvePostLoginPath((location.state as LoginLocationState | null)?.from);

  if (status === 'loading') {
    return <LoginLoadingState />;
  }
  if (status === 'authenticated') {
    return <Navigate replace to={destination} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(destination, { replace: true });
    } catch (nextError) {
      setError(
        isApiErrorStatus(nextError, 401)
          ? 'Invalid email or password.'
          : nextError instanceof Error
            ? nextError.message
            : 'Unable to sign in right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-panel-glow" aria-hidden="true" />
        <div className="login-eyebrow">Console Access</div>
        <h1 className="login-title">Decision Tracer</h1>
        <p className="login-copy">
          Sign in with the credentials provisioned for you to inspect Explorer, Chat, Review,
          and Anomalies.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span className="login-label">Email</span>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="analyst@example.com"
              required
            />
          </label>

          <label className="login-field">
            <span className="login-label">Password</span>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="login-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
