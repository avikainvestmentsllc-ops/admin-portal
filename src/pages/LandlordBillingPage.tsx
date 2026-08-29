import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLandlordBilling, getLandlordDetails, listPackages, ApiRequestError } from '../api/client';
import type { LandlordBillingResponse, LandlordPackageView, PackageOption } from '../api/types';
import { money } from '../components/AppLayout';
import { usePageHeader, useToast } from '../components/AppShell';
import ChangePackageSlideIn from './ChangePackageSlideIn';

function isoToDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function isoToMonth(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatEin(ein: string): string {
  const d = (ein ?? '').replace(/\D/g, '');
  return d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2)}` : ein || '—';
}

type AddOnLike = { adons_name?: string; adons_price?: number };

function packageAddOnNames(p: LandlordPackageView): string {
  return Array.isArray(p.addOns) && p.addOns.length > 0
    ? (p.addOns as AddOnLike[]).map((a) => a.adons_name).filter(Boolean).join(', ')
    : '—';
}

function packageAddOnTotal(p: LandlordPackageView): number {
  return Array.isArray(p.addOns) ? (p.addOns as AddOnLike[]).reduce((sum, a) => sum + (a.adons_price ?? 0), 0) : 0;
}

type PlanStatus = 'Active' | 'Upcoming' | 'Expired' | '—';

function planPill(status: PlanStatus): string {
  return status === 'Active' ? 'pill on' : status === 'Upcoming' ? 'pill pending' : status === 'Expired' ? 'pill off' : 'pill';
}

/** Landlord billing (canvas isBilling): account card, current/pending/expired plans, and the invoice history. */
export default function LandlordBillingPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<LandlordBillingResponse | null>(null);
  const [packages, setPackages] = useState<LandlordPackageView[]>([]);
  const [options, setOptions] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [editSeed, setEditSeed] = useState<LandlordPackageView | null>(null);

  const account = data?.account;
  const billing = data?.billing ?? [];

  usePageHeader({
    title: 'Landlord Billing',
    subtitle: account ? `${account.businessName} · ${account.customerAccountId}` : 'Plans and invoices for this account',
    backLabel: 'Back to Onboarding',
    onBack: () => navigate('/onboarding'),
  });

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const [bill, details, opts] = await Promise.all([getLandlordBilling(accountId), getLandlordDetails(accountId), listPackages()]);
      setData(bill);
      setPackages(details.packages);
      setOptions(opts);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { void load(); }, [load]);

  // Classify each package by its start/end dates relative to now.
  const now = Date.now();
  const planStatus = (p: LandlordPackageView): PlanStatus => {
    if (!p.packageStartDate) return '—';
    const start = new Date(p.packageStartDate).getTime();
    if (Number.isNaN(start)) return '—';
    if (start > now) return 'Upcoming';
    const end = p.packageEndDate ? new Date(p.packageEndDate).getTime() : null;
    if (end != null && !Number.isNaN(end) && end < now) return 'Expired';
    return 'Active';
  };

  // Packages sorted newest start date first; an upcoming (future-start) plan hides "Change package"
  // — the pending plan is edited in place instead.
  const sortedPackages = [...packages]
    .filter((p) => p.packageStartDate)
    .sort((a, b) => (b.packageStartDate ?? '').localeCompare(a.packageStartDate ?? ''));
  const upcomingPackage = sortedPackages.find((p) => planStatus(p) === 'Upcoming') ?? null;
  const currentPackage = sortedPackages.find((p) => planStatus(p) === 'Active') ?? sortedPackages[0] ?? null;
  const catalogPrice = (name: string | null) => options.find((o) => o.packageName === name) ? null : null;
  void catalogPrice;
  const latestInvoice = billing[0] ?? null;
  const monthlyTotal = latestInvoice?.totalAmount ?? null;

  if (loading) return <div className="content"><div className="card table-loading">Loading…</div></div>;
  if (error) return <div className="content"><div className="error" role="alert">{error}</div></div>;
  if (!account) return <div className="content"><div className="card table-empty">Landlord not found.</div></div>;

  const contact = account.businessContact;
  const address = account.businessAddress;

  return (
    <div className="content">
      <div className="detail-card">
        <div className="detail-head">
          <div style={{ minWidth: 0 }}>
            <h3>{account.businessName}</h3>
            <div className="detail-cid">{account.customerAccountId}</div>
          </div>
          <span className={account.accountStatus ? 'pill on' : 'pill off'}>{account.accountStatus ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="detail-grid">
          <div><span className="detail-label">Email</span>{account.email || '—'}</div>
          <div><span className="detail-label">Phone</span>{account.phoneNumber || '—'}</div>
          <div><span className="detail-label">EIN</span>{formatEin(account.businessEin)}</div>
          <div><span className="detail-label">Current plan</span>{currentPackage?.accountPackageName ?? account.packageName ?? '—'}</div>
          <div><span className="detail-label">Customer since</span>{isoToMonth(account.createTimeUtc)}</div>
          <div><span className="detail-label">Latest invoice</span>{money(monthlyTotal)}</div>
          {address && (
            <div className="detail-wide">
              <span className="detail-label">Business address</span>
              {[address.address_line1, address.address_line2, address.City, address.State, address.ZipCode].filter(Boolean).join(', ') || '—'}
            </div>
          )}
          {contact && (
            <div className="detail-wide">
              <span className="detail-label">Business contact</span>
              {[`${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim(), contact.email, contact.phoneNumber].filter(Boolean).join(' · ') || '—'}
            </div>
          )}
        </div>
      </div>

      <div className="bill-grid">
        <div className="bill-card">
          <div className="bill-card-head">
            <div>
              <div className="bill-card-title">Packages</div>
              <div className="bill-card-sub">{upcomingPackage ? 'A pending plan change is scheduled — edit it in place' : 'Current plan and history'}</div>
            </div>
            {!upcomingPackage && (
              <button className="ghost primary" onClick={() => { setEditSeed(currentPackage); setChanging(true); }}>Change package</button>
            )}
          </div>
          {sortedPackages.length === 0 && <div className="table-empty">No package assigned.</div>}
          {sortedPackages.map((p) => {
            const status = planStatus(p);
            const price = options.find((o) => o.packageName === p.accountPackageName);
            void price;
            return (
              <div className="plan-row" key={p.accountPackageId ?? p.packageStartDate}>
                <div className="plan-row-head">
                  <span className="plan-name">{p.accountPackageName}</span>
                  <span className={planPill(status)}>{status}</span>
                  <span className="plan-price">{packageAddOnTotal(p) > 0 ? `+${money(packageAddOnTotal(p))} add-ons` : ''}</span>
                  {status === 'Upcoming' && (
                    <button className="plan-edit" onClick={() => { setEditSeed(p); setChanging(true); }}>Edit</button>
                  )}
                </div>
                <div className="plan-term">
                  {status === 'Upcoming' ? `Starts ${isoToDate(p.packageStartDate)}` : `Started ${isoToDate(p.packageStartDate)}`}
                  {p.packageEndDate ? ` · ends ${isoToDate(p.packageEndDate)}` : ' · renews monthly'}
                  {p.freeTrialStartDate ? ` · free trial ${isoToDate(p.freeTrialStartDate)} – ${isoToDate(p.freeTrialEndDate)}` : ''}
                  {p.billingDate ? ` · bills ${isoToDate(p.billingDate)}` : ''}
                </div>
                <div className="plan-addons">Add-ons: {packageAddOnNames(p)}</div>
              </div>
            );
          })}
        </div>

        <div className="bill-card">
          <div className="bill-card-head">
            <div>
              <div className="bill-card-title">Invoices</div>
              <div className="bill-card-sub">{billing.length ? `${billing.length} billing period${billing.length === 1 ? '' : 's'}` : 'No billing available yet'}</div>
            </div>
          </div>
          {billing.length === 0 && <div className="table-empty">Invoices appear here once the first billing date passes.</div>}
          {billing.map((b) => (
            <div
              className="invoice-row"
              key={b.billingId}
              role="button"
              tabIndex={0}
              onClick={() => toast(`${isoToMonth(b.billingDateUtc)} · package ${money(b.packageAmount)} + add-ons ${money(b.adonsAmount)} + tax ${money(b.taxAmount)} = ${money(b.totalAmount)}`)}
            >
              <div className="invoice-main">
                <div className="invoice-period">{isoToMonth(b.billingDateUtc)}</div>
                <div className="invoice-ref">INV-{b.billingId.slice(0, 8).toUpperCase()} · issued {isoToDate(b.billingDateUtc)}</div>
              </div>
              <div className="invoice-right">
                <div className="invoice-amount">{money(b.totalAmount)}</div>
                <span className="pill on">Billed</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {changing && (
        <ChangePackageSlideIn
          accountId={account.accountId}
          current={editSeed ?? currentPackage}
          options={options}
          onClose={() => { setChanging(false); setEditSeed(null); }}
          onSaved={() => { setChanging(false); setEditSeed(null); toast('Package change scheduled.'); void load(); }}
        />
      )}
    </div>
  );
}
