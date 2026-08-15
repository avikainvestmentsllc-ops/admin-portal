import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getContractor, updateContractor } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { ContractorDetailView, ContractorUpdateRequest, ContractorView } from '../api/types';

interface Props {
  contractor: ContractorView;
  onClose: () => void;
  onSaved: () => void;
}

// Matches contractor-ui's own self-edit form (contractor-ui/src/pages/Profile.jsx) exactly, so
// an admin edits the same vocabulary a contractor would see/set themselves.
const SPECIALTIES = [
  'HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Painting',
  'Cleaning', 'Appliance Repair', 'Handyman', 'Other',
];

export default function ContractorSlideIn({ contractor, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContractorDetailView | null>(null);

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

  function toggleSpecialty(name: string) {
    setSpecialties((prev) => prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]);
    setSavedMessage(null);
  }

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
              {SPECIALTIES.map((name) => (
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
