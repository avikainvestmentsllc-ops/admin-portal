import { useMemo, useState, type FormEvent } from 'react';
import { addAddon, updateAddon } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { AddonRequest, AddonView, PackageView } from '../api/types';
import InfoTip from '../components/InfoTip';

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

/** Today's date as a yyyy-MM-dd string in the viewer's local timezone. */
function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const NAME_RE = /^[A-Za-z0-9 .,-]+$/;
// Up to two decimal places, e.g. "9", "9.9", "9.99" but not "9.999".
const PRICE_RE = /^\d+(\.\d{1,2})?$/;

export default function AddonSlideIn({ mode, addon, packages, onClose, onSaved }: Props) {
  const [adonsPackageId, setAdonsPackageId] = useState(addon?.adonsPackageId ?? '');
  const [adonsName, setAdonsName] = useState(addon?.adonsName ?? '');
  const [adonsDescription, setAdonsDescription] = useState(addon?.adonsDescription ?? '');
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
  // Set once a save succeeds; the panel stays open so the user sees this instead of auto-closing.
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // Id of the add-on created by this panel's own add, once saved — further submits update it.
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Once a new add-on has been created, its locked fields behave like an existing one's.
  const isAdd = mode === 'add' && !createdId;
  const title = isAdd ? 'Add Add-on' : 'Edit Add-on';
  const today = todayInput();

  // Per-field validation messages (empty string = valid). Future-date checks apply only
  // when adding a new add-on — editing an already-started add-on must remain possible.
  const fieldErrors = useMemo(() => {
    const priceNum = Number(adonsPrice);
    const countNum = Number(adonsCount);
    return {
      adonsPackageId: !adonsPackageId ? 'Please select a package' : '',
      adonsName: !adonsName.trim()
        ? 'Name is required'
        : adonsName.trim().length > 50
          ? 'Name must be at most 50 characters'
          : !NAME_RE.test(adonsName.trim())
            ? 'Name may only contain letters, numbers, spaces, periods, commas and hyphens'
            : '',
      adonsDescription: adonsDescription.trim().length > 200
        ? 'Description must be at most 200 characters'
        : '',
      adonsCount:
        adonsCount === '' || Number.isNaN(countNum) || countNum < 0 || !Number.isInteger(countNum)
          ? 'Enter a whole number (0 or greater)'
          : countNum > 10000
            ? 'Count must be at most 10000'
            : '',
      adonsPrice:
        adonsPrice === '' || Number.isNaN(priceNum) || priceNum < 0
          ? 'Enter a valid price (0 or greater)'
          : !PRICE_RE.test(adonsPrice.trim())
            ? 'Price may have at most 2 decimal places'
            : '',
      startDate: !startDate
        ? 'Start date is required'
        : isAdd && startDate <= today
          ? 'Start date must be in the future'
          : '',
      // End date is optional (open-ended when blank); when set it must be after the start.
      endDate:
        isAdd && endDate && endDate <= today
          ? 'End date must be in the future'
          : startDate && endDate && startDate >= endDate
            ? 'End date must be after the start date'
            : '',
    };
  }, [adonsPackageId, adonsName, adonsDescription, adonsCount, adonsPrice, startDate, endDate, isAdd, today]);

  const hasErrors = Object.values(fieldErrors).some(Boolean);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const body: AddonRequest = {
        adonsPackageId,
        adonsName: adonsName.trim(),
        adonsDescription: adonsDescription.trim() || null,
        adonsCount: Number(adonsCount),
        adonsPrice: Number(adonsPrice),
        adonsStatus,
        adonsStartTimeUtc: dateInputToIso(startDate) ?? '',
        adonsEndTimeUtc: dateInputToIso(endDate),
      };
      if (isAdd) {
        const created = await addAddon(body);
        setCreatedId(created.adonsId);
        setSavedMessage('Add-on added successfully.');
      } else {
        const id = createdId ?? addon?.adonsId;
        if (id) {
          await updateAddon(id, body);
          setSavedMessage('Add-on saved successfully.');
        }
      }
      onSaved();
    } catch (err) {
      setError(toUserMessage(err));
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
          {error && <div className="error" role="alert">{error}</div>}
          {savedMessage && <div className="notice" role="status">{savedMessage}</div>}

          <fieldset>
            <legend>Add-on</legend>

            <label>Package
              <select value={adonsPackageId}
                disabled={!isAdd}
                aria-invalid={showErrors && !!fieldErrors.adonsPackageId}
                onChange={(e) => setAdonsPackageId(e.target.value)}>
                <option value="" disabled>Select a package…</option>
                {packages.map((p) => (
                  <option key={p.packageId} value={p.packageId}>{p.packageName}</option>
                ))}
              </select>
              {!isAdd && (
                <span className="field-hint">Package cannot be changed after creation.</span>
              )}
              {showErrors && fieldErrors.adonsPackageId && (
                <span className="field-error">{fieldErrors.adonsPackageId}</span>
              )}
            </label>

            <label>Name
              <input value={adonsName} maxLength={50}
                readOnly={!isAdd} disabled={!isAdd}
                aria-invalid={showErrors && !!fieldErrors.adonsName}
                onChange={(e) => setAdonsName(e.target.value)} />
              {!isAdd && (
                <span className="field-hint">Name cannot be changed after creation.</span>
              )}
              {showErrors && fieldErrors.adonsName && (
                <span className="field-error">{fieldErrors.adonsName}</span>
              )}
            </label>

            <label>Description
              <textarea rows={3} value={adonsDescription} maxLength={200}
                aria-invalid={showErrors && !!fieldErrors.adonsDescription}
                onChange={(e) => { setAdonsDescription(e.target.value); setSavedMessage(null); setError(null); }} />
              {showErrors && fieldErrors.adonsDescription && (
                <span className="field-error">{fieldErrors.adonsDescription}</span>
              )}
            </label>

            <div className="row-2">
              <label>Count
                <input type="number" min="0" max="10000" step="1" value={adonsCount}
                  readOnly={!isAdd} disabled={!isAdd}
                  aria-invalid={showErrors && !!fieldErrors.adonsCount}
                  onChange={(e) => setAdonsCount(e.target.value)} />
                {!isAdd && (
                  <span className="field-hint">Count cannot be changed after creation.</span>
                )}
                {showErrors && fieldErrors.adonsCount && (
                  <span className="field-error">{fieldErrors.adonsCount}</span>
                )}
              </label>
              <label>Price
                <input type="number" min="0" step="0.01" value={adonsPrice}
                  placeholder="0.00"
                  readOnly={!isAdd} disabled={!isAdd}
                  aria-invalid={showErrors && !!fieldErrors.adonsPrice}
                  onChange={(e) => setAdonsPrice(e.target.value)} />
                {!isAdd && (
                  <span className="field-hint">Price cannot be changed after creation.</span>
                )}
                {showErrors && fieldErrors.adonsPrice && (
                  <span className="field-error">{fieldErrors.adonsPrice}</span>
                )}
              </label>
            </div>

            <div className="row-2">
              <label>Start
                <input type="date" value={startDate}
                  readOnly={!isAdd} disabled={!isAdd}
                  aria-invalid={showErrors && !!fieldErrors.startDate}
                  onChange={(e) => setStartDate(e.target.value)} />
                {!isAdd && (
                  <span className="field-hint">Start date cannot be changed after creation.</span>
                )}
                {showErrors && fieldErrors.startDate && (
                  <span className="field-error">{fieldErrors.startDate}</span>
                )}
              </label>
              <label>
                <span className="label-with-info">
                  End
                  <InfoTip text="If you provide the end date, the add-on will expire on this date and you will not be able to select during landlord onboarding" />
                </span>
                <input type="date" value={endDate}
                  aria-invalid={showErrors && !!fieldErrors.endDate}
                  onChange={(e) => { setEndDate(e.target.value); setSavedMessage(null); setError(null); }} />
                {showErrors && fieldErrors.endDate && (
                  <span className="field-error">{fieldErrors.endDate}</span>
                )}
              </label>
            </div>

            <label className="checkbox">
              <input type="checkbox" checked={adonsStatus}
                onChange={(e) => { setAdonsStatus(e.target.checked); setSavedMessage(null); setError(null); }} />
              Active
            </label>
          </fieldset>

          <div className="slide-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isAdd ? 'Add Add-on' : 'Save Changes'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
