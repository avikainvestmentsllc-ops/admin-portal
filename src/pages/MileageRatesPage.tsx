import { useCallback, useEffect, useState } from 'react';
import { listAllMileageRates, ApiRequestError } from '../api/client';
import type { MileageRateView } from '../api/types';
import MileageRateSlideIn, { type MileageRateSlideMode } from './MileageRateSlideIn';

function formatRate(rate: number | null): string {
  if (rate == null) return '—';
  return `$${rate.toFixed(3)}`;
}

// Collapsible mileage-rate card for XS. Year + Rate in the header; Edit revealed on expand.
function MileageRateCard({ rate, onEdit }: { rate: MileageRateView; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ob-card">
      <button type="button" className="ob-card-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="ob-card-main">
          <span className="ob-card-name">{rate.taxYear}</span>
          <span className="ob-card-cid">{formatRate(rate.ratePerMile)} / mile</span>
        </div>
      </button>
      <button type="button" className="ob-card-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Less ▲' : 'More ▼'}
      </button>
      {open && (
        <div className="ob-card-body">
          <div className="ob-card-actions">
            <button className="ghost sm" onClick={onEdit}>Edit</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MileageRatesPage() {
  const [rates, setRates] = useState<MileageRateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slideMode, setSlideMode] = useState<MileageRateSlideMode | null>(null);
  const [selected, setSelected] = useState<MileageRateView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRates(await listAllMileageRates());
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load mileage rates');
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
  const openEdit = (rate: MileageRateView) => {
    setSelected(rate);
    setSlideMode('edit');
  };
  const closeSlide = () => {
    setSlideMode(null);
    setSelected(null);
  };
  // Keep the slide-in open on success (it shows its own success message); just refresh the list.
  const onSaved = () => {
    void load();
  };

  return (
    <div className="content wide">
      <div className="page-head">
        <h2>Mileage Rates</h2>
        <button onClick={openAdd}>+ Add Rate</button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rates.length === 0 ? (
        <p className="muted">No mileage rates yet. Click “Add Rate” to create one.</p>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="table-wrap onboarding-desktop">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Rate per Mile</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.mileageRateId}>
                    <td>{r.taxYear}</td>
                    <td>{formatRate(r.ratePerMile)}</td>
                    <td className="actions">
                      <button className="ghost sm" onClick={() => openEdit(r)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* XS: collapsible cards */}
          <div className="onboarding-cards">
            {rates.map((r) => (
              <MileageRateCard key={r.mileageRateId} rate={r} onEdit={() => openEdit(r)} />
            ))}
          </div>
        </>
      )}

      {slideMode && (
        <MileageRateSlideIn
          mode={slideMode}
          rate={selected}
          onClose={closeSlide}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
