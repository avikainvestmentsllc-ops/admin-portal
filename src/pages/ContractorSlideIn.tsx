import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getContractor, listContractorServiceOptions, updateContractor } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { ContractorDetailView, ContractorServiceOption, ContractorUpdateRequest, ContractorView } from '../api/types';

interface Props {
  contractor: ContractorView;
  onClose: () => void;
  onSaved: () => void;
}

// The selectable services come from the server (GET /contractors/services), which serves
// rental-service's contractor_service catalogue — and since V10 that catalogue IS the maintenance
// category list, because a request is matched to a contractor by exact category==service name.
// Hardcoding the nine old trade names here meant an admin could set "Plumbing" on a firm that
// would then never match a "Plumbing Repairs" request.

export default function ContractorSlideIn({ contractor, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContractorDetailView | null>(null);
  const [serviceOptions, setServiceOptions] = useState<ContractorServiceOption[]>([]);

  const [specialties, setSpecialties] = useState<string[]>([]);
  const [cities, setCities] = useState('');
  const [radiusMiles, setRadiusMiles] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
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
        setSpecialties(d.specialties ?? []);
        setCities(d.serviceArea?.cities?.join(', ') ?? '');
        setRadiusMiles(d.serviceArea?.radiusMiles != null ? String(d.serviceArea.radiusMiles) : '');
        setLicenseNumber(d.licenseNumber ?? '');
        setInsuranceProvider(d.insuranceProvider ?? '');
        setInsurancePolicyNumber(d.insurancePolicyNumber ?? '');
        setIsActive(d.isActive ?? true);
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

  function toggleSpecialty(name: string) {
    setSpecialties((prev) => prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]);
    setSavedMessage(null);
  }

  // What the checkbox list offers: the server catalogue, plus any name this contractor already
  // carries that is no longer in it (a pre-V10 trade name, or a service since deactivated), so
  // editing another field never silently drops a selection the admin can still see and untick.
  const selectableServices = useMemo(() => {
    const names = serviceOptions.map((o) => o.name);
    const extras = specialties.filter((s) => !names.includes(s));
    return [...names, ...extras];
  }, [serviceOptions, specialties]);

  const fieldErrors = useMemo(() => ({
    specialties: specialties.length === 0 ? 'Select at least one specialty' : '',
  }), [specialties]);

  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);

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
      const body: ContractorUpdateRequest = {
        specialties,
        serviceArea: {
          cities: cities ? cities.split(',').map((c) => c.trim()).filter(Boolean) : [],
          radiusMiles: radiusMiles ? Number(radiusMiles) : null,
        },
        licenseNumber: licenseNumber.trim() || null,
        insuranceProvider: insuranceProvider.trim() || null,
        insurancePolicyNumber: insurancePolicyNumber.trim() || null,
        isActive,
      };
      const saved = await updateContractor(contractor.contractorId, body);
      setDetail(saved);
      setSavedMessage('Contractor saved successfully.');
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
              <legend>Contact (read-only)</legend>
              <label>Company Name
                <input value={detail?.companyName ?? ''} disabled />
              </label>
              <label>Contact Name
                <input value={[detail?.contactFirstName, detail?.contactLastName].filter(Boolean).join(' ') || '—'} disabled />
              </label>
              <label>Phone
                <input value={detail?.phoneNumber ?? ''} disabled />
              </label>
              <label>Email
                <input value={detail?.email ?? ''} disabled />
              </label>
            </fieldset>

            <fieldset>
              <legend>Specialties</legend>
              {selectableServices.map((name) => (
                <label key={name} className="checkbox">
                  <input
                    type="checkbox"
                    checked={specialties.includes(name)}
                    onChange={() => toggleSpecialty(name)}
                  />
                  {name}
                </label>
              ))}
              {showErrors && fieldErrors.specialties && (
                <span className="field-error">{fieldErrors.specialties}</span>
              )}
            </fieldset>

            <fieldset>
              <legend>Service Area</legend>
              <label>Cities (comma-separated)
                <input value={cities} onChange={(e) => { setCities(e.target.value); setSavedMessage(null); }} />
              </label>
              <label>Service Radius (miles)
                <input type="number" min="0" value={radiusMiles}
                  onChange={(e) => { setRadiusMiles(e.target.value); setSavedMessage(null); }} />
              </label>
            </fieldset>

            <fieldset>
              <legend>License &amp; Insurance</legend>
              <label>License Number
                <input value={licenseNumber} onChange={(e) => { setLicenseNumber(e.target.value); setSavedMessage(null); }} />
              </label>
              <label>Insurance Provider
                <input value={insuranceProvider} onChange={(e) => { setInsuranceProvider(e.target.value); setSavedMessage(null); }} />
              </label>
              <label>Insurance Policy Number
                <input value={insurancePolicyNumber} onChange={(e) => { setInsurancePolicyNumber(e.target.value); setSavedMessage(null); }} />
              </label>
            </fieldset>

            <fieldset>
              <legend>Status</legend>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => { setIsActive(e.target.checked); setSavedMessage(null); }}
                />
                Active — accepting new job invitations
              </label>
              {!isActive && (
                <p className="muted">
                  While inactive, this contractor will not be matched or invited to any new maintenance jobs.
                </p>
              )}
            </fieldset>

            <div className="slide-actions">
              <button type="button" className="ghost" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
