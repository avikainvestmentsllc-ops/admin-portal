import { useCallback, useEffect, useState } from 'react';
import { listAllPackages, ApiRequestError } from '../api/client';
import type { PackageView } from '../api/types';
import { useAdminSummary, usePageHeader } from '../components/AppShell';
import PackageSlideIn, { type PackageSlideMode } from './PackageSlideIn';

/** Format a UTC ISO datetime as a date only (no time), or a dash when absent. */
function isoToDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return `$${price.toFixed(2)}`;
}

// Collapsible package card for XS. Name + Price + Status in the header; the rest collapsible.
function PackageCard({ pkg, onEdit }: { pkg: PackageView; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ob-card">
      <button type="button" className="ob-card-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="ob-card-main">
          <span className="ob-card-name">{pkg.packageName}</span>
          <span className="ob-card-cid">{formatPrice(pkg.packagePrice)} / mo</span>
        </div>
        <span className={pkg.packageStatus ? 'pill on' : 'pill off'}>{pkg.packageStatus ? 'Active' : 'Inactive'}</span>
      </button>
      <button type="button" className="ob-card-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Less ▲' : 'More ▼'}
      </button>
      {open && (
        <div className="ob-card-body">
          <div className="ob-card-row"><span className="ob-card-label">Start</span><span>{isoToDate(pkg.effectiveStartDateUtc)}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">End</span><span>{isoToDate(pkg.effectiveEndDateUtc)}</span></div>
          {pkg.packageDescription && <div className="ob-card-row"><span className="ob-card-label">About</span><span>{pkg.packageDescription}</span></div>}
          <div className="ob-card-actions"><button className="ghost sm" onClick={onEdit}>Edit</button></div>
        </div>
      )}
    </div>
  );
}

/** Packages (canvas list: Name · Price · Description · Effective start (+ end) · Status · Actions). */
export default function PackagesPage() {
  const { refreshSummary } = useAdminSummary();
  const [packages, setPackages] = useState<PackageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slideMode, setSlideMode] = useState<PackageSlideMode | null>(null);
  const [selected, setSelected] = useState<PackageView | null>(null);

  const activeCount = packages.filter((p) => p.packageStatus).length;
  usePageHeader({
    title: 'Packages',
    subtitle: loading ? 'Subscription plans landlords can be placed on' : `${activeCount} active plan${activeCount === 1 ? '' : 's'} · ${packages.length} on file`,
    cta: { label: '+ Add Package', onClick: () => { setSelected(null); setSlideMode('add'); } },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPackages(await listAllPackages());
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openEdit = (pkg: PackageView) => { setSelected(pkg); setSlideMode('edit'); };
  const closeSlide = () => { setSlideMode(null); setSelected(null); };
  // Keep the slide-in open on success (it shows its own success message); just refresh the list.
  const onSaved = () => { void load(); refreshSummary(); };

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}

      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Price</th>
              <th>Description</th>
              <th>Effective start</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="table-loading">Loading…</td></tr>
            ) : packages.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">No packages yet. Click “Add Package” to create one.</td></tr>
            ) : packages.map((p) => (
              <tr key={p.packageId}>
                <td className="cell-strong">{p.packageName}</td>
                <td className="cell-mono">{formatPrice(p.packagePrice)}</td>
                <td style={{ whiteSpace: 'normal', maxWidth: 320 }}>{p.packageDescription || '—'}</td>
                <td>
                  <div className="cell-mono">{isoToDate(p.effectiveStartDateUtc)}</div>
                  {p.effectiveEndDateUtc && <div className="cell-sub">ends {isoToDate(p.effectiveEndDateUtc)}</div>}
                </td>
                <td><span className={p.packageStatus ? 'pill on' : 'pill off'}>{p.packageStatus ? 'Active' : 'Inactive'}</span></td>
                <td className="actions"><button className="ghost sm" onClick={() => openEdit(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {!loading && packages.map((p) => <PackageCard key={p.packageId} pkg={p} onEdit={() => openEdit(p)} />)}
      </div>

      {slideMode && (
        <PackageSlideIn mode={slideMode} pkg={selected} onClose={closeSlide} onSaved={onSaved} />
      )}
    </div>
  );
}
