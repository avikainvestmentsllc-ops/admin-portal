import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLandlords, listPackages, ApiRequestError } from '../api/client';
import type { LandlordAccountView, PackageOption } from '../api/types';
import { useAdminSummary, usePageHeader } from '../components/AppShell';
import LandlordSlideIn, { type SlideMode } from './LandlordSlideIn';

/** EIN as stored is digits-only; display it as XX-XXXXXXX. */
function formatEinDisplay(ein: string): string {
  const d = (ein ?? '').replace(/\D/g, '');
  return d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2)}` : ein || '—';
}

/** Join the non-empty parts of a business address into a single display line. */
function formatAddress(address: LandlordAccountView['businessAddress']): string {
  if (!address) return '—';
  return [address.address_line1, address.address_line2, address.City, address.State, address.ZipCode]
    .filter(Boolean)
    .join(', ') || '—';
}

function contactName(a: LandlordAccountView): string {
  return [a.businessContact?.firstName, a.businessContact?.lastName].filter(Boolean).join(' ') || '—';
}

// Collapsible landlord card for XS. The header (Customer ID, Business Name, Status) is
// clickable and opens the View page; Email, Phone and the View/Edit buttons are collapsible.
function OnboardingCard({ account, onView, onEdit }: { account: LandlordAccountView; onView: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ob-card">
      <button type="button" className="ob-card-head" onClick={onView}>
        <div className="ob-card-main">
          <span className="ob-card-cid">{account.customerAccountId}</span>
          <span className="ob-card-name">{account.businessName}</span>
        </div>
        <span className={account.accountStatus ? 'pill on' : 'pill off'}>{account.accountStatus ? 'Active' : 'Inactive'}</span>
      </button>
      <button type="button" className="ob-card-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Less ▲' : 'More ▼'}
      </button>
      {open && (
        <div className="ob-card-body">
          <div className="ob-card-row"><span className="ob-card-label">Email</span><span>{account.email || '—'}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">Phone</span><span>{account.phoneNumber || '—'}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">EIN</span><span>{formatEinDisplay(account.businessEin)}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">Address</span><span>{formatAddress(account.businessAddress)}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">Package</span><span>{account.packageName || '—'}</span></div>
          <div className="ob-card-row"><span className="ob-card-label">Contact</span><span>{contactName(account)}</span></div>
          <div className="ob-card-actions">
            <button className="ghost sm primary" onClick={onView}>View</button>
            <button className="ghost sm" onClick={onEdit}>Edit</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Onboarding (canvas list: Customer ID · Business name/EIN · Contact/email · Phone · Package · Status · Actions). */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { refreshSummary } = useAdminSummary();
  const [accounts, setAccounts] = useState<LandlordAccountView[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slideMode, setSlideMode] = useState<SlideMode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Search box text; appliedSearch is what was last submitted and drives the list query —
  // typing alone doesn't re-search until "Search" is clicked (or Enter is pressed).
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Zero-based; the backend returns one page (10 accounts) at a time.
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Packages are only needed by the add/edit slide-in, so fetch them on first open.
  const openSlide = (mode: SlideMode, id: string | null) => {
    setSlideMode(mode);
    setSelectedId(id);
    if (packages.length === 0) {
      listPackages()
        .then(setPackages)
        .catch((e) => setError(e instanceof ApiRequestError ? e.message : 'Failed to load packages'));
    }
  };

  usePageHeader({
    title: 'Onboarding',
    subtitle: 'Manage and track new landlord registrations and account statuses',
    cta: { label: 'Onboard Landlord', onClick: () => openSlide('add', null) },
  });

  const load = useCallback(async (search: string, pageNumber: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listLandlords(search, pageNumber);
      setAccounts(result.content);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(appliedSearch, page);
  }, [load, appliedSearch, page]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(0); // a new search always starts back at the first page
  };

  const closeSlide = () => {
    setSlideMode(null);
    setSelectedId(null);
  };
  // Keep the slide-in open on success (it shows its own success message); refresh the list and the sidebar counts.
  const onSaved = () => {
    void load(appliedSearch, page);
    refreshSummary();
  };

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="search"
          value={searchInput}
          maxLength={50}
          placeholder="Search by customer ID, business name, email, phone or EIN"
          aria-label="Search landlord accounts"
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {/* Desktop: table */}
      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Business name</th>
              <th>Contact</th>
              <th>Phone</th>
              <th>Package</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-loading">Loading…</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">
                {appliedSearch ? `No accounts match “${appliedSearch}”.` : 'No landlord accounts yet. Click “Onboard Landlord” to add one.'}
              </td></tr>
            ) : accounts.map((a) => (
              <tr key={a.accountId}>
                <td className="cell-mono">{a.customerAccountId}</td>
                <td>
                  <div className="cell-strong">{a.businessName}</div>
                  <div className="cell-sub">{formatEinDisplay(a.businessEin)}</div>
                </td>
                <td>
                  <div>{contactName(a)}</div>
                  <div className="cell-sub">{a.email}</div>
                </td>
                <td className="cell-mono">{a.phoneNumber || '—'}</td>
                <td>{a.packageName || '—'}</td>
                <td><span className={a.accountStatus ? 'pill on' : 'pill off'}>{a.accountStatus ? 'Active' : 'Inactive'}</span></td>
                <td className="actions">
                  <button className="ghost sm primary" onClick={() => navigate(`/onboarding/${a.accountId}`)}>View</button>
                  <button className="ghost sm" onClick={() => openSlide('edit', a.accountId)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-status">Page {page + 1} of {totalPages} · {totalElements} accounts</span>
            <div className="pagination-buttons">
              <button type="button" className="ghost sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(p - 1, 0))}>‹ Prev</button>
              <button type="button" className="ghost sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}>Next ›</button>
            </div>
          </div>
        )}
      </div>

      {/* XS: collapsible cards */}
      <div className="onboarding-cards">
        {!loading && accounts.map((a) => (
          <OnboardingCard
            key={a.accountId}
            account={a}
            onView={() => navigate(`/onboarding/${a.accountId}`)}
            onEdit={() => openSlide('edit', a.accountId)}
          />
        ))}
        {!loading && totalPages > 1 && (
          <div className="pagination" style={{ borderRadius: 16 }}>
            <span className="pagination-status">Page {page + 1} of {totalPages}</span>
            <div className="pagination-buttons">
              <button type="button" className="ghost sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(p - 1, 0))}>‹ Prev</button>
              <button type="button" className="ghost sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}>Next ›</button>
            </div>
          </div>
        )}
      </div>

      {slideMode && (
        <LandlordSlideIn
          mode={slideMode}
          accountId={selectedId}
          packages={packages}
          onClose={closeSlide}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
