import { ApiRequestError } from './client';

const GENERIC_FALLBACK = 'Something went wrong. Please try again later!';

// Backend codes that should never surface their raw description in the UI.
const GENERIC_FALLBACK_CODES = new Set(['80199']);

/** Map a caught error to a user-friendly message, per business-error-code.md UI rules. */
export function toUserMessage(err: unknown, fallback = 'Save failed'): string {
  if (err instanceof ApiRequestError) {
    return GENERIC_FALLBACK_CODES.has(err.errorCode) ? GENERIC_FALLBACK : err.message;
  }
  return fallback;
}

// Error codes login/forgot-password know how to explain to the user. Anything else
// (including 80199) is unrecognized and falls back to the generic message.
const AUTH_KNOWN_CODES = new Set([
  '80100', // invalid email or password
  '80105', // request validation failed
  '80112', // no account found for that email
  '80114', // reset not allowed
  '80115', // account locked
  '80116', // account inactive
  '80117', // account expired
]);

/** Map a login/forgot-password error to a user-friendly message; unrecognized codes get the generic fallback. */
export function toAuthUserMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    return AUTH_KNOWN_CODES.has(err.errorCode) ? err.message : GENERIC_FALLBACK;
  }
  return GENERIC_FALLBACK;
}
