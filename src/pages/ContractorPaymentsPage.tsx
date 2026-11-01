import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError, downloadBillingCsv, listContractorPayments } from '../api/client';
import type { ContractorPaymentsPage as PaymentsData } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import { money } from '../components/AppLayout';
import { usePageHeader } from '../components/AppShell';
import { Icon } from '../components/Icons';
import StatementSlideIn from './StatementSlideIn';

function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const METHOD: Record<string, string> = { card: 'Card', us_bank_account: 'Bank', manual: 'Recorded' };
const SOURCE: Record<string, string> = { ONLINE: 'Online', AUTOPAY: 'Autopay', ADMIN: 'Recorded by admin' };

/** Platform fees › Contractor payments: every statement payment received — online, autopay, or recorded by an admin. */
export default function ContractorPaymentsPage() {
  usePageHeader({ title: 'Contractor payments', subtitle: 'Platform-fee statements paid by contractors' });
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 30 * 86400000)));
  const [to, setTo] = useState(isoDay(today));
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listContractorPayments({ from, to, search: query, page, size: 50 }));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : toUserMessage(e, 'Failed to load payments'));
    } finally {
      setLoading(false);
    }
  }, [from, to, query, page]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() {
    try {
      await downloadBillingCsv('payments', { from, to, search: query });
    } catch (e) {
      setError(toUserMessage(e, 'Could not download the CSV'));
    }
  }

  const tiles = [
    { label: 'Received in range', value: data ? money(data.totalAmount) : '—', icon: 'fees' as const, tone: 'green' },
    { label: 'Payments', value: data ? String(data.count) : '—', icon: 'dashboard' as const, tone: 'navy' },
    { label: 'Paid online / autopay', value: data ? `${money(data.online)} / ${money(data.autopay)}` : '—', icon: 'pricing' as const, tone: 'navy' },
    { label: 'Recorded by admin', value: data ? money(data.recorded) : '—', icon: 'contractors' as const, tone: 'amber' },
  ];
  const first = data && data.total > 0 ? data.page * data.size + 1 : 0;
  const last = data ? Math.min(data.total, (data.page + 1) * data.size) : 0;

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}

      <div className="tile-grid" data-testid="contractor-payment-tiles">
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

      <div className="toolbar" style={{ flexWrap: 'wrap', marginTop: 16, gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>From
          <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(0); }} data-testid="payments-from" />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>To
          <input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPage(0); }} data-testid="payments-to" />
        </label>
        <form className="search-bar" style={{ margin: 0, flex: '1 1 240px', minWidth: 0 }} onSubmit={(e) => { e.preventDefault(); setQuery(search); setPage(0); }}>
          <input placeholder="Search by contractor or statement #" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="submit">Search</button>
        </form>
        <button className="ghost sm" onClick={() => void exportCsv()} data-testid="payments-csv">Download CSV</button>
      </div>

      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Paid on</th>
              <th>Contractor</th>
              <th>Statement</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Source</th>
              <th>Reference</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td colSpan={8} className="table-loading">Loading…</td></tr>
            ) : !data || data.rows.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">No payments in this range.</td></tr>
            ) : data.rows.map((r) => (
              <tr key={r.paymentId} data-testid="contractor-payment-row">
                <td>{day(r.paidAt)}</td>
                <td className="cell-strong">{r.contractorName}</td>
                <td className="cell-mono">{r.invoiceNumber}</td>
                <td className="cell-mono">{money(r.amount)}</td>
                <td>{METHOD[r.method] ?? r.method}</td>
                <td><span className={r.source === 'ADMIN' ? 'pill pending' : 'pill on'}>{SOURCE[r.source] ?? r.source}</span></td>
                <td className="cell-sub" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reference ?? '—'}{r.recordedBy ? ` · ${r.recordedBy}` : ''}</td>
                <td className="actions"><button className="ghost sm" onClick={() => setSelected(r.invoiceId)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {data?.rows.map((r) => (
          <button key={r.paymentId} type="button" className="ob-card ob-card-head" onClick={() => setSelected(r.invoiceId)}>
            <div className="ob-card-main">
              <span className="ob-card-name">{r.contractorName} · {money(r.amount)}</span>
              <span className="ob-card-cid">{r.invoiceNumber} · {day(r.paidAt)} · {SOURCE[r.source] ?? r.source}</span>
            </div>
          </button>
        ))}
      </div>

      {data && data.total > data.size && (
        <div className="pagination">
          <span>{first}–{last} of {data.total}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ghost sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="ghost sm" disabled={last >= data.total} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {selected && <StatementSlideIn invoiceId={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />}
    </div>
  );
}
