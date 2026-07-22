import { useMemo, useState, type FormEvent } from 'react';
import { addPackage, updatePackage } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
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

/** Today's date as a yyyy-MM-dd string in the viewer's local timezone. */
function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const NAME_RE = /^[A-Za-z0-9 .,-]+$/;
// Up to two decimal places, e.g. "9", "9.9", "9.99" but not "9.999".
const PRICE_RE = /^\d+(\.\d{1,2})?$/;

export default function PackageSlideIn({ mode, pkg, onClose, onSaved }: Props) {
  const [packageName, setPackageName] = useState(pkg?.packageName ?? '');
  const [packageDescription, setPackageDescription] = useState(pkg?.packageDescription ?? '');
  const [packagePrice, setPackagePrice] = useState(
    pkg?.packagePrice != null ? String(pkg.packagePrice) : '',
  );
  const [packageStatus, setPackageStatus] = useState(pkg?.packageStatus ?? true);
  const [effectiveStart, setEffectiveStart] = useState(isoToDateInput(pkg?.effectiveStartDateUtc));
  const [effectiveEnd, setEffectiveEnd] = useState(isoToDateInput(pkg?.effectiveEndDateUtc));

  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Set once a save succeeds; the panel stays open so the user sees this instead of auto-closing.
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // Id of the package created by this panel's own add, once saved — further submits update it.
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Once a new package has been created, its name/price/start lock just like an existing one,
  // and the panel effectively behaves like an edit for any further changes.
  const isAdd = mode === 'add' && !createdId;
  const title = isAdd ? 'Add Package' : 'Edit Package';
  const today = todayInput();

  // Per-field validation messages (empty string = valid). Future-date checks apply only
  // when adding a new package — editing an already-started package must remain possible.
  const fieldErrors = useMemo(() => ({
    packageName: !packageName.trim()
      ? 'Package name is required'
      : packageName.trim().length > 50
        ? 'Package name must be at most 50 characters'
        : !NAME_RE.test(packageName.trim())
          ? 'Package name may only contain letters, numbers, spaces, periods, commas and hyphens'
          : '',
    packageDescription: packageDescription.trim().length > 200
      ? 'Description must be at most 200 characters'
      : '',
    packagePrice: packagePrice === '' || Number.isNaN(Number(packagePrice)) || Number(packagePrice) < 0
      ? 'Enter a valid price (0 or greater)'
      : !PRICE_RE.test(packagePrice.trim())
        ? 'Price may have at most 2 decimal places'
        : '',
    effectiveStart: !effectiveStart
      ? 'Effective start date is required'
      : isAdd && effectiveStart <= today
        ? 'Effective start date must be in the future'
        : '',
    effectiveEnd: isAdd && effectiveEnd && effectiveEnd <= today
      ? 'Effective end date must be in the future'
      : effectiveStart && effectiveEnd && effectiveStart >= effectiveEnd
        ? 'Effective end date must be after the start date'
        : '',
  }), [packageName, packageDescription, packagePrice, effectiveStart, effectiveEnd, isAdd, today]);

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
      const body: PackageRequest = {
        packageName: packageName.trim(),
        packageDescription: packageDescription.trim() || null,
        packageStatus,
        packagePrice: Number(packagePrice),
        effectiveStartDateUtc: dateInputToIso(effectiveStart),
        effectiveEndDateUtc: dateInputToIso(effectiveEnd),
      };
      if (isAdd) {
        const created = await addPackage(body);
        setCreatedId(created.packageId);
        setSavedMessage('Package added successfully.');
      } else {
        const id = createdId ?? pkg?.packageId;
        if (id) {
          await updatePackage(id, body);
          setSavedMessage('Package saved successfully.');
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
            <legend>Package</legend>

            <label>Name
              <input value={packageName} maxLength={50}
                readOnly={!isAdd} disabled={!isAdd}
                aria-invalid={showErrors && !!fieldErrors.packageName}
                onChange={(e) => setPackageName(e.target.value)} />
              {!isAdd && (
                <span className="field-hint">Package name cannot be changed after creation.</span>
              )}
              {showErrors && fieldErrors.packageName && (
                <span className="field-error">{fieldErrors.packageName}</span>
              )}
            </label>

            <label>Description
              <textarea rows={3} value={packageDescription} maxLength={200}
                aria-invalid={showErrors && !!fieldErrors.packageDescription}
                onChange={(e) => { setPackageDescription(e.target.value); setSavedMessage(null); setSubmitError(null); }} />
              {showErrors && fieldErrors.packageDescription && (
                <span className="field-error">{fieldErrors.packageDescription}</span>
              )}
            </label>

            <label>Price (monthly)
              <input type="number" min="0" step="0.01" value={packagePrice}
                placeholder="0.00"
                readOnly={!isAdd} disabled={!isAdd}
                aria-invalid={showErrors && !!fieldErrors.packagePrice}
                onChange={(e) => setPackagePrice(e.target.value)} />
              {!isAdd && (
                <span className="field-hint">Price cannot be changed after creation.</span>
              )}
              {showErrors && fieldErrors.packagePrice && (
                <span className="field-error">{fieldErrors.packagePrice}</span>
              )}
            </label>

            <div className="row-2">
              <label>Effective Start
                <input type="date" value={effectiveStart}
                  readOnly={!isAdd} disabled={!isAdd}
                  aria-invalid={showErrors && !!fieldErrors.effectiveStart}
                  onChange={(e) => setEffectiveStart(e.target.value)} />
                {!isAdd && (
                  <span className="field-hint">Effective start date cannot be changed after creation.</span>
                )}
                {showErrors && fieldErrors.effectiveStart && (
                  <span className="field-error">{fieldErrors.effectiveStart}</span>
                )}
              </label>
              <label>
                <span className="label-with-info">
                  Effective End
                  <InfoTip text="If you provide the end date, the package will expire on this date and you will not be able to select during landlord onboarding" />
                </span>
                <input type="date" value={effectiveEnd}
                  aria-invalid={showErrors && !!fieldErrors.effectiveEnd}
                  onChange={(e) => { setEffectiveEnd(e.target.value); setSavedMessage(null); setSubmitError(null); }} />
                {showErrors && fieldErrors.effectiveEnd && (
                  <span className="field-error">{fieldErrors.effectiveEnd}</span>
                )}
              </label>
            </div>
            <span className="field-hint">
              A package is selectable during onboarding while today is on/after the start date and
              on/before the end date. Leave the end date blank for an open-ended package.
            </span>

            <label className="checkbox">
              <input type="checkbox" checked={packageStatus}
                onChange={(e) => { setPackageStatus(e.target.checked); setSavedMessage(null); setSubmitError(null); }} />
              Active
            </label>
          </fieldset>

          <div className="slide-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isAdd ? 'Add Package' : 'Save Changes'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
