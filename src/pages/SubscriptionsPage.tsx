import { useCallback, useEffect, useState } from 'react';
import { cancelSubscription, getSubscription, listSubscriptions, ApiRequestError,
  type SubscriptionDetail, type SubscriptionPage, type SubscriptionRow } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import { money } from '../components/AppLayout';
import { usePageHeader, useToast } from '../components/AppShell';
import { Icon } from '../components/Icons';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active', PAST_DUE: 'Past due', UNPAID: 'Unpaid', INCOMPLETE: 'Awaiting payment', CANCELED: 'Cancelled',
};
const STATUS_PILL: Record<string, string> = {
  ACTIVE: 'on', PAST_DUE: 'danger', UNPAID: 'danger', INCOMPLETE: 'pending', CANCELED: 'off',
};
const CANCEL_REASON: Record<string, string> = {
  TOO_EXPENSIVE: 'Too expensive', MISSING_FEATURES: 'Missing features', NOT_USING: 'Not using it enough',
  SWITCHING_PROVIDER: 'Switching to another product', TEMPORARY: 'Taking a break', OTHER: 'Other',
};
const FILTERS = [
  { value: 'LIVE', label: 'Current' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAST_DUE', label: 'Past due' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'INCOMPLETE', label: 'Awaiting payment' },
  { value: 'CANCELED', label: 'Cancelled' },
  { value: 'ALL', label: 'All' },
];

function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';
}

function daysUntil(iso: string | null): string {
  if (!iso) return '';
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d < 0 ? 'overdue' : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
}

function StatusPill({ row }: { row: SubscriptionRow }) {
  const cancelling = row.cancelAtPeriodEnd && row.status === 'ACTIVE';
  const downgrading = !cancelling && row.scheduledPlanName && row.status !== 'CANCELED';
  return (
    <span className={`pill ${cancelling || downgrading ? 'pending' : STATUS_PILL[row.status] ?? 'off'}`}>
      {cancelling ? 'Cancels at renewal' : downgrading ? `Changes to ${row.scheduledPlanName}` : STATUS_LABEL[row.status] ?? row.status}
    </span>
  );
}

function SubscriptionSlideIn({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSubscription(id).then(setDetail).catch((e) => setError(toUserMessage(e, 'Could not load the subscription')));
  }, [id]);

  async function cancel() {
    setBusy(true); setError(null);
    try {
      setDetail(await cancelSubscription(id));
      setConfirming(false);
      toast('Cancellation requested. The landlord moves to the Free plan within a minute.');
      onChanged();
    } catch (e) {
      setError(toUserMessage(e, 'Could not cancel the subscription'));
    } finally {
      setBusy(false);
    }
  }

  const s = detail?.subscription;
  const cancellable = !!s && ['ACTIVE', 'PAST_DUE', 'UNPAID', 'INCOMPLETE'].includes(s.status) && !s.cancelRequested;
  return (
    <div className="slide-overlay">
      <aside className="slide-panel">
        <div className="slide-head">
          <h3>Subscription</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="slide-body">
          {error && <div className="error" role="alert">{error}</div>}
          {!detail && !error && <p className="muted">Loading…</p>}
          {s && (
            <>
              <fieldset>
                <legend>Plan</legend>
                <dl className="kv">
                  <dt>Landlord</dt><dd>{s.landlordName ?? '—'}{s.customerAccountId ? ` · ${s.customerAccountId}` : ''}</dd>
                  <dt>Email</dt><dd>{s.landlordEmail ?? '—'}</dd>
                  <dt>Plan</dt><dd>{s.planName ?? '—'}</dd>
                  <dt>Status</dt><dd><StatusPill row={s} /></dd>
                  <dt>Renewal date</dt><dd>{day(s.renewalDate)} {s.renewalDate && s.status !== 'CANCELED' ? `(${daysUntil(s.renewalDate)})` : ''}</dd>
                  <dt>Renewal price</dt><dd className="cell-mono">{money(s.renewalPrice)} / month</dd>
                  <dt>Started</dt><dd>{day(s.startedAt)}</dd>
                  <dt>Last paid</dt><dd>{day(s.lastPaidAt)}</dd>
                  {s.scheduledPlanName && (<><dt>Booked change</dt><dd>{s.scheduledPlanName} from {day(s.scheduledOn)} at <span className="cell-mono">{money(s.scheduledPrice)}</span> / month</dd></>)}
                  {s.cancelAtPeriodEnd && (<><dt>Cancels</dt><dd>At renewal, {day(s.renewalDate)}</dd></>)}
                  {s.cancelReason && (<><dt>Cancel reason</dt><dd>{CANCEL_REASON[s.cancelReason] ?? s.cancelReason}{s.cancelComment ? ` — “${s.cancelComment}”` : ''}</dd></>)}
                  {s.failureReason && (<><dt>Payment problem</dt><dd className="field-error">{s.failureReason}</dd></>)}
                  {s.canceledAt && (<><dt>Cancelled</dt><dd>{day(s.canceledAt)}</dd></>)}
                  <dt>Stripe</dt><dd className="cell-mono">{s.stripeSubscriptionId}</dd>
                </dl>
              </fieldset>
              <fieldset>
                <legend>Payments</legend>
                {detail!.invoices.length === 0 ? <p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>No payments yet.</p> : (
                  <table className="data-table" style={{ gridColumn: '1 / -1' }}>
                    <thead><tr><th>Date</th><th>Subtotal</th><th>Tax</th><th>Paid</th></tr></thead>
                    <tbody>
                      {detail!.invoices.map((i) => (
                        <tr key={i.stripeInvoiceId}>
                          <td>{day(i.billedAt)}</td>
                          <td className="cell-mono">{money(i.subtotal)}</td>
                          <td className="cell-mono">{money(i.tax)}</td>
                          <td className="cell-mono cell-strong">{money(i.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </fieldset>
              {s.cancelRequested && <div className="notice" role="status">Cancellation requested; it runs within a minute.</div>}
              {confirming && (
                <div className="error" role="alert">
                  Cancel {s.landlordName}'s {s.planName} plan now? Stripe stops billing and the account moves to the Free plan immediately.
                </div>
              )}
            </>
          )}
          {cancellable && (
            <div className="slide-actions">
              <button type="button" className="ghost" onClick={() => (confirming ? setConfirming(false) : onClose())}>
                {confirming ? 'Keep subscription' : 'Close'}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => (confirming ? void cancel() : setConfirming(true))} data-testid="subscription-cancel"
                style={{ background: 'var(--red)', flex: 2 }}>
                {busy ? 'Cancelling…' : confirming ? 'Yes, cancel now' : 'Cancel subscription'}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/** Subscriptions: landlords' paid plans billed by Stripe, soonest renewal first. */
export default function SubscriptionsPage() {
  const [status, setStatus] = useState('LIVE');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<SubscriptionPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  usePageHeader({ title: 'Subscriptions', subtitle: 'Landlord paid plans billed monthly through Stripe' });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await listSubscriptions(status, query, page));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [status, query, page]);

  useEffect(() => { void load(); }, [load]);

  const t = data?.totals;
  const tiles = [
    { label: 'Active subscriptions', value: t ? String(t.active) : '—', icon: 'dashboard' as const, tone: 'navy' },
    { label: 'Monthly recurring (active)', value: t ? money(t.monthlyRecurring) : '—', icon: 'fees' as const, tone: 'green' },
    { label: 'Past due or unpaid', value: t ? String(t.pastDue) : '—', icon: 'bell' as const, tone: 'amber' },
    { label: 'Renewing in 7 days', value: t ? String(t.renewingIn7Days) : '—', icon: 'pricing' as const, tone: 'navy' },
  ];
  const from = data && data.total > 0 ? data.page * data.size + 1 : 0;
  const to = data ? Math.min(data.total, (data.page + 1) * data.size) : 0;

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}

      <div className="tile-grid" data-testid="subscription-tiles">
        {tiles.map((x) => (
          <div key={x.label} className="tile">
            <span className={`tile-icon ${x.tone}`}><Icon name={x.icon} size={19} strokeWidth={1.7} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="tile-value">{x.value}</div>
              <div className="tile-label">{x.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ flexWrap: 'wrap', marginTop: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Status
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} data-testid="subscription-status-filter">
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        <form className="search-bar" style={{ margin: 0, flex: '1 1 280px', minWidth: 0 }} onSubmit={(e) => { e.preventDefault(); setQuery(search); setPage(0); }}>
          <input placeholder="Search by landlord, email, customer ID or plan" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="submit">Search</button>
        </form>
      </div>

      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Landlord</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Renewal date</th>
              <th>Renewal price</th>
              <th>Last paid</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td colSpan={7} className="table-loading">Loading…</td></tr>
            ) : !data || data.items.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">No subscriptions here.</td></tr>
            ) : data.items.map((r) => (
              <tr key={r.subscriptionId} data-testid="subscription-row">
                <td className="cell-strong">{r.landlordName ?? '—'}<div className="cell-sub">{r.customerAccountId ?? r.landlordEmail ?? ''}</div></td>
                <td>{r.planName ?? '—'}</td>
                <td><StatusPill row={r} /></td>
                <td>{day(r.renewalDate)}<div className="cell-sub">{r.status !== 'CANCELED' ? daysUntil(r.renewalDate) : ''}</div></td>
                <td className="cell-mono">{money(r.renewalPrice)}</td>
                <td>{day(r.lastPaidAt)}</td>
                <td className="actions"><button className="ghost sm" onClick={() => setSelected(r.subscriptionId)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {data?.items.map((r) => (
          <button key={r.subscriptionId} type="button" className="ob-card ob-card-head" onClick={() => setSelected(r.subscriptionId)}>
            <div className="ob-card-main">
              <span className="ob-card-name">{r.landlordName ?? '—'} · {r.planName}</span>
              <span className="ob-card-cid">{money(r.renewalPrice)} · renews {day(r.renewalDate)}</span>
            </div>
            <StatusPill row={r} />
          </button>
        ))}
      </div>

      {data && data.total > data.size && (
        <div className="pagination">
          <span>{from}–{to} of {data.total}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ghost sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="ghost sm" disabled={to >= data.total} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {selected && <SubscriptionSlideIn id={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />}
    </div>
  );
}
