import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiRequestError } from '../api/client';

// Account locked or inactive → tell the user to contact support (no self-service).
const CONTACT_SUPPORT_CODES = new Set(['80115', '80116']);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const justReset = (location.state as { reset?: boolean } | null)?.reset === true;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Per-field validation messages (empty string = valid).
  const fieldErrors = useMemo(() => ({
    email: !email.trim()
      ? 'Email is required'
      : email.trim().length > 50
        ? 'Email must be at most 50 characters'
        : !EMAIL_RE.test(email.trim())
          ? 'Enter a valid email address'
          : '',
    password: !password
      ? 'Password is required'
      : password.length < 8
        ? 'Password must be at least 8 characters'
        : password.length > 100
          ? 'Password must be at most 100 characters'
          : '',
  }), [email, password]);

  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (hasFieldErrors) {
      setShowErrors(true);
      return;
    }
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

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            maxLength={50}
            value={email}
            aria-invalid={showErrors && !!fieldErrors.email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@houselease.com"
          />
          {showErrors && fieldErrors.email && (
            <span className="field-error">{fieldErrors.email}</span>
          )}

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            maxLength={100}
            value={password}
            aria-invalid={showErrors && !!fieldErrors.password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {showErrors && fieldErrors.password && (
            <span className="field-error">{fieldErrors.password}</span>
          )}

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
