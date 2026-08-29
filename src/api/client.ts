import { tokenStorage } from './tokenStorage';
import type {
  AddonRequest,
  AddonView,
  ApiError,
  ChangePackageRequest,
  ContractorDetailView,
  ContractorUpdateRequest,
  ContractorView,
  LandlordAccountPage,
  LandlordBillingResponse,
  LandlordDetailsResponse,
  LoginResponse,
  MessageResponse,
  MileageRateRequest,
  MileageRateView,
  OnboardLandlordRequest,
  PackageOption,
  PackageRequest,
  PackageView,
  ResetTokenInfo,
  UpdateLandlordRequest,
  DashboardSummary,
} from './types';

// Backend origin. Empty in dev so the Vite proxy handles /managehouselease/*; set to the
// deployed admin-portal-service origin in production via VITE_API_BASE_URL.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const BASE = `${API_BASE}/managehouselease/adminportal`;
const ONBOARDING = `${API_BASE}/managehouselease/onboarding`;
const DASHBOARD = `${API_BASE}/managehouselease/dashboard`;
const PACKAGES = `${API_BASE}/managehouselease/packages`;
const ADDONS = `${API_BASE}/managehouselease/addons`;
const MILEAGE_RATES = `${API_BASE}/managehouselease/mileage-rates`;
const CONTRACTORS = `${API_BASE}/managehouselease/contractors`;

export class ApiRequestError extends Error {
  errorCode: string;
  status: number;
  constructor(status: number, body: ApiError) {
    super(body.errorDescription || 'Request failed');
    this.errorCode = body.errorCode;
    this.status = status;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    return (await res.json()) as ApiError;
  } catch {
    return { errorCode: 'UNKNOWN', errorDescription: `HTTP ${res.status}` };
  }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new ApiRequestError(res.status, await parseError(res));
  }
  return (await res.json()) as LoginResponse;
}

// ---------- Password reset (public, no auth) ----------

async function publicJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    throw new ApiRequestError(res.status, await parseError(res));
  }
  return (await res.json()) as T;
}

/** Login page "Forgot password?": ask the server to email a one-time password (OTP). */
export function forgotPassword(email: string): Promise<MessageResponse> {
  return publicJson<MessageResponse>('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Complete a password reset with the emailed OTP. */
export function verifyOtp(email: string, otp: string, newPassword: string): Promise<MessageResponse> {
  return publicJson<MessageResponse>('/verify', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword }),
  });
}

/** Validate a reset token and get the email to prefill on the reset page. */
export function validateResetToken(token: string): Promise<ResetTokenInfo> {
  return publicJson<ResetTokenInfo>(`/reset-password/validate?token=${encodeURIComponent(token)}`);
}

/** Complete a password reset with the emailed token. */
export function resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
  return publicJson<MessageResponse>('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    tokenStorage.clear();
    return false;
  }
  const data = (await res.json()) as LoginResponse;
  tokenStorage.save(data.token, data.user);
  return true;
}

/**
 * Authenticated fetch: attaches the bearer access token, and on a 401 transparently
 * refreshes once and retries. If the refresh fails the caller gets the 401.
 * `url` is an absolute app path (e.g. "/managehouselease/onboarding/list").
 */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const withAuth = (): RequestInit => ({
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${tokenStorage.getAccessToken() ?? ''}`,
    },
  });

  let res = await fetch(url, withAuth());
  if (res.status === 401 && (await refreshTokens())) {
    res = await fetch(url, withAuth());
  }
  return res;
}

/** Authenticated JSON request that throws ApiRequestError on non-2xx. */
async function authJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    throw new ApiRequestError(res.status, await parseError(res));
  }
  return (await res.json()) as T;
}

// ---------- Dashboard ----------

/** Counts, MRR, 12-month revenue, package mix and the needs-attention feed in one read. */
export function getDashboardSummary(): Promise<DashboardSummary> {
  return authJson<DashboardSummary>(`${DASHBOARD}/summary`);
}

// ---------- Onboarding API ----------

/**
 * `search` matches customer id, business name, email, phone or EIN (partial, case-insensitive).
 * `page` is zero-based; the backend returns 10 accounts per page.
 */
export function listLandlords(search?: string, page = 0): Promise<LandlordAccountPage> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set('search', search.trim());
  if (page > 0) params.set('page', String(page));
  const query = params.toString();
  return authJson<LandlordAccountPage>(`${ONBOARDING}/list${query ? `?${query}` : ''}`);
}

export function listPackages(): Promise<PackageOption[]> {
  return authJson<PackageOption[]>(`${ONBOARDING}/packages`);
}

export function getLandlordDetails(accountId: string): Promise<LandlordDetailsResponse> {
  return authJson<LandlordDetailsResponse>(`${ONBOARDING}/${accountId}/details`);
}

export function getLandlordBilling(accountId: string): Promise<LandlordBillingResponse> {
  return authJson<LandlordBillingResponse>(`${ONBOARDING}/${accountId}/billing`);
}

export function changeLandlordPackage(
  accountId: string,
  body: ChangePackageRequest,
): Promise<LandlordDetailsResponse> {
  return authJson<LandlordDetailsResponse>(`${ONBOARDING}/${accountId}/change-package`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function addLandlord(body: OnboardLandlordRequest): Promise<LandlordDetailsResponse> {
  return authJson<LandlordDetailsResponse>(`${ONBOARDING}/add`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateLandlord(
  accountId: string,
  body: UpdateLandlordRequest,
): Promise<LandlordDetailsResponse> {
  return authJson<LandlordDetailsResponse>(`${ONBOARDING}/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// ---------- Package catalogue API ----------

export function listAllPackages(): Promise<PackageView[]> {
  return authJson<PackageView[]>(`${PACKAGES}/list`);
}

export function addPackage(body: PackageRequest): Promise<PackageView> {
  return authJson<PackageView>(`${PACKAGES}/add`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updatePackage(packageId: string, body: PackageRequest): Promise<PackageView> {
  return authJson<PackageView>(`${PACKAGES}/${packageId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// ---------- Add-on catalogue API ----------

export function listAllAddons(): Promise<AddonView[]> {
  return authJson<AddonView[]>(`${ADDONS}/list`);
}

export function addAddon(body: AddonRequest): Promise<AddonView> {
  return authJson<AddonView>(`${ADDONS}/add`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateAddon(adonsId: string, body: AddonRequest): Promise<AddonView> {
  return authJson<AddonView>(`${ADDONS}/${adonsId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// ---------- IRS mileage rate API ----------

export function listAllMileageRates(): Promise<MileageRateView[]> {
  return authJson<MileageRateView[]>(`${MILEAGE_RATES}/list`);
}

export function addMileageRate(body: MileageRateRequest): Promise<MileageRateView> {
  return authJson<MileageRateView>(`${MILEAGE_RATES}/add`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateMileageRate(mileageRateId: string, body: MileageRateRequest): Promise<MileageRateView> {
  return authJson<MileageRateView>(`${MILEAGE_RATES}/${mileageRateId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// ---------- Contractor API ----------

export function listAllContractors(): Promise<ContractorView[]> {
  return authJson<ContractorView[]>(`${CONTRACTORS}/list`);
}

export function getContractor(contractorId: string): Promise<ContractorDetailView> {
  return authJson<ContractorDetailView>(`${CONTRACTORS}/${contractorId}`);
}

export function updateContractor(contractorId: string, body: ContractorUpdateRequest): Promise<ContractorDetailView> {
  return authJson<ContractorDetailView>(`${CONTRACTORS}/${contractorId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
