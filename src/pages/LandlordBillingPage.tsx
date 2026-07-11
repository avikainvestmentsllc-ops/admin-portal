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
  // Current package = latest by start date.
  const currentPackage = packages.reduce<LandlordPackageView | null>((latest, p) => {
    if (!p.packageStartDate) return latest;
    if (!latest || (latest.packageStartDate ?? '') < p.packageStartDate) return p;
    return latest;
  }, null);

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

          {/* Current package */}
          <div className="section-head">
            <h3 className="section-title">Current Package</h3>
            <button onClick={() => setChanging(true)}>Change Package</button>
          </div>
          {!currentPackage ? (
            <p className="muted">No package assigned.</p>
          ) : (
            <div className="detail-card">
              <div className="detail-grid">
                <div><span className="detail-label">Package</span>{currentPackage.accountPackageName}</div>
                <div><span className="detail-label">Start</span>{isoToDate(currentPackage.packageStartDate)}</div>
                <div><span className="detail-label">End</span>{isoToDate(currentPackage.packageEndDate)}</div>
                <div>
                  <span className="detail-label">Add-ons</span>
                  {Array.isArray(currentPackage.addOns) && currentPackage.addOns.length > 0
                    ? (currentPackage.addOns as Array<{ adons_name?: string }>)
                        .map((a) => a.adons_name).filter(Boolean).join(', ')
                    : '—'}
                </div>
              </div>
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
          current={currentPackage}
          options={options}
          onClose={() => setChanging(false)}
          onSaved={() => {
            setChanging(false);
            void load();
          }}
        />
      )}
    </div>
  );
}
