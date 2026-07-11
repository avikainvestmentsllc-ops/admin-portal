import { useMemo, useState, type FormEvent } from 'react';
import { addAddon, updateAddon, ApiRequestError } from '../api/client';
import type { AddonRequest, AddonView, PackageView } from '../api/types';

export type AddonSlideMode = 'add' | 'edit';

interface Props {
  mode: AddonSlideMode;
  addon: AddonView | null;
  packages: PackageView[];
  onClose: () => void;
  onSaved: () => void;
}

/** UTC ISO -> value for <input type="date"> (calendar date only). */
function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** <input type="date"> value -> UTC ISO at local midnight, or null. */
function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const [y, m, day] = value.split('-').map(Number);
  if (!y || !m || !day) return null;
  const d = new Date(y, m - 1, day, 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AddonSlideIn({ mode, addon, packages, onClose, onSaved }: Props) {
  const [adonsPackageId, setAdonsPackageId] = useState(addon?.adonsPackageId ?? '');
  const [adonsName, setAdonsName] = useState(addon?.adonsName ?? '');
  const [adonsCount, setAdonsCount] = useState(
    addon?.adonsCount != null ? String(addon.adonsCount) : '',
  );
  const [adonsPrice, setAdonsPrice] = useState(
    addon?.adonsPrice != null ? String(addon.adonsPrice) : '',
  );
  const [adonsStatus, setAdonsStatus] = useState(addon?.adonsStatus ?? true);
  const [startDate, setStartDate] = useState(isoToDateInput(addon?.adonsStartTimeUtc));
  const [endDate, setEndDate] = useState(isoToDateInput(addon?.adonsEndTimeUtc));

  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const title = mode === 'add' ? 'Add Add-on' : 'Edit Add-on';

  // Per-field validation messages (empty string = valid). All fields are mandatory.
  const fieldErrors = useMemo(() => {
    const priceNum = Number(adonsPrice);
    const countNum = Number(adonsCount);
    return {
      adonsPackageId: !adonsPackageId ? 'Please select a package' : '',
      adonsName: !adonsName.trim() ? 'Name is required' : '',
      adonsCount:
        adonsCount === '' || Number.isNaN(countNum) || countNum < 0 || !Number.isInteger(countNum)
          ? 'Enter a whole number (0 or greater)'
          : '',
      adonsPrice:
        adonsPrice === '' || Number.isNaN(priceNum) || priceNum < 0
          ? 'Enter a valid price (0 or greater)'
          : '',
      startDate: !startDate ? 'Start date is required' : '',
      endDate: !endDate
        ? 'End date is required'
        : startDate && endDate && startDate >= endDate
          ? 'End date must be after the start date'
          : '',
    };
  }, [adonsPackageId, adonsName, adonsCount, adonsPrice, startDate, endDate]);

  const hasErrors = Object.values(fieldErrors).some(Boolean);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const body: AddonRequest = {
        adonsPackageId,
        adonsName: adonsName.trim(),
        adonsCount: Number(adonsCount),
        adonsPrice: Number(adonsPrice),
        adonsStatus,
        adonsStartTimeUtc: dateInputToIso(startDate) ?? '',
        adonsEndTimeUtc: dateInputToIso(endDate) ?? '',
      };
      if (mode === 'add') {
        await addAddon(body);
      } else if (addon) {
        await updateAddon(addon.adonsId, body);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? `${err.message} (${err.errorCode})` : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="slide-overlay" onClick={onClose}>
      <aside className="slide-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slide-head">
          <h3>{title}</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="slide-body" onSubmit={handleSubmit} noValidate>
          {error && <div className="error" role="alert">{error}</div>}

          <fieldset>
            <legend>Add-on</legend>

            <label>Package
              <select value={adonsPackageId}
                aria-invalid={showErrors && !!fieldErrors.adonsPackageId}
                onChange={(e) => setAdonsPackageId(e.target.value)}>
                <option value="" disabled>Select a package…</option>
                {packages.map((p) => (
                  <option key={p.packageId} value={p.packageId}>{p.packageName}</option>
                ))}
              </select>
              {showErrors && fieldErrors.adonsPackageId && (
                <span className="field-error">{fieldErrors.adonsPackageId}</span>
              )}
            </label>

            <label>Name
              <input value={adonsName} maxLength={20}
                aria-invalid={showErrors && !!fieldErrors.adonsName}
                onChange={(e) => setAdonsName(e.target.value)} />
              {showErrors && fieldErrors.adonsName && (
                <span className="field-error">{fieldErrors.adonsName}</span>
              )}
            </label>

            <div className="row-2">
              <label>Count
                <input type="number" min="0" step="1" value={adonsCount}
                  aria-invalid={showErrors && !!fieldErrors.adonsCount}
                  onChange={(e) => setAdonsCount(e.target.value)} />
                {showErrors && fieldErrors.adonsCount && (
                  <span className="field-error">{fieldErrors.adonsCount}</span>
                )}
              </label>
              <label>Price
                <input type="number" min="0" step="0.01" value={adonsPrice}
                  placeholder="0.00"
                  aria-invalid={showErrors && !!fieldErrors.adonsPrice}
                  onChange={(e) => setAdonsPrice(e.target.value)} />
                {showErrors && fieldErrors.adonsPrice && (
                  <span className="field-error">{fieldErrors.adonsPrice}</span>
                )}
              </label>
            </div>

            <div className="row-2">
              <label>Start
                <input type="date" value={startDate}
                  aria-invalid={showErrors && !!fieldErrors.startDate}
                  onChange={(e) => setStartDate(e.target.value)} />
                {showErrors && fieldErrors.startDate && (
                  <span className="field-error">{fieldErrors.startDate}</span>
                )}
              </label>
              <label>End
                <input type="date" value={endDate}
                  aria-invalid={showErrors && !!fieldErrors.endDate}
                  onChange={(e) => setEndDate(e.target.value)} />
                {showErrors && fieldErrors.endDate && (
                  <span className="field-error">{fieldErrors.endDate}</span>
                )}
              </label>
            </div>

            <label className="checkbox">
              <input type="checkbox" checked={adonsStatus}
                onChange={(e) => setAdonsStatus(e.target.checked)} />
              Active
            </label>
          </fieldset>

          <div className="slide-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : mode === 'add' ? 'Add Add-on' : 'Save Changes'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
