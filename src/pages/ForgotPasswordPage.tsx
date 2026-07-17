import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgotPassword, ApiRequestError } from '../api/client';
import { toAuthUserMessage } from '../api/errorMessages';

// Reset not allowed (locked/inactive) → point the user to support.
const CONTACT_SUPPORT_CODES = new Set(['80114']);

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      // Move to the OTP + new-password screen, carrying the email along.
      navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`, { state: { sent: true } });
    } catch (err) {
      if (err instanceof ApiRequestError && CONTACT_SUPPORT_CODES.has(err.errorCode)) {
        setError(`${err.message} Please contact customer service.`);
      } else {
        setError(toAuthUserMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>Reset Password</h1>
        <p className="subtitle">Enter your email and we’ll send you a one-time code.</p>

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

          {error && <div className="error" role="alert">{error}</div>}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send OTP'}
          </button>
        </form>

        <Link className="link" to="/login">Back to sign in</Link>
      </div>
    </div>
  );
}
