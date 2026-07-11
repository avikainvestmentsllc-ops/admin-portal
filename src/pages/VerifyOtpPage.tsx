import { useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { verifyOtp, ApiRequestError } from '../api/client';

// Account locked (too many attempts) or reset not allowed → point the user to support.
const LOCKED_CODES = new Set(['80115', '80114']);

export default function VerifyOtpPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const justSent = (location.state as { sent?: boolean } | null)?.sent === true;

  const [email, setEmail] = useState(params.get('email') ?? '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
      await verifyOtp(email.trim(), otp.trim(), password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true, state: { reset: true } }), 2000);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (LOCKED_CODES.has(err.errorCode)) {
          setLocked(true);
          setError(`${err.message} Please contact customer service.`);
        } else {
          setError(err.message);
        }
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
        <h1>Enter your code</h1>

        {done ? (
          <>
            <p className="subtitle">Your password has been reset.</p>
            <p className="muted">Redirecting to sign in…</p>
            <Link className="link" to="/login">Go to sign in now</Link>
          </>
        ) : (
          <>
            <p className="subtitle">
              We sent a one-time code to your email. Enter it below with your new password.
            </p>

            {justSent && <div className="notice" role="status">A OTP is sent to your email.</div>}

            <form onSubmit={handleSubmit}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label htmlFor="otp">OTP</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                required
              />

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

              {!locked && (
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Verifying…' : 'Reset Password'}
                </button>
              )}
            </form>

            {locked ? (
              <Link className="link" to="/login">Back to sign in</Link>
            ) : (
              <Link className="link" to="/forgot-password">Didn’t get a code? Request a new OTP</Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
