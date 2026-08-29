import { useCallback, useEffect, useState } from 'react';
import { listAllMileageRates, ApiRequestError } from '../api/client';
import type { MileageRateView } from '../api/types';
import { useAdminSummary, usePageHeader } from '../components/AppShell';
import MileageRateSlideIn, { type MileageRateSlideMode } from './MileageRateSlideIn';

function formatRate(rate: number | null): string {
  if (rate == null) return '—';
  return `$${rate.toFixed(3)}`;
}

// Collapsible mileage-rate card for XS. Year + Rate in the header; Edit revealed on expand.
function MileageRateCard({ rate, current, onEdit }: { rate: MileageRateView; current: boolean; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ob-card">
      <button type="button" className="ob-card-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="ob-card-main">
          <span className="ob-card-name">{rate.taxYear}</span>
          <span className="ob-card-cid">{formatRate(rate.ratePerMile)} / mile</span>
        </div>
        <span className={current ? 'pill on' : 'pill off'}>{current ? 'Current' : 'Historic'}</span>
      </button>
      <button type="button" className="ob-card-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Less ▲' : 'More ▼'}
      </button>
      {open && (
        <div className="ob-card-body">
          <div className="ob-card-actions"><button className="ghost sm" onClick={onEdit}>Edit</button></div>
        </div>
      )}
    </div>
  );
}

/** Mileage Rates (canvas list: Tax year · Rate per mile · Applies to · Status · Actions). The current rate is the latest year ≤ this year. */
export default function MileageRatesPage() {
  const { refreshSummary } = useAdminSummary();
  const [rates, setRates] = useState<MileageRateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slideMode, setSlideMode] = useState<MileageRateSlideMode | null>(null);
  const [selected, setSelected] = useState<MileageRateView | null>(null);

  usePageHeader({
    title: 'Mileage Rates',
    subtitle: 'IRS standard rate per tax year, used by landlord mileage logs',
    cta: { label: '+ Add Rate', onClick: () => { setSelected(null); setSlideMode('add'); } },
  });

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

  useEffect(() => { void load(); }, [load]);

  const thisYear = new Date().getFullYear();
  const currentYear = rates.filter((r) => r.taxYear <= thisYear).reduce((best, r) => Math.max(best, r.taxYear), 0);
  const sorted = [...rates].sort((a, b) => b.taxYear - a.taxYear);

  const openEdit = (rate: MileageRateView) => { setSelected(rate); setSlideMode('edit'); };
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
              <th>Tax year</th>
              <th>Rate per mile</th>
              <th>Applies to</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="table-loading">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">No mileage rates yet. Click “Add Rate” to create one.</td></tr>
            ) : sorted.map((r) => {
              const current = r.taxYear === currentYear;
              return (
                <tr key={r.mileageRateId}>
                  <td className="cell-strong cell-mono">{r.taxYear}</td>
                  <td className="cell-mono">{formatRate(r.ratePerMile)}</td>
                  <td>Landlord mileage logs, {r.taxYear}</td>
                  <td><span className={current ? 'pill on' : r.taxYear > thisYear ? 'pill pending' : 'pill off'}>{current ? 'Current' : r.taxYear > thisYear ? 'Upcoming' : 'Historic'}</span></td>
                  <td className="actions"><button className="ghost sm" onClick={() => openEdit(r)}>Edit</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {!loading && sorted.map((r) => (
          <MileageRateCard key={r.mileageRateId} rate={r} current={r.taxYear === currentYear} onEdit={() => openEdit(r)} />
        ))}
      </div>

      {slideMode && (
        <MileageRateSlideIn mode={slideMode} rate={selected} onClose={closeSlide} onSaved={onSaved} />
      )}
    </div>
  );
}
