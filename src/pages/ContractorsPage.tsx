import { useCallback, useEffect, useState } from 'react';
import { listAllContractors, ApiRequestError } from '../api/client';
import type { ContractorView } from '../api/types';
import ContractorSlideIn from './ContractorSlideIn';

function contactName(c: ContractorView): string {
  return [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ') || '—';
}

// Collapsible contractor card for XS. Company name + status in the header; contact/phone/email
// and the Edit action revealed on expand — same pattern as OnboardingCard/MileageRateCard.
function ContractorCard({ contractor, onEdit }: { contractor: ContractorView; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ob-card">
      <button type="button" className="ob-card-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="ob-card-main">
          <span className="ob-card-name">{contractor.companyName || '—'}</span>
          <span className="ob-card-cid">{contactName(contractor)}</span>
        </div>
        <span className={contractor.isActive ? 'badge on' : 'badge off'}>
          {contractor.isActive ? 'Active' : 'Inactive'}
        </span>
      </button>
      <button type="button" className="ob-card-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Less ▲' : 'More ▼'}
      </button>
      {open && (
        <div className="ob-card-body">
          <div className="ob-card-row"><span className="ob-card-label">Phone</span><span>{contractor.phoneNumber || '—'}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">Email</span><span>{contractor.email || '—'}</span></div>
          <div className="ob-card-actions">
            <button className="ghost sm" onClick={onEdit}>Edit</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<ContractorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ContractorView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContractors(await listAllContractors());
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load contractors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closeSlide = () => setSelected(null);
  // Keep the slide-in open on success (it shows its own success message); just refresh the list.
  const onSaved = () => {
    void load();
  };

  return (
    <div className="content wide">
      <div className="page-head">
        <h2>Contractors</h2>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : contractors.length === 0 ? (
        <p className="muted">No contractors yet.</p>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="table-wrap onboarding-desktop">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((c) => (
                  <tr key={c.contractorId}>
                    <td>{c.companyName || '—'}</td>
                    <td>{c.contactFirstName || '—'}</td>
                    <td>{c.contactLastName || '—'}</td>
                    <td>{c.phoneNumber || '—'}</td>
                    <td>{c.email || '—'}</td>
                    <td>
                      <span className={c.isActive ? 'badge on' : 'badge off'}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="actions">
                      <button className="ghost sm" onClick={() => setSelected(c)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* XS: collapsible cards */}
          <div className="onboarding-cards">
            {contractors.map((c) => (
              <ContractorCard key={c.contractorId} contractor={c} onEdit={() => setSelected(c)} />
            ))}
          </div>
        </>
      )}

      {selected && (
        <ContractorSlideIn
          contractor={selected}
          onClose={closeSlide}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
