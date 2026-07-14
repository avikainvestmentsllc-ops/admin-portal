import { useState, type FormEvent } from 'react';
import { addPackage, updatePackage, ApiRequestError } from '../api/client';
import type { PackageRequest, PackageView } from '../api/types';
import InfoTip from '../components/InfoTip';

export type PackageSlideMode = 'add' | 'edit';

interface Props {
  mode: PackageSlideMode;
  pkg: PackageView | null;
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

/** <input type="date"> value (YYYY-MM-DD) -> UTC ISO at local midnight, or null. */
function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const [y, m, day] = value.split('-').map(Number);
  if (!y || !m || !day) return null;
  const d = new Date(y, m - 1, day, 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function PackageSlideIn({ mode, pkg, onClose, onSaved }: Props) {
  const [packageName, setPackageName] = useState(pkg?.packageName ?? '');
  const [packagePrice, setPackagePrice] = useState(
    pkg?.packagePrice != null ? String(pkg.packagePrice) : '',
  );
  const [packageStatus, setPackageStatus] = useState(pkg?.packageStatus ?? true);
  const [effectiveStart, setEffectiveStart] = useState(isoToDateInput(pkg?.effectiveStartDateUtc));
  const [effectiveEnd, setEffectiveEnd] = useState(isoToDateInput(pkg?.effectiveEndDateUtc));

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const title = mode === 'add' ? 'Add Package' : 'Edit Package';

  function validate(): string | null {
    if (!packageName.trim()) return 'Package name is required.';
    const price = Number(packagePrice);
    if (packagePrice === '' || Number.isNaN(price) || price < 0) {
      return 'Enter a valid price (0 or greater).';
    }
    // End date is optional. It may only be set alongside a start date, and must be after it.
    if (effectiveEnd && !effectiveStart) {
      return 'Set an effective start date before an end date.';
    }
    if (effectiveStart && effectiveEnd && effectiveStart >= effectiveEnd) {
      return 'Effective start date must be before the end date.';
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const body: PackageRequest = {
        packageName: packageName.trim(),
        packageStatus,
        packagePrice: Number(packagePrice),
        effectiveStartDateUtc: dateInputToIso(effectiveStart),
        effectiveEndDateUtc: dateInputToIso(effectiveEnd),
      };
      if (mode === 'add') {
        await addPackage(body);
      } else if (pkg) {
        await updatePackage(pkg.packageId, body);
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
            <legend>Package</legend>

            <label>Name
              <input value={packageName} maxLength={50}
                onChange={(e) => setPackageName(e.target.value)} />
            </label>

            <label>Price (monthly)
              <input type="number" min="0" step="0.01" value={packagePrice}
                placeholder="0.00"
                onChange={(e) => setPackagePrice(e.target.value)} />
            </label>

            <div className="row-2">
              <label>Effective Start
                <input type="date" value={effectiveStart}
                  onChange={(e) => setEffectiveStart(e.target.value)} />
              </label>
              <label>
                <span className="label-with-info">
                  Effective End
                  <InfoTip text="If you provide the end date, the package will expire on this date and you will not be able to select during landlord onboarding" />
                </span>
                <input type="date" value={effectiveEnd}
                  onChange={(e) => setEffectiveEnd(e.target.value)} />
              </label>
            </div>
            <span className="field-hint">
              A package is selectable during onboarding while today is on/after the start date and
              on/before the end date. Leave the end date blank for an open-ended package.
            </span>

            <label className="checkbox">
              <input type="checkbox" checked={packageStatus}
                onChange={(e) => setPackageStatus(e.target.checked)} />
              Active
            </label>
          </fieldset>

          <div className="slide-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : mode === 'add' ? 'Add Package' : 'Save Changes'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
