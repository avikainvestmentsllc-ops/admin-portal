import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError, downloadBillingCsv, getReceivables } from '../api/client';
import type { ReceivableRow, Receivables } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import { money } from '../components/AppLayout';
import { usePageHeader } from '../components/AppShell';
import { Icon } from '../components/Icons';
import StatementSlideIn from './StatementSlideIn';

function day(iso: string | null): string {
  return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

const BUCKETS: { key: '' | ReceivableRow['bucket']; label: string }[] = [
  { key: '', label: 'All open' },
  { key: 'CURRENT', label: 'Not yet due' },
  { key: '1-30', label: '1–30 days' },
  { key: '31-60', label: '31–60 days' },
  { key: '61+', label: '61+ days' },
];

/** Platform fees › Accounts receivable: statements still owed, aged by days past due. */
export default function ReceivablesPage() {
  usePageHeader({ title: 'Accounts receivable', subtitle: 'Contractor statements still owed, by age' });
  const [data, setData] = useState<Receivables | null>(null);
  const [bucket, setBucket] = useState<'' | ReceivableRow['bucket']>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getReceivables());
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : toUserMessage(e, 'Failed to load receivables'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() {
    try {
      await downloadBillingCsv('receivables');
    } catch (e) {
      setError(toUserMessage(e, 'Could not download the CSV'));
    }
  }

  const a = data?.aging;
  const tiles = [
    { label: `Total owed · ${a ? a.statements : 0} statements`, value: a ? money(a.total) : '—', icon: 'fees' as const, tone: 'navy' },
    { label: 'Not yet due', value: a ? money(a.current) : '—', icon: 'dashboard' as const, tone: 'green' },
    { label: '1–30 days past due', value: a ? money(a.days1to30) : '—', icon: 'bell' as const, tone: 'amber' },
    { label: '31+ days past due', value: a ? money(a.days31to60 + a.days61plus) : '—', icon: 'bell' as const, tone: 'amber' },
  ];
  const rows = (data?.rows ?? []).filter((r) => !bucket || r.bucket === bucket);

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}

      <div className="tile-grid" data-testid="receivable-tiles">
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Age
          <select value={bucket} onChange={(e) => setBucket(e.target.value as typeof bucket)} data-testid="receivable-bucket">
            {BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        </label>
        <span className="muted" style={{ flex: 1 }}>{a ? `${a.contractors} contractor${a.contractors === 1 ? '' : 's'} owing` : ''}</span>
        <button className="ghost sm" onClick={() => void exportCsv()} data-testid="receivables-csv">Download CSV</button>
      </div>

      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contractor</th>
              <th>Statement</th>
              <th>Period</th>
              <th>Due</th>
              <th>Amount due</th>
              <th>Age</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td colSpan={8} className="table-loading">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">Nothing owed here.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.invoiceId} data-testid="receivable-row">
                <td className="cell-strong">{r.contractorName}</td>
                <td className="cell-mono">{r.invoiceNumber}</td>
                <td>{day(r.periodStart)} – {day(r.periodEnd)}</td>
                <td>{day(r.dueDate)}</td>
                <td className="cell-mono">{money(r.amountDue)}{r.amountDue !== r.totalAmount && <div className="cell-sub">of {money(r.totalAmount)}</div>}</td>
                <td><span className={r.bucket === 'CURRENT' ? 'pill on' : r.bucket === '1-30' ? 'pill pending' : 'pill danger'}>
                  {r.bucket === 'CURRENT' ? 'Not yet due' : `${r.daysPastDue} days`}</span></td>
                <td className="cell-sub">{[r.paymentClearing && 'Payment clearing', r.autopay && 'Autopay on', r.onHold && 'New work paused'].filter(Boolean).join(' · ') || '—'}</td>
                <td className="actions"><button className="ghost sm" onClick={() => setSelected(r.invoiceId)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {rows.map((r) => (
          <button key={r.invoiceId} type="button" className="ob-card ob-card-head" onClick={() => setSelected(r.invoiceId)}>
            <div className="ob-card-main">
              <span className="ob-card-name">{r.contractorName} · {money(r.amountDue)}</span>
              <span className="ob-card-cid">{r.invoiceNumber} · due {day(r.dueDate)}</span>
            </div>
            <span className={r.bucket === 'CURRENT' ? 'pill on' : 'pill danger'}>{r.bucket === 'CURRENT' ? 'Due' : `${r.daysPastDue}d`}</span>
          </button>
        ))}
      </div>

      {selected && <StatementSlideIn invoiceId={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />}
    </div>
  );
}
