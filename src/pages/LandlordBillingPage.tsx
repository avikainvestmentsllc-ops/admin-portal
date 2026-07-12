import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getLandlordBilling,
  getLandlordDetails,
  listPackages,
  ApiRequestError,
} from '../api/client';
import type {
  LandlordBillingResponse,
  LandlordPackageView,
  PackageOption,
} from '../api/types';
import ChangePackageSlideIn from './ChangePackageSlideIn';

function money(v: number | null): string {
  return v == null ? '—' : `$${v.toFixed(2)}`;
}

function isoToDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function LandlordBillingPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<LandlordBillingResponse | null>(null);
  const [packages, setPackages] = useState<LandlordPackageView[]>([]);
  const [options, setOptions] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [editSeed, setEditSeed] = useState<LandlordPackageView | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const [billing, details, opts] = await Promise.all([
        getLandlordBilling(accountId),
        getLandlordDetails(accountId),
        listPackages(),
      ]);
      setData(billing);
      setPackages(details.packages);
      setOptions(opts);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const account = data?.account;
  const billing = data?.billing ?? [];

  // Classify each package by its start/end dates relative to now.
  //  - Active:   start <= now and (end is null or end >= now)
  //  - Upcoming: start > now
  //  - Expired:  end < now
  const now = Date.now();
  const planStatus = (p: LandlordPackageView): 'Active' | 'Upcoming' | 'Expired' | '—' => {
    if (!p.packageStartDate) return '—';
    const start = new Date(p.packageStartDate).getTime();
    if (Number.isNaN(start)) return '—';
    if (start > now) return 'Upcoming';
    const end = p.packageEndDate ? new Date(p.packageEndDate).getTime() : null;
    if (end != null && !Number.isNaN(end) && end < now) return 'Expired';
    return 'Active';
  };

  // Packages sorted newest start date first.
  const sortedPackages = [...packages]
    .filter((p) => p.packageStartDate)
    .sort((a, b) => (b.packageStartDate ?? '').localeCompare(a.packageStartDate ?? ''));

  // The future-start (upcoming) package, if any. Its presence hides the top "Change Package"
  // button — the pending plan is edited in place via the per-row edit icon instead.
  const upcomingPackage = sortedPackages.find((p) => planStatus(p) === 'Upcoming') ?? null;
  // Current package = latest by start date (used to seed the change slide-in).
  const currentPackage = sortedPackages[0] ?? null;

  return (
    <div className="content wide">
      <div className="page-head">
        <h2>Landlord Billing</h2>
        <button className="ghost" onClick={() => navigate('/onboarding')}>← Back to Onboarding</button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : !account ? (
        <p className="muted">Landlord not found.</p>
      ) : (
        <>
          {/* Landlord details */}
          <div className="detail-card">
            <h3>{account.businessName}</h3>
            <div className="detail-grid">
              <div><span className="detail-label">Customer ID</span>{account.customerAccountId}</div>
              <div><span className="detail-label">Email</span>{account.email}</div>
              <div><span className="detail-label">Phone</span>{account.phoneNumber}</div>
              <div><span className="detail-label">EIN</span>{account.businessEin}</div>
              <div>
                <span className="detail-label">Status</span>
                <span className={account.accountStatus ? 'badge on' : 'badge off'}>
                  {account.accountStatus ? 'Active' : 'Inactive'}
                </span>
              </div>
              {account.businessAddress && (
                <div className="detail-wide">
                  <span className="detail-label">Address</span>
                  {[account.businessAddress.address_line1, account.businessAddress.address_line2,
                    account.businessAddress.City, account.businessAddress.State,
                    account.businessAddress.ZipCode].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Landlord packages */}
          <div className="section-head">
            <h3 className="section-title">Landlord Package</h3>
            {/* Hide "Change Package" while a future-start plan is pending — edit it in place instead. */}
            {!upcomingPackage && (
              <button onClick={() => { setEditSeed(currentPackage); setChanging(true); }}>
                Change Package
              </button>
            )}
          </div>
          {sortedPackages.length === 0 ? (
            <p className="muted">No package assigned.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Package</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Add-ons</th>
                    <th>Plan</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPackages.map((p) => {
                    const status = planStatus(p);
                    const addOns = Array.isArray(p.addOns) && p.addOns.length > 0
                      ? (p.addOns as Array<{ adons_name?: string }>)
                          .map((a) => a.adons_name).filter(Boolean).join(', ')
                      : '—';
                    return (
                      <tr key={p.accountPackageId ?? p.packageStartDate}>
                        <td>{p.accountPackageName}</td>
                        <td>{isoToDate(p.packageStartDate)}</td>
                        <td>{isoToDate(p.packageEndDate)}</td>
                        <td>{addOns}</td>
                        <td>
                          <span className={
                            status === 'Active' ? 'badge on'
                              : status === 'Upcoming' ? 'badge pending'
                              : status === 'Expired' ? 'badge off'
                              : ''
                          }>
                            {status}
                          </span>
                        </td>
                        <td className="actions">
                          {status === 'Upcoming' && (
                            <button
                              className="ghost sm"
                              title="Edit upcoming plan"
                              aria-label="Edit upcoming plan"
                              onClick={() => { setEditSeed(p); setChanging(true); }}
                            >
                              ✎
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Billing */}
          <h3 className="section-title">Billing</h3>
          {billing.length === 0 ? (
            <p className="muted">No billing available yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Billing Date</th>
                    <th>Package</th>
                    <th>Add-ons</th>
                    <th>Subtotal</th>
                    <th>Tax</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.map((b) => (
                    <tr key={b.billingId}>
                      <td>{isoToDate(b.billingDateUtc)}</td>
                      <td>{money(b.packageAmount)}</td>
                      <td>{money(b.adonsAmount)}</td>
                      <td>{money(b.subTotalAmount)}</td>
                      <td>{money(b.taxAmount)}</td>
                      <td>{money(b.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {changing && account && (
        <ChangePackageSlideIn
          accountId={account.accountId}
          current={editSeed ?? currentPackage}
          options={options}
          onClose={() => { setChanging(false); setEditSeed(null); }}
          onSaved={() => {
            setChanging(false);
            setEditSeed(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
