import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAllAddons, listAllPackages, ApiRequestError } from '../api/client';
import type { AddonView, PackageView } from '../api/types';
import { useAdminSummary, usePageHeader } from '../components/AppShell';
import AddonSlideIn, { type AddonSlideMode } from './AddonSlideIn';

/** Format a UTC ISO datetime as a date only (no time), or a dash when absent. */
function isoToDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function formatPrice(price: number | null): string {
  return price == null ? '—' : `$${price.toFixed(2)}`;
}

// Collapsible add-on card for XS. Name + Package + Status in the header; the rest collapsible.
function AddonCard({ addon, packageName, onEdit }: { addon: AddonView; packageName: string; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ob-card">
      <button type="button" className="ob-card-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="ob-card-main">
          <span className="ob-card-name">{addon.adonsName}</span>
          <span className="ob-card-cid">{packageName}</span>
        </div>
        <span className={addon.adonsStatus ? 'pill on' : 'pill off'}>{addon.adonsStatus ? 'Active' : 'Inactive'}</span>
      </button>
      <button type="button" className="ob-card-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Less ▲' : 'More ▼'}
      </button>
      {open && (
        <div className="ob-card-body">
          <div className="ob-card-row"><span className="ob-card-label">Count</span><span>{addon.adonsCount ?? '—'}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">Price</span><span>{formatPrice(addon.adonsPrice)}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">Start</span><span>{isoToDate(addon.adonsStartTimeUtc)}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">End</span><span>{isoToDate(addon.adonsEndTimeUtc)}</span></div>
          <div className="ob-card-actions"><button className="ghost sm" onClick={onEdit}>Edit</button></div>
        </div>
      )}
    </div>
  );
}

/** Add-ons (canvas list: Add-on · Package · Count · Price · Effective start (+ end) · Status · Actions). */
export default function AddonsPage() {
  const { refreshSummary } = useAdminSummary();
  const [addons, setAddons] = useState<AddonView[]>([]);
  const [packages, setPackages] = useState<PackageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slideMode, setSlideMode] = useState<AddonSlideMode | null>(null);
  const [selected, setSelected] = useState<AddonView | null>(null);

  const activeCount = addons.filter((a) => a.adonsStatus).length;
  const packageCount = new Set(addons.map((a) => a.adonsPackageId)).size;
  usePageHeader({
    title: 'Add-ons',
    subtitle: loading ? 'Optional extras attached to a package' : `${activeCount} active add-on${activeCount === 1 ? '' : 's'} across ${packageCount} package${packageCount === 1 ? '' : 's'}`,
    cta: { label: '+ Add Add-on', onClick: () => { if (packages.length === 0) return; setSelected(null); setSlideMode('add'); } },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ads, pkgs] = await Promise.all([listAllAddons(), listAllPackages()]);
      setAddons(ads);
      setPackages(pkgs);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load add-ons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Package id -> name, so the table can show the associated package.
  const packageName = useMemo(() => {
    const map = new Map<string, string>();
    packages.forEach((p) => map.set(p.packageId, p.packageName));
    return (id: string) => map.get(id) ?? id;
  }, [packages]);

  const openEdit = (addon: AddonView) => { setSelected(addon); setSlideMode('edit'); };
  const closeSlide = () => { setSlideMode(null); setSelected(null); };
  // Keep the slide-in open on success (it shows its own success message); just refresh the list.
  const onSaved = () => { void load(); refreshSummary(); };

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}
      {!loading && packages.length === 0 && (
        <div className="info-note" style={{ marginBottom: 14 }}>Create a package first — add-ons must be associated with a package.</div>
      )}

      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Add-on</th>
              <th>Package</th>
              <th>Count</th>
              <th>Price</th>
              <th>Effective start</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-loading">Loading…</td></tr>
            ) : addons.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">No add-ons yet. Click “Add Add-on” to create one.</td></tr>
            ) : addons.map((a) => (
              <tr key={a.adonsId}>
                <td>
                  <div className="cell-strong">{a.adonsName}</div>
                  {a.adonsDescription && <div className="cell-sub" style={{ fontFamily: 'var(--font)' }}>{a.adonsDescription}</div>}
                </td>
                <td>{packageName(a.adonsPackageId)}</td>
                <td className="cell-mono">{a.adonsCount ?? '—'}</td>
                <td className="cell-mono">{formatPrice(a.adonsPrice)}</td>
                <td>
                  <div className="cell-mono">{isoToDate(a.adonsStartTimeUtc)}</div>
                  {a.adonsEndTimeUtc && <div className="cell-sub">ends {isoToDate(a.adonsEndTimeUtc)}</div>}
                </td>
                <td><span className={a.adonsStatus ? 'pill on' : 'pill off'}>{a.adonsStatus ? 'Active' : 'Inactive'}</span></td>
                <td className="actions"><button className="ghost sm" onClick={() => openEdit(a)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {!loading && addons.map((a) => (
          <AddonCard key={a.adonsId} addon={a} packageName={packageName(a.adonsPackageId)} onEdit={() => openEdit(a)} />
        ))}
      </div>

      {slideMode && (
        <AddonSlideIn mode={slideMode} addon={selected} packages={packages} onClose={closeSlide} onSaved={onSaved} />
      )}
    </div>
  );
}
