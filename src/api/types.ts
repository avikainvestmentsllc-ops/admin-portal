export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
}

export interface UserProfile {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  roles: string[];
}

export interface LoginResponse {
  token: TokenResponse;
  user: UserProfile;
}

export interface ApiError {
  errorCode: string;
  errorDescription: string;
}

// ---------- Password reset ----------

export interface ResetTokenInfo {
  email: string;
  valid: boolean;
}

export interface MessageResponse {
  message: string;
}

// ---------- Onboarding ----------

export interface BusinessAddress {
  address_line1: string;
  address_line2?: string;
  City: string;
  State: string;
  ZipCode: string;
}

export interface BusinessContact {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

export interface LandlordAccountView {
  accountId: string;
  customerAccountId: string;
  email: string;
  phoneNumber: string;
  businessName: string;
  businessEin: string;
  businessAddress: BusinessAddress | null;
  businessContact: BusinessContact | null;
  accountStatus: boolean;
  packageName: string | null;
  createTimeUtc: string;
  updateTimeUtc: string;
}

/** One page of the onboarding accounts list; `page` is zero-based. */
export interface LandlordAccountPage {
  content: LandlordAccountView[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface LandlordPackageView {
  accountPackageId: string;
  accountId: string;
  accountPackageName: string;
  addOns: unknown[];
  packageStartDate: string | null;
  packageEndDate: string | null;
  freeTrialStartDate: string | null;
  freeTrialEndDate: string | null;
  billingDate: string | null;
  billingStatus: boolean;
  createTimeUtc: string | null;
  updateTimeUtc: string | null;
}

export interface LandlordDetailsResponse {
  account: LandlordAccountView;
  packages: LandlordPackageView[];
}

// ---------- Billing (landlord_billing) ----------

export interface BillingView {
  billingId: string;
  accountId: string;
  billingDateUtc: string | null;
  packageAmount: number | null;
  adonsAmount: number | null;
  subTotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
}

export interface LandlordBillingResponse {
  account: LandlordAccountView;
  billing: BillingView[];
}

export interface ChangePackageRequest {
  packageId: string;
  addOns?: unknown[];
}

export interface AddonOption {
  adonsId: string;
  adonsPackageId: string;
  adonsName: string;
  adonsCount: number | null;
  adonsPrice: number | null;
}

export interface PackageOption {
  packageId: string;
  packageName: string;
  addOns: AddonOption[];
}

// ---------- Package catalogue (landlord_package_lookup) ----------

export interface PackageView {
  packageId: string;
  packageName: string;
  packageDescription: string | null;
  packageStatus: boolean;
  packagePrice: number | null;
  effectiveStartDateUtc: string | null;
  effectiveEndDateUtc: string | null;
  createTimeUtc: string | null;
  updateTimeUtc: string | null;
}

export interface PackageRequest {
  packageName: string;
  packageDescription?: string | null;
  packageStatus: boolean;
  packagePrice: number;
  effectiveStartDateUtc?: string | null;
  effectiveEndDateUtc?: string | null;
}

// ---------- Add-on catalogue (landlord_package_adons) ----------

export interface AddonView {
  adonsId: string;
  adonsPackageId: string;
  adonsName: string;
  adonsDescription: string | null;
  adonsCount: number | null;
  adonsPrice: number | null;
  adonsStatus: boolean;
  adonsStartTimeUtc: string | null;
  adonsEndTimeUtc: string | null;
  adonsCreateTimeUtc: string | null;
  adonsUpdateTimeUtc: string | null;
}

export interface AddonRequest {
  adonsPackageId: string;
  adonsName: string;
  adonsDescription?: string | null;
  adonsCount: number;
  adonsPrice: number;
  adonsStatus: boolean;
  adonsStartTimeUtc: string;
  adonsEndTimeUtc: string | null;
}

/** Shape persisted into landlord_account_package.add_ons (JSON array). */
export interface SelectedAddon {
  adons_id: string;
  adons_package_id: string;
  adons_name: string;
  adons_count: number;
  adons_price: number;
}

export interface OnboardLandlordRequest {
  email: string;
  phoneNumber: string;
  businessName: string;
  businessEin: string;
  businessAddress: BusinessAddress;
  businessContact: BusinessContact;
  accountStatus: boolean;
  packageId: string;
  addOns?: unknown[];
  packageStartDate: string;
  packageEndDate?: string | null;
  freeTrialStartDate?: string | null;
  freeTrialEndDate?: string | null;
  billingDate: string;
  billingStatus?: boolean;
}

export interface UpdateLandlordRequest {
  email: string;
  phoneNumber: string;
  businessName: string;
  businessEin: string;
  businessAddress: BusinessAddress;
  businessContact: BusinessContact;
  accountStatus: boolean;
  addOns?: unknown[];
  packageStartDate?: string | null;
  packageEndDate?: string | null;
  freeTrialStartDate?: string | null;
  freeTrialEndDate?: string | null;
  billingDate?: string | null;
  billingStatus?: boolean;
}
