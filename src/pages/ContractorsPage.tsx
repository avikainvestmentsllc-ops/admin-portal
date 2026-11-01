import { useCallback, useEffect, useState } from 'react';
import { listAllContractors, getContractorPaySetting, setContractorPaySetting, ApiRequestError } from '../api/client';
import type { PlatformToggle } from '../api/client';
import type { ContractorView } from '../api/types';
import { useAdminSummary, usePageHeader } from '../components/AppShell';
import ContractorSlideIn from './ContractorSlideIn';

function contactName(c: ContractorView): string {
  return [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ') || '—';
}

// Collapsible contractor card for XS. Company name + status in the header; contact/phone/email
// and the Edit action revealed on expand.
function ContractorCard({ contractor, onEdit }: { contractor: ContractorView; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ob-card">
      <button type="button" className="ob-card-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="ob-card-main">
          <span className="ob-card-name">{contractor.companyName || '—'}</span>
          <span className="ob-card-cid">{contactName(contractor)}</span>
        </div>
        <span className={contractor.isActive ? 'pill on' : 'pill off'}>{contractor.isActive ? 'Active' : 'Inactive'}</span>
      </button>
      <button type="button" className="ob-card-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Less ▲' : 'More ▼'}
      </button>
      {open && (
        <div className="ob-card-body">
          <div className="ob-card-row"><span className="ob-card-label">Phone</span><span>{contractor.phoneNumber || '—'}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">Email</span><span>{contractor.email || '—'}</span></div>
          <div className="ob-card-actions"><button className="ghost sm" onClick={onEdit}>Edit</button></div>
        </div>
      )}
    </div>
  );
}

/**
 * The platform-wide switch for contractor Stripe payouts. Off: no contractor can enrol or be paid in the app, whatever
 * their own "Get paid in the app" switch says. rental-service picks a change up within 30 seconds.
 */
function ContractorPaySwitch() {
  const [setting, setSetting] = useState<PlatformToggle | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getContractorPaySetting()
      .then(setSetting)
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : 'Failed to load the in-app payments setting'));
  }, []);

  async function toggle(enabled: boolean) {
    setSaving(true);
    setError(null);
    try {
      setSetting(await setContractorPaySetting(enabled));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to save the in-app payments setting');
    } finally {
      setSaving(false);
    }
  }

  const on = setting?.enabled ?? false;
  return (
    <div className="card" data-testid="contractor-pay-switch" style={{ marginBottom: 16 }}>
      {error && <div className="error" role="alert">{error}</div>}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={on}
          disabled={!setting || saving}
          onChange={(e) => toggle(e.target.checked)}
          data-testid="contractor-pay-global"
        />
        <strong>Contractor in-app payments (Stripe)</strong>{' '}
        <span className={on ? 'pill on' : 'pill off'}>{on ? 'On' : 'Off'}</span>
      </label>
      <p className="muted" style={{ marginTop: 6 }}>
        {on
          ? 'On: contractors whose own "Get paid in the app" switch is on can enrol in Stripe payouts, and landlords pay their invoiced jobs in the app. Stripe charges its payment fees; the platform charges nothing on these payments.'
          : 'Off: no contractor can enrol in Stripe payouts or be paid in the app, whatever their own switch says. Landlords mark jobs paid outside the app.'}
        {setting?.updatedAt && ` Last changed ${new Date(setting.updatedAt).toLocaleString()}${setting.updatedBy ? ` by ${setting.updatedBy}` : ''}.`}
      </p>
    </div>
  );
}

/** Contractors (canvas list: Company name · Contact · Email · Phone · Status · Actions). Read-only list; Edit opens the profile panel. */
export default function ContractorsPage() {
  const { refreshSummary } = useAdminSummary();
  const [contractors, setContractors] = useState<ContractorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ContractorView | null>(null);

  const activeCount = contractors.filter((c) => c.isActive).length;
  usePageHeader({
    title: 'Contractors',
    subtitle: loading ? 'Every contractor business registered on the platform' : `${activeCount} active · ${contractors.length} registered`,
  });

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

  useEffect(() => { void load(); }, [load]);

  const closeSlide = () => setSelected(null);
  // Keep the slide-in open on success (it shows its own success message); just refresh the list.
  const onSaved = () => { void load(); refreshSummary(); };

  return (
    <div className="content">
      <ContractorPaySwitch />
      {error && <div className="error" role="alert">{error}</div>}

      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company name</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="table-loading">Loading…</td></tr>
            ) : contractors.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">No contractors yet. Contractors register themselves from the contractor app.</td></tr>
            ) : contractors.map((c) => (
              <tr key={c.contractorId}>
                <td className="cell-strong">{c.companyName || '—'}</td>
                <td>{contactName(c)}</td>
                <td className="cell-mono">{c.email || '—'}</td>
                <td className="cell-mono">{c.phoneNumber || '—'}</td>
                <td><span className={c.isActive ? 'pill on' : 'pill off'}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="actions"><button className="ghost sm" onClick={() => setSelected(c)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {!loading && contractors.map((c) => <ContractorCard key={c.contractorId} contractor={c} onEdit={() => setSelected(c)} />)}
      </div>

      {selected && <ContractorSlideIn contractor={selected} onClose={closeSlide} onSaved={onSaved} />}
    </div>
  );
}
