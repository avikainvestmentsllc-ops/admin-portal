import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiRequestError, issuePlatformInvoices, listContractorFees } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { ContractorFeeOverview, FeeRule } from '../api/types';
import { money } from '../components/AppLayout';
import { usePageHeader } from '../components/AppShell';

/** "$20.00 + 5% over $200.00 · max $100.00" — the rule in one line. */
export function ruleLine(rule: FeeRule): string {
  let line = money(rule.baseFee);
  if (Number(rule.pctRate) > 0) line += ` + ${Number(rule.pctRate)}% over ${money(rule.pctThreshold)}`;
  return rule.maxFee != null && Number(rule.maxFee) > 0 ? `${line} · max ${money(rule.maxFee)}` : `${line} · no max`;
}

/** Last month as yyyy-MM — the month the scheduled run bills on the first. */
function lastMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function matches(r: ContractorFeeOverview, q: string): boolean {
  if (!q) return true;
  const hay = [r.companyName, r.contactName, r.email].filter(Boolean).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
}

/**
 * Platform fees, contractor by contractor: search the list, open one to see their fees month
 * by month. The tiles total the whole platform; the statement run is here because it is about
 * every contractor at once.
 */
export default function PlatformFeesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ContractorFeeOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState(lastMonth());
  const [issuing, setIssuing] = useState(false);

  const totals = useMemo(() => rows.reduce(
    (t, r) => ({
      accrued: t.accrued + Number(r.accruedThisMonth || 0),
      unbilled: t.unbilled + Number(r.unbilled || 0),
      outstanding: t.outstanding + Number(r.outstanding || 0),
      open: t.open + Number(r.openInvoices || 0),
    }),
    { accrued: 0, unbilled: 0, outstanding: 0, open: 0 },
  ), [rows]);

  const shown = useMemo(() => rows.filter((r) => matches(r, search.trim())), [rows, search]);

  usePageHeader({
    title: 'Platform Fees',
    subtitle: loading ? 'What every contractor is charged per job, and the statements they owe'
      : `${money(totals.outstanding)} outstanding across ${totals.open} open statement${totals.open === 1 ? '' : 's'}`,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listContractorFees();
      // Money owed first, then unbilled, then the server's name order.
      setRows([...list].sort((a, b) => Number(b.outstanding) - Number(a.outstanding) || Number(b.unbilled) - Number(a.unbilled)));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load platform fees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function issueNow() {
    if (!/^\d{4}-\d{2}$/.test(period)) { setError('Enter the month as YYYY-MM.'); return; }
    if (!window.confirm(`Issue platform statements for ${period} now? Every unbilled fee assessed up to the end of that month goes onto one statement per contractor.`)) return;
    setIssuing(true);
    setError(null);
    setNotice(null);
    try {
      const r = await issuePlatformInvoices(period);
      setNotice(r.statementsIssued === 0
        ? `Nothing to bill for ${r.period}: no unbilled fees.`
        : `${r.period}: ${r.statementsIssued} statement${r.statementsIssued === 1 ? '' : 's'} issued for ${r.feesBilled} job${r.feesBilled === 1 ? '' : 's'}, ${money(r.totalBilled)} in all.`);
      await load();
    } catch (e) {
      setError(toUserMessage(e, 'Could not issue statements'));
    } finally {
      setIssuing(false);
    }
  }

  const open = (r: ContractorFeeOverview) => navigate(`/platform-fees/${r.contractorId}`);

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="tile-grid">
        <div className="tile">
          <div>
            <div className="tile-value">{loading ? '—' : money(totals.accrued)}</div>
            <div className="tile-label">Fees this month, all contractors</div>
          </div>
        </div>
        <div className="tile">
          <div>
            <div className="tile-value">{loading ? '—' : money(totals.unbilled)}</div>
            <div className="tile-label">Accrued, not yet on a statement</div>
          </div>
        </div>
        <div className="tile">
          <div>
            <div className="tile-value">{loading ? '—' : money(totals.outstanding)}</div>
            <div className="tile-label">Issued and unpaid</div>
          </div>
        </div>
        <div className="tile">
          <div style={{ width: '100%' }}>
            <div className="tile-label" style={{ marginTop: 0, marginBottom: 8 }}>Statements run on the 1st for the prior month. Run one now:</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" aria-label="Billing month" style={{ width: 110 }} className="mono" />
              <button className="ghost sm" onClick={() => void issueNow()} disabled={issuing || loading}>
                {issuing ? 'Issuing…' : 'Issue statements'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <form className="search-bar" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          value={search}
          maxLength={80}
          placeholder="Search contractors by company, contact or email"
          aria-label="Search contractors"
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>

      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contractor</th>
              <th>Fee rule</th>
              <th>Jobs this month</th>
              <th>Fees this month</th>
              <th>Unbilled</th>
              <th>Outstanding</th>
              <th>Lifetime</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-loading">Loading…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">{rows.length === 0 ? 'No contractors yet.' : 'No contractor matches that search.'}</td></tr>
            ) : shown.map((r) => (
              <tr key={r.contractorId} onClick={() => open(r)} style={{ cursor: 'pointer' }}>
                <td>
                  <div className="cell-strong">{r.companyName || r.contactName || '—'}</div>
                  <div className="muted cell-mono">{r.email || '—'}</div>
                </td>
                <td>
                  <span className="cell-mono">{ruleLine(r.rule)}</span>
                  {' '}
                  <span className={r.rule.platformDefault ? 'pill off' : 'pill info'}>
                    {r.rule.platformDefault ? 'Default' : `v${r.rule.version}`}
                  </span>
                </td>
                <td className="cell-mono">{r.jobsThisMonth}</td>
                <td className="cell-mono">{money(r.accruedThisMonth)}</td>
                <td className="cell-mono">{money(r.unbilled)}{r.unbilledJobs > 0 && <span className="muted"> · {r.unbilledJobs}</span>}</td>
                <td className="cell-mono">
                  {Number(r.outstanding) > 0
                    ? <span className="pill pending">{money(r.outstanding)} · {r.openInvoices}</span>
                    : <span className="muted">—</span>}
                </td>
                <td className="cell-mono">{money(r.lifetime)}</td>
                <td className="actions"><button className="ghost sm" onClick={(e) => { e.stopPropagation(); open(r); }}>View fees</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {!loading && shown.map((r) => (
          <div className="ob-card" key={r.contractorId}>
            <button type="button" className="ob-card-head" onClick={() => open(r)}>
              <div className="ob-card-main">
                <span className="ob-card-name">{r.companyName || r.contactName || '—'}</span>
                <span className="ob-card-cid">{ruleLine(r.rule)}</span>
              </div>
              {Number(r.outstanding) > 0
                ? <span className="pill pending">{money(r.outstanding)} due</span>
                : <span className="pill off">{money(r.unbilled)} unbilled</span>}
            </button>
            <div className="ob-card-body">
              <div className="ob-card-row"><span className="ob-card-label">This month</span><span>{r.jobsThisMonth} jobs · {money(r.accruedThisMonth)}</span></div>
              <div className="ob-card-row"><span className="ob-card-label">Lifetime</span><span>{money(r.lifetime)}</span></div>
              <div className="ob-card-actions"><button className="ghost sm" onClick={() => open(r)}>View fees</button></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
