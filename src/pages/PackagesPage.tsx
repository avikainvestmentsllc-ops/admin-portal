import { useCallback, useEffect, useState } from 'react';
import { listAllPackages, ApiRequestError } from '../api/client';
import type { PackageView } from '../api/types';
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

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slideMode, setSlideMode] = useState<PackageSlideMode | null>(null);
  const [selected, setSelected] = useState<PackageView | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setSelected(null);
    setSlideMode('add');
  };
  const openEdit = (pkg: PackageView) => {
    setSelected(pkg);
    setSlideMode('edit');
  };
  const closeSlide = () => {
    setSlideMode(null);
    setSelected(null);
  };
  const onSaved = () => {
    closeSlide();
    void load();
  };

  return (
    <div className="content wide">
      <div className="page-head">
        <h2>Packages</h2>
        <button onClick={openAdd}>+ Add Package</button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : packages.length === 0 ? (
        <p className="muted">No packages yet. Click “Add Package” to create one.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Status</th>
                <th>Effective Start</th>
                <th>Effective End</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.packageId}>
                  <td>{p.packageName}</td>
                  <td>{formatPrice(p.packagePrice)}</td>
                  <td>
                    <span className={p.packageStatus ? 'badge on' : 'badge off'}>
                      {p.packageStatus ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{isoToDate(p.effectiveStartDateUtc)}</td>
                  <td>{isoToDate(p.effectiveEndDateUtc)}</td>
                  <td className="actions">
                    <button className="ghost sm" onClick={() => openEdit(p)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {slideMode && (
        <PackageSlideIn
          mode={slideMode}
          pkg={selected}
          onClose={closeSlide}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
