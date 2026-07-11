import type { TokenResponse, UserProfile } from './types';

// Tokens live in localStorage as required so they survive reloads and are sent
// as the bearer token on every request.
const ACCESS_KEY = 'ap_access_token';
const REFRESH_KEY = 'ap_refresh_token';
const USER_KEY = 'ap_user';

export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },

  getUser(): UserProfile | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  },

  save(token: TokenResponse, user: UserProfile): void {
    localStorage.setItem(ACCESS_KEY, token.accessToken);
    localStorage.setItem(REFRESH_KEY, token.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
