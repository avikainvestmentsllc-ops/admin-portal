import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiRequestError } from '../api/client';

// Account locked or inactive → tell the user to contact support (no self-service).
const CONTACT_SUPPORT_CODES = new Set(['80115', '80116']);

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const justReset = (location.state as { reset?: boolean } | null)?.reset === true;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        // Locked/inactive accounts get a support message; other errors show as-is.
        setError(
          CONTACT_SUPPORT_CODES.has(err.errorCode)
            ? `${err.message} Please contact customer service.`
            : err.message,
        );
      } else {
        setError('Unable to reach the server. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>Admin Portal</h1>
        <p className="subtitle">Sign in to manage landlords, packages &amp; billing</p>

        {justReset && (
          <div className="notice" role="status">Your password has been reset. Please sign in.</div>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@houselease.com"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && <div className="error" role="alert">{error}</div>}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <Link className="link-btn" to="/forgot-password">Forgot password?</Link>
        </form>
      </div>
    </div>
  );
}
