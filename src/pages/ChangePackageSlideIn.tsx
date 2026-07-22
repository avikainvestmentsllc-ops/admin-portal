import { useMemo, useState, type FormEvent } from 'react';
import { changeLandlordPackage, ApiRequestError } from '../api/client';
import type { LandlordPackageView, PackageOption, SelectedAddon } from '../api/types';

interface Props {
  accountId: string;
  current: LandlordPackageView | null;
  options: PackageOption[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ChangePackageSlideIn({ accountId, current, options, onClose, onSaved }: Props) {
  // Pre-select the package being edited by matching its name to a catalogue option.
  const [packageId, setPackageId] = useState(
    () => options.find((p) => p.packageName === current?.accountPackageName)?.packageId ?? '',
  );
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>(
    () => (Array.isArray(current?.addOns) ? (current!.addOns as SelectedAddon[]) : []),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // True when the current package's billing has not started yet (future start date).
  const notStartedYet = useMemo(() => {
    if (!current?.packageStartDate) return false;
    const start = new Date(current.packageStartDate);
    return !Number.isNaN(start.getTime()) && start.getTime() > Date.now();
  }, [current]);

  const selectedPackage = useMemo(
    () => options.find((p) => p.packageId === packageId) ?? null,
    [options, packageId],
  );

  // Mirror the backend rule: the current package ends the day before the same day-of-month next
  // month (from its start date); the new package's billing starts that same-day-next-month.
  const changeDates = useMemo(() => {
    if (!current?.packageStartDate) return null;
    const start = new Date(current.packageStartDate);
    if (Number.isNaN(start.getTime())) return null;
    const day = start.getDate();
    const boundary = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const lastDay = new Date(boundary.getFullYear(), boundary.getMonth() + 1, 0).getDate();
    boundary.setDate(Math.min(day, lastDay)); // same day-of-month next month, clamped
    const oldEnd = new Date(boundary);
    oldEnd.setDate(oldEnd.getDate() - 1);
    const fmt = (d: Date) => d.toLocaleDateString();
    return { oldEnd: fmt(oldEnd), newStart: fmt(boundary) };
  }, [current]);

  const isSelected = (adonsId: string) => selectedAddons.some((a) => a.adons_id === adonsId);

  const toggleAddon = (opt: PackageOption['addOns'][number], checked: boolean) => {
    setSelectedAddons((prev) => {
      if (checked) {
        if (prev.some((a) => a.adons_id === opt.adonsId)) return prev;
        return [
          ...prev,
          {
            adons_id: opt.adonsId,
            adons_package_id: opt.adonsPackageId,
            adons_name: opt.adonsName,
            adons_count: opt.adonsCount ?? 1,
            adons_price: opt.adonsPrice ?? 0,
          },
        ];
      }
      return prev.filter((a) => a.adons_id !== opt.adonsId);
    });
  };

  const onPackageChange = (id: string) => {
    setPackageId(id);
    setSelectedAddons([]);
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!packageId) {
      setError('Please select a package.');
      return;
    }
    setConfirming(true);
  }

  async function confirmChange() {
    setError(null);
    setSaving(true);
    try {
      await changeLandlordPackage(accountId, { packageId, addOns: selectedAddons });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? `${err.message} (${err.errorCode})` : 'Change failed');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="slide-overlay">
      <aside className="slide-panel">
        <div className="slide-head">
          <h3>Change Package</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="slide-body" onSubmit={handleSubmit} noValidate>
          {error && <div className="error" role="alert">{error}</div>}

          {current && (
            <p className="muted">
              Current package <strong>{current.accountPackageName}</strong>
              {changeDates ? <> will end on <strong>{changeDates.oldEnd}</strong>, and the new package’s
                billing will start on <strong>{changeDates.newStart}</strong>.</>
                : <> will be ended and the new package will start the following day.</>}
            </p>
          )}

          <fieldset>
            <legend>New Package</legend>

            <label>Package
              <select value={packageId} onChange={(e) => onPackageChange(e.target.value)}>
                <option value="" disabled>Select a package…</option>
                {options.map((p) => (
                  <option key={p.packageId} value={p.packageId}>{p.packageName}</option>
                ))}
              </select>
            </label>

            <div className="addons-block">
              <span className="addons-legend">Add-ons</span>
              {!packageId ? (
                <p className="muted">Select a package to see its add-ons.</p>
              ) : !selectedPackage || selectedPackage.addOns.length === 0 ? (
                <p className="muted">No add-ons available for this package.</p>
              ) : (
                selectedPackage.addOns.map((opt) => {
                  const sel = selectedAddons.find((a) => a.adons_id === opt.adonsId);
                  return (
                    <div key={opt.adonsId} className="addon-row">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected(opt.adonsId)}
                          onChange={(e) => toggleAddon(opt, e.target.checked)}
                        />
                        {opt.adonsName}
                        {opt.adonsPrice != null && (
                          <span className="muted"> — ${opt.adonsPrice.toFixed(2)}</span>
                        )}
                      </label>
                      {sel && <span className="addon-count muted">Count: {sel.adons_count}</span>}
                    </div>
                  );
                })
              )}
            </div>
          </fieldset>

          <div className="slide-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Changing…' : 'Change Package'}
            </button>
          </div>
        </form>

        {confirming && (
          <div className="confirm-overlay" onClick={() => !saving && setConfirming(false)}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <h4>Change Package</h4>
              {notStartedYet ? (
                <p>
                  You have requested a plan change but it hasn’t started yet. It will cancel the
                  requested plan and update to the new plan.
                </p>
              ) : (
                <p>Are you sure you want to change the package?</p>
              )}
              {error && <div className="error" role="alert">{error}</div>}
              <div className="slide-actions">
                <button type="button" className="ghost" onClick={() => setConfirming(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="button" onClick={confirmChange} disabled={saving}>
                  {saving ? 'Changing…' : 'Yes, Change'}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
