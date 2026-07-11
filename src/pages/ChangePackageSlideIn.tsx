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
  const [packageId, setPackageId] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedPackage = useMemo(
    () => options.find((p) => p.packageId === packageId) ?? null,
    [options, packageId],
  );

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!packageId) {
      setError('Please select a package.');
      return;
    }
    setSaving(true);
    try {
      await changeLandlordPackage(accountId, { packageId, addOns: selectedAddons });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? `${err.message} (${err.errorCode})` : 'Change failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="slide-overlay" onClick={onClose}>
      <aside className="slide-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slide-head">
          <h3>Change Package</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="slide-body" onSubmit={handleSubmit} noValidate>
          {error && <div className="error" role="alert">{error}</div>}

          {current && (
            <p className="muted">
              Current package <strong>{current.accountPackageName}</strong> will be ended and the new
              package will start the following day.
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
      </aside>
    </div>
  );
}
