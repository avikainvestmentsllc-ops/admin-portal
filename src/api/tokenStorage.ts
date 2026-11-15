import type { UserProfile } from './types';

// The sign-in tokens are HttpOnly cookies set by admin-portal-service (ap_at / ap_rt), so no script
// on the page can read them. Only the (non-secret) profile is kept here, as "who is signed in".
const USER_KEY = 'ap_user';
// Where the tokens used to live: read once to move an existing session onto cookies, then removed.
const LEGACY_ACCESS = 'ap_access_token';
const LEGACY_REFRESH = 'ap_refresh_token';

export const tokenStorage = {
  getUser(): UserProfile | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  },

  saveUser(user: UserProfile): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  /** A refresh token from before the cookies, removed as it is read (both legacy keys go). */
  takeLegacyRefreshToken(): string | null {
    const token = localStorage.getItem(LEGACY_REFRESH);
    localStorage.removeItem(LEGACY_ACCESS);
    localStorage.removeItem(LEGACY_REFRESH);
    return token;
  },

  clear(): void {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LEGACY_ACCESS);
    localStorage.removeItem(LEGACY_REFRESH);
  },
};
