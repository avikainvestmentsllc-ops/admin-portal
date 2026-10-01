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

/** The one address wire shape shared by every client and both services. */
export interface AddressDto {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zipCode: string;
  country?: string | null;
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
  businessAddress: AddressDto | null;
  /** Server-built single-line address. */
  formattedAddress: string | null;
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

/** An add-on on an account's package, as the server returns it (name and price resolved from the catalogue). */
export interface SelectedAddon {
  id: string;
  name: string;
  count: number;
  price: number;
}

/** An add-on selection as sent to the server: the catalogue add-on and how many. */
export interface AddonSelection {
  id: string;
  count: number;
}

export interface LandlordPackageView {
  accountPackageId: string;
  accountId: string;
  packageId: string;
  accountPackageName: string;
  addOns: SelectedAddon[];
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
  /** The package + add-ons snapshot the bill was generated from. */
  packageDetails: PackageDetails | null;
}

export interface PackageDetails {
  accountPackageId: string;
  accountPackageName: string | null;
  addOns: SelectedAddon[];
}

export interface LandlordBillingResponse {
  account: LandlordAccountView;
  billing: BillingView[];
}

export interface ChangePackageRequest {
  packageId: string;
  addOns?: AddonSelection[];
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

// ---------- Package catalogue (landlord_package) ----------

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

// ---------- Add-on catalogue (landlord_package_addon) ----------

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

// ---------- IRS mileage rate (irs_mileage_rate) ----------

export interface MileageRateView {
  mileageRateId: string;
  taxYear: number;
  ratePerMile: number;
  createTimeUtc: string | null;
  updateTimeUtc: string | null;
}

export interface MileageRateRequest {
  taxYear: number;
  ratePerMile: number;
}

export interface ContractorView {
  contractorId: string;
  companyName: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  phoneNumber: string | null;
  email: string | null;
  isActive: boolean | null;
}

/** Cities, ZIP codes and radius, as the admin service stores them. */
export interface ContractorServiceArea {
  cities: string[] | null;
  zipcodes: string[] | null;
  radiusMiles: number | null;
}

/**
 * Full row on the Admin > Contractors edit panel — the admin service's `ContractorDetailView`.
 * `services` are the contractor's Business Services (rental-service's maintenance categories),
 * as id+name pairs so the checklist can pre-select by id.
 */
export interface ContractorDetailView {
  contractorId: string;
  companyName: string | null;
  businessEin: string | null;
  phoneNumber: string | null;
  businessPhoneExtension: string | null;
  businessWebsite: string | null;
  contactFirstName: string | null;
  contactMiddleName: string | null;
  contactLastName: string | null;
  email: string | null;
  services: ContractorServiceOption[];
  serviceArea: ContractorServiceArea | null;
  licenseNumber: string | null;
  licenseIssueState: string | null;
  licenseExpiryDate: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insuranceExpiryDate: string | null;
  isActive: boolean | null;
  /** ISO instant of the administrator's approval; null until the business has been activated. */
  activatedAt: string | null;
}

/**
 * PUT /contractors/{id} — the admin service's `ContractorUpdateRequest`. Company name, phone and
 * at least one service are required there; the email is not editable (it is the login).
 */
export interface ContractorUpdateRequest {
  companyName: string;
  businessEin: string | null;
  phoneNumber: string;
  businessPhoneExtension: string | null;
  businessWebsite: string | null;
  contactFirstName: string | null;
  contactMiddleName: string | null;
  contactLastName: string | null;
  serviceIds: string[];
  serviceArea: ContractorServiceArea | null;
  licenseNumber: string | null;
  licenseIssueState: string | null;
  licenseExpiryDate: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insuranceExpiryDate: string | null;
  isActive: boolean;
}

export interface OnboardLandlordRequest {
  email: string;
  phoneNumber: string;
  businessName: string;
  businessEin: string;
  businessAddress: AddressDto;
  businessContact: BusinessContact;
  accountStatus: boolean;
  packageId: string;
  addOns?: AddonSelection[];
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
  businessAddress: AddressDto;
  businessContact: BusinessContact;
  accountStatus: boolean;
  addOns?: AddonSelection[];
  packageStartDate?: string | null;
  packageEndDate?: string | null;
  freeTrialStartDate?: string | null;
  freeTrialEndDate?: string | null;
  billingDate?: string | null;
  billingStatus?: boolean;
}

// ---------- Dashboard ----------

export interface DashboardMonthRevenue { month: string; packages: number; addons: number; }
export interface DashboardPackageMix { packageId: string; packageName: string; price: number; accounts: number; }
export interface DashboardAttentionItem {
  kind: 'INACTIVE_LANDLORD' | 'EXPIRING_ADDON' | 'INACTIVE_CONTRACTOR' | 'MISSING_MILEAGE_RATE' | string;
  label: string;
  detail: string;
  tag: string;
  targetId: string | null;
}
export interface DashboardSummary {
  totalLandlords: number;
  activeLandlords: number;
  inactiveLandlords: number;
  registeredContractors: number;
  activeContractors: number;
  totalPackages: number;
  activePackages: number;
  totalAddons: number;
  activeAddons: number;
  monthlyRecurringRevenue: number;
  revenue: DashboardMonthRevenue[];
  packageMix: DashboardPackageMix[];
  attention: DashboardAttentionItem[];
}

// ---------- Platform fees (contractor_pricing_sheet / platform_fee / platform_invoice) ----------

/** One line of a pricing sheet; `isDefault` marks the "all other categories" row. */
export interface PricingRow {
  rowId?: string | null;
  categoryId: string | null;
  categoryName: string | null;
  baseFee: number;
  pctThreshold: number;
  pctRate: number;
  maxFee: number | null;
  isDefault: boolean;
}

export type PricingSource = 'OVERRIDE' | 'ACCEPTED_TEMPLATE' | 'CURRENT_TEMPLATE' | 'DEFAULT';

/** A pricing sheet as it applies to a contractor. `sheetId` is null when the platform's configured default applies. */
export interface PricingSheet {
  sheetId: string | null;
  kind: 'MASTER' | 'CONTRACTOR' | null;
  source: PricingSource;
  version: number | null;
  effectiveFrom: string | null;
  title: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string | null;
  rows: PricingRow[];
}

/** A master template version on the Pricing Terms page. */
export interface PricingTermsVersion {
  sheetId: string;
  version: number;
  state: 'EFFECTIVE' | 'SCHEDULED' | 'SUPERSEDED';
  effectiveFrom: string;
  title: string | null;
  note: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  createdBy: string | null;
  createdAt: string;
  acceptances: number;
  rows: PricingRow[];
}

export interface PricingRowRequest {
  categoryId: string | null;
  baseFee: number;
  pctThreshold: number;
  pctRate: number;
  maxFee: number | null;
}

/** A new sheet version. `effectiveFrom` (yyyy-MM-dd) and `title` matter for the master template only. */
export interface PricingSheetRequest {
  effectiveFrom: string | null;
  title: string | null;
  note: string | null;
  rows: PricingRowRequest[];
}

export interface CategoryOption {
  categoryId: string;
  name: string;
}

/** The default-row rule the overview shows; `platformDefault` when no sheet applies. */
export interface FeeRule {
  sheetId: string | null;
  version: number | null;
  baseFee: number;
  pctThreshold: number;
  pctRate: number;
  maxFee: number | null;
  effectiveFrom: string | null;
  note: string | null;
  createdBy: string | null;
  platformDefault: boolean;
}

export interface ContractorFeeOverview {
  contractorId: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  isActive: boolean | null;
  rule: FeeRule;
  pricingSource: PricingSource;
  sheetVersion: number | null;
  termsVersion: number | null;
  jobsThisMonth: number;
  accruedThisMonth: number;
  unbilledJobs: number;
  unbilled: number;
  openInvoices: number;
  outstanding: number;
  lifetime: number;
}

export interface PlatformFeeRow {
  feeId: string;
  maintenanceId: string;
  title: string;
  categoryName: string | null;
  jobAmount: number;
  baseFee: number;
  pctFee: number;
  totalFee: number;
  capped: boolean;
  assessedAt: string;
  status: 'ACCRUED' | 'INVOICED' | 'WAIVED';
  invoiceId: string | null;
  invoiceNumber: string | null;
  pricingSource: PricingSource | null;
  sheetVersion: number | null;
}

export interface PlatformInvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  jobCount: number;
  totalAmount: number;
  status: 'ISSUED' | 'PAID' | 'VOID';
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  paidNote: string | null;
  voidedAt: string | null;
  voidNote: string | null;
}

export interface TermsAcceptance {
  sheetId: string;
  version: number | null;
  acceptedAt: string;
  ipAddress: string | null;
}

export interface ContractorFeeDetail {
  contractorId: string;
  companyName: string | null;
  email: string | null;
  rule: FeeRule;
  pricing: PricingSheet;
  overrideHistory: PricingSheet[];
  termsAccepted: TermsAcceptance | null;
  jobsThisMonth: number;
  accruedThisMonth: number;
  unbilledJobs: number;
  unbilled: number;
  openInvoices: number;
  outstanding: number;
  lifetime: number;
  fees: PlatformFeeRow[];
  invoices: PlatformInvoiceRow[];
}

/** A statement on the Statements tab, with who owes it. */
export interface PlatformStatementRow extends PlatformInvoiceRow {
  contractorId: string;
  companyName: string | null;
  email: string | null;
  notifiedAt: string | null;
}

export interface PlatformStatementDetail {
  statement: PlatformStatementRow;
  lines: PlatformFeeRow[];
}

export interface StatementRunFailure {
  contractorId: string | null;
  message: string;
}

export interface StatementRun {
  runId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  triggerType: 'SCHEDULED' | 'MANUAL';
  requestedBy: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: 'REQUESTED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  contractorsSeen: number;
  statementsCreated: number;
  statementsUpdated: number;
  feesBilled: number;
  feesCarried: number;
  totalBilled: number;
  failures: StatementRunFailure[];
}

/** A reconcile has been queued; rental-service runs it within seconds. */
export interface ReconcileRequested {
  runId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}

/** One selectable Business Service (GET /contractors/services) — named after a maintenance category. */
export interface ContractorServiceOption {
  id: string;
  name: string;
}
