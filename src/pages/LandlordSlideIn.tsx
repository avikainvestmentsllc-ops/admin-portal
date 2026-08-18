import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  addLandlord,
  getLandlordDetails,
  updateLandlord,
  ApiRequestError,
} from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type {
  LandlordDetailsResponse,
  OnboardLandlordRequest,
  PackageOption,
  SelectedAddon,
  UpdateLandlordRequest,
} from '../api/types';
import { loadGoogleMaps, getComponent } from '../utils/googleMaps';

export type SlideMode = 'view' | 'edit' | 'add';

interface Props {
  mode: SlideMode;
  accountId: string | null;
  packages: PackageOption[];
  onClose: () => void;
  onSaved: () => void;
}

/** Convert a UTC ISO string to a value usable by <input type="date"> (local calendar date). */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Convert a date-only input value (YYYY-MM-DD) to a UTC ISO string, defaulting to
 * 00:00 local time before converting. Returns null if empty.
 */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const [y, m, day] = value.split('-').map(Number);
  if (!y || !m || !day) return null;
  // Midnight (00:00:00) in the viewer's local timezone, then converted to UTC.
  const d = new Date(y, m - 1, day, 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ---------- phone & EIN formatting / validation ----------

/** Keep only digits. */
function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

/** Format up to 10 digits as (XXX) XXX-XXXX progressively as the user types. */
function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 10);
  if (d.length === 0) return '';
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Format up to 9 digits as XX-XXXXXXX progressively as the user types. */
function formatEin(value: string): string {
  const d = onlyDigits(value).slice(0, 9);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}-${d.slice(2)}`;
}

/** US phone: exactly 10 digits. */
function isValidPhone(value: string): boolean {
  return onlyDigits(value).length === 10;
}

/** US EIN: exactly 9 digits. */
function isValidEin(value: string): boolean {
  return onlyDigits(value).length === 9;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[A-Za-z ]+$/;
const BUSINESS_NAME_RE = /^[A-Za-z0-9 .,-]+$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

/** Today's date as a yyyy-MM-dd string in the viewer's local timezone (for date-input min/comparisons). */
function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Add one calendar day to a YYYY-MM-DD input value; '' stays ''. */
function nextDay(value: string): string {
  if (!value) return '';
  const [y, m, day] = value.split('-').map(Number);
  if (!y || !m || !day) return '';
  const d = new Date(y, m - 1, day, 0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface FormState {
  email: string;
  phoneNumber: string;
  businessName: string;
  businessEin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhoneNumber: string;
  accountStatus: boolean;
  packageId: string;
  packageName: string;
  selectedAddons: SelectedAddon[];
  packageStartDate: string;
  packageEndDate: string;
  freeTrialStartDate: string;
  freeTrialEndDate: string;
  billingDate: string;
  billingStatus: boolean;
}

const EMPTY: FormState = {
  email: '', phoneNumber: '', businessName: '', businessEin: '',
  addressLine1: '', addressLine2: '', city: '', state: '', zipCode: '',
  contactFirstName: '', contactLastName: '', contactEmail: '', contactPhoneNumber: '',
  accountStatus: true, packageId: '', packageName: '', selectedAddons: [],
  packageStartDate: '', packageEndDate: '', freeTrialStartDate: '',
  freeTrialEndDate: '', billingDate: '', billingStatus: false,
};

/** Parse the account-package add_ons JSON into typed selected add-ons. */
function parseSelectedAddons(raw: unknown): SelectedAddon[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((x) => ({
      adons_id: String(x.adons_id ?? ''),
      adons_package_id: String(x.adons_package_id ?? ''),
      adons_name: String(x.adons_name ?? ''),
      adons_count: Number(x.adons_count ?? 0),
      adons_price: Number(x.adons_price ?? 0),
    }));
}

export default function LandlordSlideIn({ mode, accountId, packages, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(mode !== 'add');
  const [saving, setSaving] = useState(false);
  // Load failure only — shown inline at the top since no form is rendered yet.
  const [loadError, setLoadError] = useState<string | null>(null);
  // Submit failure, shown at the top of the slide-in.
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Set once a save succeeds; the panel stays open so the user sees this instead of auto-closing.
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // Id of the landlord created by this panel's own add, once saved — further submits update it.
  const [createdId, setCreatedId] = useState<string | null>(null);
  // Once the user tries to submit, surface inline validation messages.
  const [showErrors, setShowErrors] = useState(false);
  // Scrolled into view whenever a success/error message appears, so it's visible on mobile
  // even if the user submitted from further down the (long) form.
  const messageRef = useRef<HTMLDivElement>(null);

  const readOnly = mode === 'view';
  // Once a new landlord has been created, its locked fields behave like an existing one's.
  const isNewlySaved = mode === 'add' && !!createdId;
  const fieldsLocked = mode === 'edit' || isNewlySaved;
  const title = mode === 'add'
    ? (isNewlySaved ? 'Edit Landlord' : 'Onboard Landlord')
    : mode === 'edit' ? 'Edit Landlord' : 'Landlord Details';

  useEffect(() => {
    if (mode === 'add' || !accountId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getLandlordDetails(accountId)
      .then((d: LandlordDetailsResponse) => {
        if (!active) return;
        const a = d.account;
        const p = d.packages[0];
        setForm({
          email: a.email,
          phoneNumber: formatPhone(a.phoneNumber),
          businessName: a.businessName,
          businessEin: formatEin(a.businessEin),
          addressLine1: a.businessAddress?.address_line1 ?? '',
          addressLine2: a.businessAddress?.address_line2 ?? '',
          city: a.businessAddress?.City ?? '',
          state: a.businessAddress?.State ?? '',
          zipCode: a.businessAddress?.ZipCode ?? '',
          contactFirstName: a.businessContact?.firstName ?? '',
          contactLastName: a.businessContact?.lastName ?? '',
          contactEmail: a.businessContact?.email ?? '',
          contactPhoneNumber: formatPhone(a.businessContact?.phoneNumber ?? ''),
          accountStatus: a.accountStatus,
          packageId: '',
          packageName: p?.accountPackageName ?? '',
          selectedAddons: parseSelectedAddons(p?.addOns),
          packageStartDate: isoToLocalInput(p?.packageStartDate),
          packageEndDate: isoToLocalInput(p?.packageEndDate),
          freeTrialStartDate: isoToLocalInput(p?.freeTrialStartDate),
          freeTrialEndDate: isoToLocalInput(p?.freeTrialEndDate),
          billingDate: isoToLocalInput(p?.billingDate),
          billingStatus: p?.billingStatus ?? false,
        });
      })
      .catch((e) => setLoadError(e instanceof ApiRequestError ? e.message : 'Failed to load details'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [mode, accountId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedMessage(null);
  };

  // ── Google Places autocomplete on the Address Line 1 field ─────────────────
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (readOnly) return;
    let listener: { remove: () => void } | undefined;
    loadGoogleMaps()
      .then((maps) => {
        if (!addressInputRef.current) return;
        const autocomplete = new maps.places.Autocomplete(addressInputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['address_components'],
        });
        listener = autocomplete.addListener('place_changed', () => {
          const components = autocomplete.getPlace().address_components;
          if (!components) return;

          const streetNumber = getComponent(components, 'street_number')?.long_name ?? '';
          const route = getComponent(components, 'route')?.long_name ?? '';
          const city =
            getComponent(components, 'locality')?.long_name ??
            getComponent(components, 'sublocality')?.long_name ??
            getComponent(components, 'postal_town')?.long_name ??
            '';
          const state = getComponent(components, 'administrative_area_level_1')?.short_name ?? '';
          const zipCode = getComponent(components, 'postal_code')?.long_name ?? '';

          setForm((f) => ({
            ...f,
            addressLine1: [streetNumber, route].filter(Boolean).join(' '),
            city,
            state: state && US_STATES.includes(state) ? state : f.state,
            zipCode,
          }));
          setSavedMessage(null);
        });
        // Suppress the browser's native suggestion dropdown so it doesn't overlap Google's.
        addressInputRef.current.setAttribute('autocomplete', 'off');
      })
      .catch(() => {
        // No key configured or the script failed to load — the field silently stays a plain input.
      });

    return () => {
      listener?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // The package chosen in the dropdown (add mode) — its addOns drive the selectable list.
  const selectedPackage = useMemo(
    () => packages.find((p) => p.packageId === form.packageId) ?? null,
    [packages, form.packageId],
  );

  const isAddonSelected = (adonsId: string) =>
    form.selectedAddons.some((a) => a.adons_id === adonsId);

  // Toggle an add-on on/off, defaulting its count to the add-on's configured count (min 1).
  const toggleAddon = (opt: PackageOption['addOns'][number], checked: boolean) => {
    setForm((f) => {
      if (checked) {
        if (f.selectedAddons.some((a) => a.adons_id === opt.adonsId)) return f;
        const next: SelectedAddon = {
          adons_id: opt.adonsId,
          adons_package_id: opt.adonsPackageId,
          adons_name: opt.adonsName,
          adons_count: opt.adonsCount ?? 1,
          adons_price: opt.adonsPrice ?? 0,
        };
        return { ...f, selectedAddons: [...f.selectedAddons, next] };
      }
      return { ...f, selectedAddons: f.selectedAddons.filter((a) => a.adons_id !== opt.adonsId) };
    });
  };

  // When the package changes in add mode, drop any previously-selected add-ons.
  const onPackageChange = (packageId: string) =>
    setForm((f) => ({ ...f, packageId, selectedAddons: [] }));

  // When a free-trial end date is present, the package starts the next day and that
  // field becomes read-only. Otherwise the user's entered start date is used.
  const packageStartLocked = !!form.freeTrialEndDate;
  const effectivePackageStart = useMemo(
    () => (packageStartLocked ? nextDay(form.freeTrialEndDate) : form.packageStartDate),
    [packageStartLocked, form.freeTrialEndDate, form.packageStartDate],
  );
  // Billing date is always the day after the (effective) package start date.
  const effectiveBillingDate = useMemo(
    () => nextDay(effectivePackageStart),
    [effectivePackageStart],
  );

  // Future-date checks apply only when onboarding a new landlord — editing an existing
  // landlord's already-started package/free-trial dates must remain possible.
  const today = todayInput();
  const isAdd = mode === 'add';

  // Per-field validation messages (empty string = valid).
  const fieldErrors = useMemo(() => ({
    email: !form.email.trim()
      ? 'Email is required'
      : form.email.trim().length > 50
        ? 'Email must be at most 50 characters'
        : !EMAIL_RE.test(form.email.trim())
          ? 'Enter a valid email address'
          : '',
    phoneNumber: !form.phoneNumber.trim()
      ? 'Phone number is required'
      : !isValidPhone(form.phoneNumber)
        ? 'Phone number must be 10 digits, e.g. (214) 555-9090'
        : '',
    businessEin: !form.businessEin.trim()
      ? 'EIN is required'
      : !isValidEin(form.businessEin)
        ? 'EIN must be 9 digits, e.g. 12-3456789'
        : '',
    businessName: !form.businessName.trim()
      ? 'Business name is required'
      : form.businessName.trim().length > 100
        ? 'Business name must be at most 100 characters'
        : !BUSINESS_NAME_RE.test(form.businessName.trim())
          ? 'Business name may only contain letters, numbers, spaces, periods, commas and hyphens'
          : '',
    addressLine1: !form.addressLine1.trim()
      ? 'Address line 1 is required'
      : form.addressLine1.trim().length > 100
        ? 'Address line 1 must be at most 100 characters'
        : '',
    addressLine2: form.addressLine2.trim().length > 100
      ? 'Address line 2 must be at most 100 characters'
      : '',
    city: !form.city.trim()
      ? 'City is required'
      : form.city.trim().length > 50
        ? 'City must be at most 50 characters'
        : !NAME_RE.test(form.city.trim())
          ? 'City may only contain letters and spaces'
          : '',
    state: !form.state.trim() ? 'State is required' : '',
    zipCode: !form.zipCode.trim()
      ? 'Zip code is required'
      : !ZIP_RE.test(form.zipCode.trim())
        ? 'Enter a valid ZIP code, e.g. 12345 or 12345-6789'
        : '',
    contactFirstName: !form.contactFirstName.trim()
      ? 'First name is required'
      : form.contactFirstName.trim().length > 50
        ? 'First name must be at most 50 characters'
        : !NAME_RE.test(form.contactFirstName.trim())
          ? 'First name may only contain letters and spaces'
          : '',
    contactLastName: !form.contactLastName.trim()
      ? 'Last name is required'
      : form.contactLastName.trim().length > 50
        ? 'Last name must be at most 50 characters'
        : !NAME_RE.test(form.contactLastName.trim())
          ? 'Last name may only contain letters and spaces'
          : '',
    contactEmail: !form.contactEmail.trim()
      ? 'Contact email is required'
      : form.contactEmail.trim().length > 50
        ? 'Contact email must be at most 50 characters'
        : !EMAIL_RE.test(form.contactEmail.trim())
          ? 'Enter a valid email address'
          : '',
    contactPhoneNumber: !form.contactPhoneNumber.trim()
      ? 'Contact phone number is required'
      : !isValidPhone(form.contactPhoneNumber)
        ? 'Phone number must be 10 digits, e.g. (214) 555-9090'
        : '',
    packageId: isAdd && !form.packageId ? 'Please select a package' : '',
    // Package start (effective) is mandatory; billing date derives from it. Today-or-future
    // only enforced on add — editing an already-started package must remain possible.
    packageStartDate: !effectivePackageStart
      ? 'Package start date is required'
      : isAdd && effectivePackageStart < today
        ? 'Package start date must be today or a future date'
        : '',
    // A free-trial start requires a free-trial end date, and (on add) both must be future
    // dates with the end after the start.
    freeTrialStartDate: isAdd && form.freeTrialStartDate && form.freeTrialStartDate <= today
      ? 'Free trial start date must be in the future'
      : '',
    freeTrialEndDate: form.freeTrialStartDate && !form.freeTrialEndDate
      ? 'Free trial end date is required when a free trial start date is set'
      : isAdd && form.freeTrialEndDate && form.freeTrialEndDate <= today
        ? 'Free trial end date must be in the future'
        : form.freeTrialStartDate && form.freeTrialEndDate && form.freeTrialEndDate <= form.freeTrialStartDate
          ? 'Free trial end date must be after the start date'
          : '',
  }), [
    form.email, form.phoneNumber, form.businessEin, form.businessName,
    form.addressLine1, form.addressLine2, form.city, form.state, form.zipCode,
    form.contactFirstName, form.contactLastName, form.contactEmail, form.contactPhoneNumber,
    form.packageId, isAdd, effectivePackageStart, form.freeTrialStartDate, form.freeTrialEndDate, today,
  ]);

  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);

  // Bring the success/error banner into view on submit — on mobile the button that triggered
  // it can be well below the fold, especially given how long this form is.
  useEffect(() => {
    if (submitError || savedMessage) {
      messageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [submitError, savedMessage]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSavedMessage(null);
    if (hasFieldErrors) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const address = {
        address_line1: form.addressLine1,
        address_line2: form.addressLine2,
        City: form.city,
        State: form.state,
        ZipCode: form.zipCode,
      };
      const contact = {
        firstName: form.contactFirstName.trim(),
        lastName: form.contactLastName.trim(),
        email: form.contactEmail.trim(),
        phoneNumber: onlyDigits(form.contactPhoneNumber),
      };
      // API receives digits only for phone and EIN.
      const phoneDigits = onlyDigits(form.phoneNumber);
      const einDigits = onlyDigits(form.businessEin);
      // Once this panel has created the landlord, further submits update that same account
      // rather than onboarding a second one.
      const targetAccountId = createdId ?? accountId;
      if (mode === 'add' && !targetAccountId) {
        const body: OnboardLandlordRequest = {
          email: form.email.trim(),
          phoneNumber: phoneDigits,
          businessName: form.businessName,
          businessEin: einDigits,
          businessAddress: address,
          businessContact: contact,
          accountStatus: form.accountStatus,
          packageId: form.packageId,
          addOns: form.selectedAddons,
          packageStartDate: localInputToIso(effectivePackageStart) ?? new Date().toISOString(),
          packageEndDate: localInputToIso(form.packageEndDate),
          freeTrialStartDate: localInputToIso(form.freeTrialStartDate),
          freeTrialEndDate: localInputToIso(form.freeTrialEndDate),
          billingDate: localInputToIso(effectiveBillingDate) ?? new Date().toISOString(),
          billingStatus: form.billingStatus,
        };
        const created = await addLandlord(body);
        setCreatedId(created.account.accountId);
        setSavedMessage('Landlord onboarded successfully.');
      } else if (targetAccountId) {
        // businessName, businessEin and email are locked after onboarding — sent back
        // unchanged so the request stays valid; the server ignores them regardless.
        const body: UpdateLandlordRequest = {
          email: form.email.trim(),
          phoneNumber: phoneDigits,
          businessName: form.businessName,
          businessEin: einDigits,
          businessAddress: address,
          businessContact: contact,
          accountStatus: form.accountStatus,
          addOns: form.selectedAddons,
          packageStartDate: localInputToIso(effectivePackageStart),
          packageEndDate: localInputToIso(form.packageEndDate),
          freeTrialStartDate: localInputToIso(form.freeTrialStartDate),
          freeTrialEndDate: localInputToIso(form.freeTrialEndDate),
          billingDate: localInputToIso(effectiveBillingDate),
          billingStatus: form.billingStatus,
        };
        await updateLandlord(targetAccountId, body);
        setSavedMessage('Landlord saved successfully.');
      }
      onSaved();
    } catch (err) {
      setSubmitError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="slide-overlay">
      <aside className="slide-panel">
        <div className="slide-head">
          <h3>{title}</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading ? (
          <p className="muted" style={{ padding: '1rem' }}>Loading…</p>
        ) : loadError ? (
          <p className="field-error" style={{ padding: '1rem' }} role="alert">{loadError}</p>
        ) : (
          <form className="slide-body" onSubmit={handleSubmit} noValidate>
            {(submitError || savedMessage) && (
              <div ref={messageRef}>
                {submitError && <div className="error" role="alert">{submitError}</div>}
                {savedMessage && <div className="notice" role="status">{savedMessage}</div>}
              </div>
            )}

            <fieldset disabled={readOnly}>
              <legend>Account</legend>

              <label>Email
                <input type="email" value={form.email} maxLength={50}
                  readOnly={fieldsLocked} disabled={fieldsLocked}
                  aria-invalid={showErrors && !!fieldErrors.email}
                  onChange={(e) => set('email', e.target.value)} />
                {fieldsLocked && (
                  <span className="field-hint">Email cannot be changed after onboarding.</span>
                )}
                {showErrors && fieldErrors.email && (
                  <span className="field-error">{fieldErrors.email}</span>
                )}
              </label>
              <label>Phone Number
                <input value={form.phoneNumber} inputMode="tel"
                  placeholder="(214) 555-9090"
                  aria-invalid={showErrors && !!fieldErrors.phoneNumber}
                  onChange={(e) => set('phoneNumber', formatPhone(e.target.value))} />
                {showErrors && fieldErrors.phoneNumber && (
                  <span className="field-error">{fieldErrors.phoneNumber}</span>
                )}
              </label>
              <label>Business Name
                <input value={form.businessName} maxLength={100}
                  readOnly={fieldsLocked} disabled={fieldsLocked}
                  aria-invalid={showErrors && !!fieldErrors.businessName}
                  onChange={(e) => set('businessName', e.target.value)} />
                {fieldsLocked && (
                  <span className="field-hint">Business name cannot be changed after onboarding.</span>
                )}
                {showErrors && fieldErrors.businessName && (
                  <span className="field-error">{fieldErrors.businessName}</span>
                )}
              </label>
              <label>Business EIN
                <input value={form.businessEin} inputMode="numeric"
                  placeholder="12-3456789"
                  readOnly={fieldsLocked} disabled={fieldsLocked}
                  aria-invalid={showErrors && !!fieldErrors.businessEin}
                  onChange={(e) => set('businessEin', formatEin(e.target.value))} />
                {fieldsLocked && (
                  <span className="field-hint">Business EIN cannot be changed after onboarding.</span>
                )}
                {showErrors && fieldErrors.businessEin && (
                  <span className="field-error">{fieldErrors.businessEin}</span>
                )}
              </label>
              <label>Address Line 1
                <input ref={addressInputRef} value={form.addressLine1} maxLength={100}
                  placeholder="Start typing an address…" autoComplete="off"
                  aria-invalid={showErrors && !!fieldErrors.addressLine1}
                  onChange={(e) => set('addressLine1', e.target.value)} />
                {showErrors && fieldErrors.addressLine1 && (
                  <span className="field-error">{fieldErrors.addressLine1}</span>
                )}
              </label>
              <label>Address Line 2
                <input value={form.addressLine2} maxLength={100}
                  aria-invalid={showErrors && !!fieldErrors.addressLine2}
                  onChange={(e) => set('addressLine2', e.target.value)} />
                {showErrors && fieldErrors.addressLine2 && (
                  <span className="field-error">{fieldErrors.addressLine2}</span>
                )}
              </label>
              <div className="row-3">
                <label>City
                  <input value={form.city} maxLength={50}
                    aria-invalid={showErrors && !!fieldErrors.city}
                    onChange={(e) => set('city', e.target.value)} />
                  {showErrors && fieldErrors.city && (
                    <span className="field-error">{fieldErrors.city}</span>
                  )}
                </label>
                <label>State
                  <select value={form.state}
                    aria-invalid={showErrors && !!fieldErrors.state}
                    onChange={(e) => set('state', e.target.value)}>
                    <option value="">Select…</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {showErrors && fieldErrors.state && (
                    <span className="field-error">{fieldErrors.state}</span>
                  )}
                </label>
                <label>Zip
                  <input value={form.zipCode} maxLength={10}
                    placeholder="12345"
                    aria-invalid={showErrors && !!fieldErrors.zipCode}
                    onChange={(e) => set('zipCode', e.target.value)} />
                  {showErrors && fieldErrors.zipCode && (
                    <span className="field-error">{fieldErrors.zipCode}</span>
                  )}
                </label>
              </div>
              <label className="checkbox">
                <input type="checkbox" checked={form.accountStatus}
                  onChange={(e) => set('accountStatus', e.target.checked)} />
                Account Active
              </label>
            </fieldset>

            <fieldset disabled={readOnly}>
              <legend>Business Contact</legend>

              <div className="row-2">
                <label>First Name
                  <input value={form.contactFirstName} maxLength={50}
                    aria-invalid={showErrors && !!fieldErrors.contactFirstName}
                    onChange={(e) => set('contactFirstName', e.target.value)} />
                  {showErrors && fieldErrors.contactFirstName && (
                    <span className="field-error">{fieldErrors.contactFirstName}</span>
                  )}
                </label>
                <label>Last Name
                  <input value={form.contactLastName} maxLength={50}
                    aria-invalid={showErrors && !!fieldErrors.contactLastName}
                    onChange={(e) => set('contactLastName', e.target.value)} />
                  {showErrors && fieldErrors.contactLastName && (
                    <span className="field-error">{fieldErrors.contactLastName}</span>
                  )}
                </label>
              </div>
              <label>Email
                <input type="email" value={form.contactEmail} maxLength={50}
                  aria-invalid={showErrors && !!fieldErrors.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)} />
                {showErrors && fieldErrors.contactEmail && (
                  <span className="field-error">{fieldErrors.contactEmail}</span>
                )}
              </label>
              <label>Phone Number
                <input value={form.contactPhoneNumber} inputMode="tel"
                  placeholder="(214) 555-9090"
                  aria-invalid={showErrors && !!fieldErrors.contactPhoneNumber}
                  onChange={(e) => set('contactPhoneNumber', formatPhone(e.target.value))} />
                {showErrors && fieldErrors.contactPhoneNumber && (
                  <span className="field-error">{fieldErrors.contactPhoneNumber}</span>
                )}
              </label>
            </fieldset>

            <fieldset disabled={readOnly}>
              <legend>Package</legend>

              {mode === 'add' ? (
                <label>Package
                  <select value={form.packageId}
                    aria-invalid={showErrors && !!fieldErrors.packageId}
                    onChange={(e) => onPackageChange(e.target.value)}>
                    <option value="" disabled>Select a package…</option>
                    {packages.map((p) => (
                      <option key={p.packageId} value={p.packageId}>{p.packageName}</option>
                    ))}
                  </select>
                  {showErrors && fieldErrors.packageId && (
                    <span className="field-error">{fieldErrors.packageId}</span>
                  )}
                </label>
              ) : (
                <label>Package
                  <input value={form.packageName} readOnly disabled />
                </label>
              )}

              {/* Add-ons. In add mode, the selected package's active add-ons are selectable;
                  the count is display-only (taken from the add-on). In view/edit mode, show
                  the saved selection. */}
              {mode === 'add' ? (
                <div className="addons-block">
                  <span className="addons-legend">Add-ons</span>
                  {!form.packageId ? (
                    <p className="muted">Select a package to see its add-ons.</p>
                  ) : !selectedPackage || selectedPackage.addOns.length === 0 ? (
                    <p className="muted">No add-ons available for this package.</p>
                  ) : (
                    selectedPackage.addOns.map((opt) => {
                      const sel = form.selectedAddons.find((a) => a.adons_id === opt.adonsId);
                      return (
                        <div key={opt.adonsId} className="addon-row">
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={isAddonSelected(opt.adonsId)}
                              onChange={(e) => toggleAddon(opt, e.target.checked)}
                            />
                            {opt.adonsName}
                            {opt.adonsPrice != null && (
                              <span className="muted"> — ${opt.adonsPrice.toFixed(2)}</span>
                            )}
                          </label>
                          {sel && (
                            <span className="addon-count muted">Count: {sel.adons_count}</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="addons-block">
                  <span className="addons-legend">Add-ons</span>
                  {form.selectedAddons.length === 0 ? (
                    <p className="muted">No add-ons selected.</p>
                  ) : (
                    <ul className="addon-list">
                      {form.selectedAddons.map((a) => (
                        <li key={a.adons_id}>
                          {a.adons_name} × {a.adons_count} (${a.adons_price.toFixed(2)})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="row-2">
                <label>Package Start
                  <input type="date" value={effectivePackageStart}
                    min={isAdd ? today : undefined}
                    readOnly={packageStartLocked} disabled={packageStartLocked}
                    aria-invalid={showErrors && !!fieldErrors.packageStartDate}
                    onChange={(e) => set('packageStartDate', e.target.value)} />
                  {packageStartLocked && (
                    <span className="field-hint">Auto-set to the day after the free trial end date.</span>
                  )}
                  {showErrors && fieldErrors.packageStartDate && (
                    <span className="field-error">{fieldErrors.packageStartDate}</span>
                  )}
                </label>
                <label>Package End
                  <input type="date" value={form.packageEndDate}
                    onChange={(e) => set('packageEndDate', e.target.value)} />
                </label>
              </div>
              <div className="row-2">
                <label>Free Trial Start
                  <input type="date" value={form.freeTrialStartDate}
                    min={isAdd ? today : undefined}
                    aria-invalid={showErrors && !!fieldErrors.freeTrialStartDate}
                    onChange={(e) => set('freeTrialStartDate', e.target.value)} />
                  {showErrors && fieldErrors.freeTrialStartDate && (
                    <span className="field-error">{fieldErrors.freeTrialStartDate}</span>
                  )}
                </label>
                <label>Free Trial End
                  <input type="date" value={form.freeTrialEndDate}
                    min={isAdd ? today : undefined}
                    aria-invalid={showErrors && !!fieldErrors.freeTrialEndDate}
                    onChange={(e) => set('freeTrialEndDate', e.target.value)} />
                  {showErrors && fieldErrors.freeTrialEndDate && (
                    <span className="field-error">{fieldErrors.freeTrialEndDate}</span>
                  )}
                </label>
              </div>
              <label>Billing Date
                <input type="date" value={effectiveBillingDate} readOnly disabled />
                <span className="field-hint">Always the day after the package start date.</span>
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={form.billingStatus}
                  onChange={(e) => set('billingStatus', e.target.checked)} />
                Billing Active
              </label>
            </fieldset>

            {!readOnly && (
              <div className="slide-actions">
                <button type="button" className="ghost" onClick={onClose}>Cancel</button>
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : mode === 'add' && !isNewlySaved ? 'Onboard Landlord' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        )}
      </aside>
    </div>
  );
}
