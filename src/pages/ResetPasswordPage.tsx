import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { validateResetToken, resetPassword, ApiRequestError } from '../api/client';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const emailFromLink = params.get('email') ?? '';

  const [email, setEmail] = useState(emailFromLink);
  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Validate the token on load; the server's email is authoritative for prefill.
  useEffect(() => {
    if (!token) {
      setChecking(false);
      setError('This password reset link is missing its token.');
      return;
    }
    let active = true;
    validateResetToken(token)
      .then((info) => {
        if (!active) return;
        setTokenValid(info.valid);
        if (info.email) setEmail(info.email);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof ApiRequestError ? e.message : 'Could not validate the reset link.');
      })
      .finally(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err instanceof ApiRequestError ? `${err.message} (${err.errorCode})` : 'Reset failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>Reset Password</h1>

        {checking ? (
          <p className="subtitle">Validating your reset link…</p>
        ) : done ? (
          <>
            <p className="subtitle">Your password has been reset.</p>
            <p className="muted">Redirecting to sign in…</p>
            <Link className="link" to="/login">Go to sign in now</Link>
          </>
        ) : !tokenValid ? (
          <>
            {error && <div className="error" role="alert">{error}</div>}
            <p className="muted">
              This reset link is invalid or has expired. Please request a new one from the sign-in page.
            </p>
            <Link className="link" to="/login">Back to sign in</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="subtitle">Set a new password for your account.</p>

            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} readOnly disabled />

            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />

            <label htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            {error && <div className="error" role="alert">{error}</div>}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset Password'}
            </button>
            <Link className="link" to="/login">Back to sign in</Link>
          </form>
        )}
      </div>
    </div>
  );
}
