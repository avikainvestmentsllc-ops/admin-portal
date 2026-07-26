import { useMemo, useState, type FormEvent } from 'react';
import { addMileageRate, updateMileageRate } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { MileageRateRequest, MileageRateView } from '../api/types';

export type MileageRateSlideMode = 'add' | 'edit';

interface Props {
  mode: MileageRateSlideMode;
  rate: MileageRateView | null;
  onClose: () => void;
  onSaved: () => void;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
// Up to three decimal places, e.g. "0.67", "0.655" (IRS rates are published to the mil).
const RATE_RE = /^\d+(\.\d{1,3})?$/;

export default function MileageRateSlideIn({ mode, rate, onClose, onSaved }: Props) {
  const [taxYear, setTaxYear] = useState(rate?.taxYear != null ? String(rate.taxYear) : '');
  const [ratePerMile, setRatePerMile] = useState(rate?.ratePerMile != null ? String(rate.ratePerMile) : '');

  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // Id of the row created by this panel's own add, once saved — further submits update it.
  const [createdId, setCreatedId] = useState<string | null>(null);

  const isAdd = mode === 'add' && !createdId;
  const title = isAdd ? 'Add Mileage Rate' : 'Edit Mileage Rate';

  const fieldErrors = useMemo(() => ({
    taxYear: !taxYear.trim()
      ? 'Year is required'
      : !/^\d{4}$/.test(taxYear.trim())
        ? 'Enter a 4-digit year'
        : Number(taxYear) < MIN_YEAR || Number(taxYear) > MAX_YEAR
          ? `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`
          : '',
    ratePerMile: ratePerMile === '' || Number.isNaN(Number(ratePerMile)) || Number(ratePerMile) <= 0
      ? 'Enter a valid rate greater than 0'
      : !RATE_RE.test(ratePerMile.trim())
        ? 'Rate may have at most 3 decimal places'
        : '',
  }), [taxYear, ratePerMile]);

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
      const body: MileageRateRequest = {
        taxYear: Number(taxYear),
        ratePerMile: Number(ratePerMile),
      };
      if (isAdd) {
        const created = await addMileageRate(body);
        setCreatedId(created.mileageRateId);
        setSavedMessage('Mileage rate added successfully.');
      } else {
        const id = createdId ?? rate?.mileageRateId;
        if (id) {
          await updateMileageRate(id, body);
          setSavedMessage('Mileage rate saved successfully.');
        }
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

        <form className="slide-body" onSubmit={handleSubmit} noValidate>
          {submitError && <div className="error" role="alert">{submitError}</div>}
          {savedMessage && <div className="notice" role="status">{savedMessage}</div>}

          <fieldset>
            <legend>Mileage Rate</legend>

            <label>Year
              <input value={taxYear} maxLength={4} inputMode="numeric"
                aria-invalid={showErrors && !!fieldErrors.taxYear}
                onChange={(e) => { setTaxYear(e.target.value.replace(/\D/g, '')); setSavedMessage(null); setSubmitError(null); }} />
              {showErrors && fieldErrors.taxYear && (
                <span className="field-error">{fieldErrors.taxYear}</span>
              )}
            </label>

            <label>Amount per Mile
              <input type="number" min="0" step="0.001" value={ratePerMile}
                placeholder="0.000"
                aria-invalid={showErrors && !!fieldErrors.ratePerMile}
                onChange={(e) => { setRatePerMile(e.target.value); setSavedMessage(null); setSubmitError(null); }} />
              {showErrors && fieldErrors.ratePerMile && (
                <span className="field-error">{fieldErrors.ratePerMile}</span>
              )}
            </label>
          </fieldset>

          <div className="slide-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isAdd ? 'Add Rate' : 'Save Changes'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
