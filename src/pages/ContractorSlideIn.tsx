import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getContractor, listContractorServiceOptions, updateContractor } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { ContractorDetailView, ContractorServiceOption, ContractorUpdateRequest, ContractorView } from '../api/types';

interface Props {
  contractor: ContractorView;
  onClose: () => void;
  onSaved: () => void;
}

// The panel edits everything the admin service's ContractorUpdateRequest accepts: Business
// Details (company, EIN, phone, extension, website — locked from contractor self-edit, so this is
// the only place a wrong value gets corrected), Contacts, Business Services, Service Area,
// License, Insurance and the Active flag. The email is the contractor's login and stays read-only.
//
// The selectable services come from the server (GET /contractors/services), which serves
// rental-service's contractor_service catalogue — and since V10 that catalogue IS the maintenance
// category list, because a request is matched to a contractor by exact category==service name.
//
// Active is the approval: a newly registered business waits inactive and cannot sign in until an
// administrator ticks it here, which also emails the contractor that they are approved.

const EIN_RE = /^\d{2}-?\d{7}$/;
const US_STATE_RE = /^[A-Za-z]{2}$/;

function splitList(text: string): string[] {
  return text.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function ContractorSlideIn({ contractor, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContractorDetailView | null>(null);
  const [serviceOptions, setServiceOptions] = useState<ContractorServiceOption[]>([]);

  const [companyName, setCompanyName] = useState('');
  const [businessEin, setBusinessEin] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessPhoneExtension, setBusinessPhoneExtension] = useState('');
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactMiddleName, setContactMiddleName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [cities, setCities] = useState('');
  const [zipcodes, setZipcodes] = useState('');
  const [radiusMiles, setRadiusMiles] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseIssueState, setLicenseIssueState] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getContractor(contractor.contractorId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setCompanyName(d.companyName ?? '');
        setBusinessEin(d.businessEin ?? '');
        setPhoneNumber(d.phoneNumber ?? '');
        setBusinessPhoneExtension(d.businessPhoneExtension ?? '');
        setBusinessWebsite(d.businessWebsite ?? '');
        setContactFirstName(d.contactFirstName ?? '');
        setContactMiddleName(d.contactMiddleName ?? '');
        setContactLastName(d.contactLastName ?? '');
        setServiceIds((d.services ?? []).map((s) => s.id));
        setCities(d.serviceArea?.cities?.join(', ') ?? '');
        setZipcodes(d.serviceArea?.zipcodes?.join(', ') ?? '');
        setRadiusMiles(d.serviceArea?.radiusMiles != null ? String(d.serviceArea.radiusMiles) : '');
        setLicenseNumber(d.licenseNumber ?? '');
        setLicenseIssueState(d.licenseIssueState ?? '');
        setLicenseExpiryDate(d.licenseExpiryDate ?? '');
        setInsuranceProvider(d.insuranceProvider ?? '');
        setInsurancePolicyNumber(d.insurancePolicyNumber ?? '');
        setInsuranceExpiryDate(d.insuranceExpiryDate ?? '');
        setIsActive(d.isActive ?? false);
      })
      .catch((err) => setLoadError(toUserMessage(err, 'Failed to load contractor')))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contractor.contractorId]);

  // The catalogue is account-independent, so it is fetched once alongside the contractor. A
  // failure leaves the list empty rather than blocking the rest of the panel; whatever the
  // contractor already has stays selected and saveable.
  useEffect(() => {
    let cancelled = false;
    listContractorServiceOptions()
      .then((options) => { if (!cancelled) setServiceOptions(options); })
      .catch(() => { if (!cancelled) setServiceOptions([]); });
    return () => { cancelled = true; };
  }, []);

  // What the checklist offers: the server catalogue, plus any service this contractor already
  // carries that is no longer in it (since deactivated), so editing another field never silently
  // drops a selection the admin can still see and untick.
  const selectableServices = useMemo<ContractorServiceOption[]>(() => {
    const known = new Set(serviceOptions.map((o) => o.id));
    const extras = (detail?.services ?? []).filter((s) => !known.has(s.id));
    return [...serviceOptions, ...extras];
  }, [serviceOptions, detail]);

  function toggleService(id: string) {
    setServiceIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
    setSavedMessage(null);
  }

  const fieldErrors = useMemo(() => ({
    companyName: companyName.trim() ? '' : 'Company name is required',
    businessEin: !businessEin.trim() || EIN_RE.test(businessEin.trim()) ? '' : 'EIN must be in the format XX-XXXXXXX',
    phoneNumber: !phoneNumber.trim() ? 'Phone number is required'
      : phoneNumber.trim().length > 15 ? 'Phone number must be at most 15 characters' : '',
    businessPhoneExtension: /^\d*$/.test(businessPhoneExtension.trim()) ? '' : 'Extension must be numeric',
    serviceIds: serviceIds.length === 0 ? 'Select at least one service' : '',
    licenseIssueState: !licenseIssueState.trim() || US_STATE_RE.test(licenseIssueState.trim()) ? '' : 'Use the 2-letter state code',
  }), [companyName, businessEin, phoneNumber, businessPhoneExtension, serviceIds, licenseIssueState]);

  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);

  const edit = (setter: (v: string) => void) => (e: { target: { value: string } }) => {
    setter(e.target.value);
    setSavedMessage(null);
  };

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
      const activating = detail?.isActive !== true && isActive;
      const body: ContractorUpdateRequest = {
        companyName: companyName.trim(),
        businessEin: businessEin.trim() || null,
        phoneNumber: phoneNumber.trim(),
        businessPhoneExtension: businessPhoneExtension.trim() || null,
        businessWebsite: businessWebsite.trim() || null,
        contactFirstName: contactFirstName.trim() || null,
        contactMiddleName: contactMiddleName.trim() || null,
        contactLastName: contactLastName.trim() || null,
        serviceIds,
        serviceArea: {
          cities: splitList(cities),
          zipcodes: splitList(zipcodes),
          radiusMiles: radiusMiles ? Number(radiusMiles) : null,
        },
        licenseNumber: licenseNumber.trim() || null,
        licenseIssueState: licenseIssueState.trim().toUpperCase() || null,
        licenseExpiryDate: licenseExpiryDate || null,
        insuranceProvider: insuranceProvider.trim() || null,
        insurancePolicyNumber: insurancePolicyNumber.trim() || null,
        insuranceExpiryDate: insuranceExpiryDate || null,
        isActive,
      };
      const saved = await updateContractor(contractor.contractorId, body);
      setDetail(saved);
      setSavedMessage(activating
        ? 'Contractor approved and activated. They have been emailed and can now sign in.'
        : 'Contractor saved successfully.');
      onSaved();
    } catch (err) {
      setSubmitError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const displayName = detail
    ? (detail.companyName || [detail.contactFirstName, detail.contactLastName].filter(Boolean).join(' ') || 'Contractor')
    : (contractor.companyName || 'Contractor');

  const error = (key: keyof typeof fieldErrors) =>
    showErrors && fieldErrors[key] ? <span className="field-error">{fieldErrors[key]}</span> : null;

  return (
    <div className="slide-overlay">
      <aside className="slide-panel">
        <div className="slide-head">
          <h3>Edit Contractor — {displayName}</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading ? (
          <div className="slide-body"><p className="muted">Loading…</p></div>
        ) : loadError ? (
          <div className="slide-body"><div className="error" role="alert">{loadError}</div></div>
        ) : (
          <form className="slide-body" onSubmit={handleSubmit} noValidate>
            {submitError && <div className="error" role="alert">{submitError}</div>}
            {savedMessage && <div className="notice" role="status">{savedMessage}</div>}

            <fieldset>
              <legend>Status</legend>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => { setIsActive(e.target.checked); setSavedMessage(null); }}
                  data-testid="contractor-active"
                />
                Active — approved, can sign in and accept job invitations
              </label>
              {detail?.activatedAt && (
                <p className="muted" data-testid="contractor-activated-at">
                  Approved on {new Date(detail.activatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.
                </p>
              )}
              {!isActive && (
                <p className="muted">
                  While inactive, this contractor cannot sign in to the contractor portal and will not be
                  matched or invited to any maintenance jobs. Ticking Active approves the application and
                  emails the contractor.
                </p>
              )}
            </fieldset>

            <fieldset>
              <legend>Business Details</legend>
              <label>Company Name *
                <input value={companyName} onChange={edit(setCompanyName)} maxLength={100} />
                {error('companyName')}
              </label>
              <div className="row-3">
              <label>Business EIN
                <input value={businessEin} onChange={edit(setBusinessEin)} placeholder="XX-XXXXXXX" maxLength={10} />
                {error('businessEin')}
              </label>
              <label>Business Phone *
                <input value={phoneNumber} onChange={edit(setPhoneNumber)} maxLength={15} />
                {error('phoneNumber')}
              </label>
              <label>Phone Extension
                <input value={businessPhoneExtension} onChange={edit(setBusinessPhoneExtension)} maxLength={10} />
                {error('businessPhoneExtension')}
              </label>
              </div>
              <label>Website
                <input value={businessWebsite} onChange={edit(setBusinessWebsite)} maxLength={255} />
              </label>
            </fieldset>

            <fieldset>
              <legend>Business Contact</legend>
              <div className="row-3">
              <label>First Name
                <input value={contactFirstName} onChange={edit(setContactFirstName)} maxLength={50} />
              </label>
              <label>Middle Name
                <input value={contactMiddleName} onChange={edit(setContactMiddleName)} maxLength={50} />
              </label>
              <label>Last Name
                <input value={contactLastName} onChange={edit(setContactLastName)} maxLength={50} />
              </label>
              </div>
              <label>Email (login — read-only)
                <input value={detail?.email ?? ''} disabled />
              </label>
            </fieldset>

            <fieldset>
              <legend>Business Services *</legend>
              {selectableServices.length === 0 && <p className="muted">No services available.</p>}
              {selectableServices.map((s) => (
                <label key={s.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                  />
                  {s.name}
                </label>
              ))}
              {error('serviceIds')}
            </fieldset>

            <fieldset>
              <legend>Service Area</legend>
              <div className="row-3">
              <label>Cities (comma-separated)
                <input value={cities} onChange={edit(setCities)} />
              </label>
              <label>ZIP codes (comma-separated)
                <input value={zipcodes} onChange={edit(setZipcodes)} />
              </label>
              <label>Service Radius (miles)
                <input type="number" min="0" value={radiusMiles} onChange={edit(setRadiusMiles)} />
              </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>License</legend>
              <div className="row-3">
              <label>License Number
                <input value={licenseNumber} onChange={edit(setLicenseNumber)} maxLength={100} />
              </label>
              <label>Issuing State
                <input value={licenseIssueState} onChange={edit(setLicenseIssueState)} placeholder="TX" maxLength={2} />
                {error('licenseIssueState')}
              </label>
              <label>Expiry Date
                <input type="date" value={licenseExpiryDate} onChange={edit(setLicenseExpiryDate)} />
              </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Insurance</legend>
              <div className="row-3">
              <label>Insurance Provider
                <input value={insuranceProvider} onChange={edit(setInsuranceProvider)} maxLength={255} />
              </label>
              <label>Policy Number
                <input value={insurancePolicyNumber} onChange={edit(setInsurancePolicyNumber)} maxLength={100} />
              </label>
              <label>Expiry Date
                <input type="date" value={insuranceExpiryDate} onChange={edit(setInsuranceExpiryDate)} />
              </label>
              </div>
            </fieldset>

            <div className="slide-actions">
              <button type="button" className="ghost" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={saving} data-testid="contractor-save">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
