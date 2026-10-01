import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiRequestError, getStatementRun, listContractorFees, listPricingTerms, listStatementRuns, listStatements, reconcileStatements } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { ContractorFeeOverview, FeeRule, PlatformStatementRow, PricingTermsVersion, StatementRun } from '../api/types';
import { money } from '../components/AppLayout';
import { usePageHeader } from '../components/AppShell';
import { latestClosedPeriod, periodLabel, sourceLabel, sourcePill } from '../utils/pricing';
import { day } from './PricingSheetSlideIn';
import StatementSlideIn from './StatementSlideIn';

/** "$20.00 + 5% over $200.00 · max $100.00" — the default row in one line. */
export function ruleLine(rule: FeeRule): string {
  let line = money(rule.baseFee);
  if (Number(rule.pctRate) > 0) line += ` + ${Number(rule.pctRate)}% over ${money(rule.pctThreshold)}`;
  return rule.maxFee != null && Number(rule.maxFee) > 0 ? `${line} · max ${money(rule.maxFee)}` : `${line} · no max`;
}

function matches(r: ContractorFeeOverview, q: string): boolean {
  if (!q) return true;
  const hay = [r.companyName, r.contactName, r.email].filter(Boolean).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
}

/** "Sep 20 – Oct 19" from a run month "2026-10". */
function periodOfRunMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const start = new Date(y, m - 2, 20);
  const end = new Date(y, m - 1, 19);
  const f = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(start)} – ${f(end)}`;
}

const RUN_PILL: Record<StatementRun['status'], string> = { REQUESTED: 'pill pending', RUNNING: 'pill pending', COMPLETED: 'pill on', FAILED: 'pill danger' };
const STMT_PILL: Record<PlatformStatementRow['status'], string> = { ISSUED: 'pill pending', PAID: 'pill on', VOID: 'pill off' };

type Tab = 'contractors' | 'statements' | 'runs';

/**
 * Platform fees: every contractor and what they are charged, the statements for a period, and
 * the statement runs. Statements run on the 20th for the 20th–19th period, due the 1st; an
 * administrator can reconcile a period here — the run is idempotent, so re-running only heals.
 */
export default function PlatformFeesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('contractors');
  const [rows, setRows] = useState<ContractorFeeOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState(latestClosedPeriod());
  const [reconciling, setReconciling] = useState(false);
  const [statements, setStatements] = useState<PlatformStatementRow[]>([]);
  const [statementsLoading, setStatementsLoading] = useState(false);
  const [runs, setRuns] = useState<StatementRun[]>([]);
  const [openStatement, setOpenStatement] = useState<string | null>(null);
  const [template, setTemplate] = useState<{ loaded: boolean; effective: PricingTermsVersion | null; any: boolean }>({ loaded: false, effective: null, any: false });
  const pollTimer = useRef<number | null>(null);

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
      setRows([...list].sort((a, b) => Number(b.outstanding) - Number(a.outstanding) || Number(b.unbilled) - Number(a.unbilled)));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load platform fees');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStatements = useCallback(async (p: string) => {
    if (!/^\d{4}-\d{2}$/.test(p)) return;
    setStatementsLoading(true);
    try {
      setStatements(await listStatements(p));
    } catch (e) {
      setError(toUserMessage(e, 'Could not load statements'));
    } finally {
      setStatementsLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    try { setRuns(await listStatementRuns()); } catch (e) { setError(toUserMessage(e, 'Could not load the run log')); }
  }, []);

  /** Whether a default template is in effect — the thing every contractor without an override is priced by. */
  const loadTemplate = useCallback(async () => {
    try {
      const versions = await listPricingTerms();
      setTemplate({ loaded: true, effective: versions.find((v) => v.state === 'EFFECTIVE') ?? null, any: versions.length > 0 });
    } catch {
      setTemplate({ loaded: true, effective: null, any: false });
    }
  }, []);

  useEffect(() => { void load(); void loadRuns(); void loadTemplate(); }, [load, loadRuns, loadTemplate]);
  useEffect(() => { void loadStatements(period); }, [period, loadStatements]);
  useEffect(() => () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); }, []);

  const refreshAll = useCallback(async () => { await Promise.all([load(), loadStatements(period), loadRuns()]); }, [load, loadStatements, loadRuns, period]);

  /** The run executes in rental-service; poll until it settles (a few seconds), then show what it did. */
  function watch(runId: string, attempts = 0) {
    pollTimer.current = window.setTimeout(async () => {
      try {
        const r = await getStatementRun(runId);
        if (r.status === 'COMPLETED' || r.status === 'FAILED') {
          setReconciling(false);
          setNotice(r.status === 'FAILED'
            ? `${r.period}: run finished with ${r.failures.length} failure${r.failures.length === 1 ? '' : 's'} — see the run log. ${r.statementsCreated} created, ${r.statementsUpdated} updated.`
            : r.statementsCreated + r.statementsUpdated === 0
              ? `${r.period} (${periodOfRunMonth(r.period)}): nothing to bill — every fee before the cutoff is already on a statement.`
              : `${r.period} (${periodOfRunMonth(r.period)}): ${r.statementsCreated} statement${r.statementsCreated === 1 ? '' : 's'} created, ${r.statementsUpdated} updated, ${r.feesBilled} fee${r.feesBilled === 1 ? '' : 's'} billed, ${money(r.totalBilled)} in all${r.feesCarried > 0 ? `; ${r.feesCarried} carried to the next period` : ''}.`);
          await refreshAll();
          return;
        }
        if (attempts > 40) { setReconciling(false); setNotice(`${r.period}: the run is still going — check the run log in a moment.`); await refreshAll(); return; }
        watch(runId, attempts + 1);
      } catch (e) {
        setReconciling(false);
        setError(toUserMessage(e, 'Could not read the run'));
      }
    }, 2000);
  }

  async function reconcile() {
    if (!/^\d{4}-\d{2}$/.test(period)) { setError('Choose the run month.'); return; }
    if (!window.confirm(`Reconcile statements for ${period} (${periodOfRunMonth(period)})? Every unbilled fee before the cutoff goes onto one statement per contractor, due the 1st. Running it again only completes what a previous run missed.`)) return;
    setReconciling(true);
    setError(null);
    setNotice(null);
    try {
      const r = await reconcileStatements(period);
      setNotice(`${r.period}: run queued, waiting for the result…`);
      setTab('statements');
      watch(r.runId);
    } catch (e) {
      setReconciling(false);
      setError(toUserMessage(e, 'Could not start the run'));
    }
  }

  const open = (r: ContractorFeeOverview) => navigate(`/platform-fees/${r.contractorId}`);

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status" data-testid="reconcile-notice">{notice}</div>}

      {template.loaded && !template.effective && (
        <div className="detail-card" data-testid="template-missing" style={{ borderLeft: '4px solid var(--amber)' }}>
          <div className="detail-head" style={{ marginBottom: 0 }}>
            <div style={{ minWidth: 0 }}>
              <h3>{template.any ? 'No pricing template in effect yet' : 'Set up the default pricing template'}</h3>
              <p className="muted" style={{ margin: '4px 0 0', maxWidth: '70ch', lineHeight: 1.5 }}>
                The template is the per-category pricing and Terms &amp; Conditions every contractor is charged under unless you set them an override. Until one is in effect, jobs are priced at the configuration default shown below and new contractors register without accepting any terms.
              </p>
            </div>
            <Link to="/pricing-terms" className="ghost primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} data-testid="template-setup-link">
              {template.any ? 'Manage the template' : 'Set up the default template'}
            </Link>
          </div>
        </div>
      )}
      {template.effective && (
        <div className="notice" role="status" data-testid="template-in-effect" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>
            Default pricing template <strong>v{template.effective.version}</strong> in effect since {day(template.effective.effectiveFrom)} · {template.effective.rows.filter((r) => !r.isDefault).length} category row{template.effective.rows.filter((r) => !r.isDefault).length === 1 ? '' : 's'} plus the default row · applies to every contractor without an override.
          </span>
          <Link to="/pricing-terms" className="ghost sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Manage the template</Link>
        </div>
      )}

      <div className="tile-grid">
        <div className="tile"><div><div className="tile-value">{loading ? '—' : money(totals.accrued)}</div><div className="tile-label">Fees this month, all contractors</div></div></div>
        <div className="tile"><div><div className="tile-value">{loading ? '—' : money(totals.unbilled)}</div><div className="tile-label">Accrued, not yet on a statement</div></div></div>
        <div className="tile"><div><div className="tile-value">{loading ? '—' : money(totals.outstanding)}</div><div className="tile-label">Issued and unpaid</div></div></div>
        <div className="tile">
          <div style={{ width: '100%' }}>
            <div className="tile-label" style={{ marginTop: 0, marginBottom: 8 }}>Statements run on the 20th for the 20th–19th period, due the 1st. Reconcile a period:</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Run month" className="mono" data-testid="reconcile-period" />
              <button className="ghost sm" onClick={() => void reconcile()} disabled={reconciling || loading} data-testid="reconcile-run">
                {reconciling ? 'Running…' : 'Reconcile statements'}
              </button>
            </div>
            <div className="muted" style={{ marginTop: 6, fontSize: 11.5 }}>{/^\d{4}-\d{2}$/.test(period) ? periodOfRunMonth(period) : ''}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }} role="tablist">
        {([['contractors', 'Contractors'], ['statements', 'Statements'], ['runs', 'Run log']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'ghost primary' : 'ghost'} onClick={() => setTab(key)} data-testid={`fees-tab-${key}`}>{label}</button>
        ))}
      </div>

      {tab === 'contractors' && (
        <>
          <form className="search-bar" onSubmit={(e) => e.preventDefault()}>
            <input type="search" value={search} maxLength={80} placeholder="Search contractors by company, contact or email" aria-label="Search contractors" onChange={(e) => setSearch(e.target.value)} />
          </form>

          <div className="table-wrap onboarding-desktop">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contractor</th>
                  <th>Pricing</th>
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
                      <span className={sourcePill(r.pricingSource)}>{sourceLabel(r.pricingSource)}{r.sheetVersion != null ? ` v${r.sheetVersion}` : ''}</span>
                      <div className="muted cell-mono" style={{ marginTop: 4 }}>{ruleLine(r.rule)}{r.termsVersion != null ? ` · accepted T&C v${r.termsVersion}` : ''}</div>
                    </td>
                    <td className="cell-mono">{r.jobsThisMonth}</td>
                    <td className="cell-mono">{money(r.accruedThisMonth)}</td>
                    <td className="cell-mono">{money(r.unbilled)}{r.unbilledJobs > 0 && <span className="muted"> · {r.unbilledJobs}</span>}</td>
                    <td className="cell-mono">
                      {Number(r.outstanding) > 0 ? <span className="pill pending">{money(r.outstanding)} · {r.openInvoices}</span> : <span className="muted">—</span>}
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
                    <span className="ob-card-cid">{sourceLabel(r.pricingSource)}{r.sheetVersion != null ? ` v${r.sheetVersion}` : ''}</span>
                  </div>
                  {Number(r.outstanding) > 0 ? <span className="pill pending">{money(r.outstanding)} due</span> : <span className="pill off">{money(r.unbilled)} unbilled</span>}
                </button>
                <div className="ob-card-body">
                  <div className="ob-card-row"><span className="ob-card-label">This month</span><span>{r.jobsThisMonth} jobs · {money(r.accruedThisMonth)}</span></div>
                  <div className="ob-card-row"><span className="ob-card-label">Lifetime</span><span>{money(r.lifetime)}</span></div>
                  <div className="ob-card-actions"><button className="ghost sm" onClick={() => open(r)}>View fees</button></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'statements' && (
        <div className="table-wrap">
          <table className="data-table" data-testid="statements-table">
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Statement</th>
                <th>Period</th>
                <th>Jobs</th>
                <th>Total</th>
                <th>Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {statementsLoading ? (
                <tr><td colSpan={8} className="table-loading">Loading…</td></tr>
              ) : statements.length === 0 ? (
                <tr><td colSpan={8} className="table-empty">No statements for {period} ({periodOfRunMonth(period)}) yet. Reconcile the period to issue them.</td></tr>
              ) : statements.map((s) => (
                <tr key={s.invoiceId} onClick={() => setOpenStatement(s.invoiceId)} style={{ cursor: 'pointer' }} data-testid="statement-row">
                  <td>
                    <div className="cell-strong">{s.companyName || '—'}</div>
                    <div className="muted cell-mono">{s.email || '—'}</div>
                  </td>
                  <td className="cell-mono">{s.invoiceNumber}</td>
                  <td className="cell-mono">{periodLabel(s.periodStart, s.periodEnd)}</td>
                  <td className="cell-mono">{s.jobCount}</td>
                  <td className="cell-mono cell-strong">{money(s.totalAmount)}</td>
                  <td className="cell-mono">{day(s.dueDate)}</td>
                  <td><span className={STMT_PILL[s.status]}>{s.status === 'ISSUED' ? 'Issued' : s.status === 'PAID' ? `Paid ${day(s.paidAt)}` : 'Void'}</span></td>
                  <td className="actions"><button className="ghost sm" onClick={(e) => { e.stopPropagation(); setOpenStatement(s.invoiceId); }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'runs' && (
        <div className="table-wrap">
          <table className="data-table" data-testid="runs-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Trigger</th>
                <th>Requested</th>
                <th>Finished</th>
                <th>Status</th>
                <th>Contractors</th>
                <th>Statements</th>
                <th>Fees billed</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">No runs yet.</td></tr>
              ) : runs.map((r) => (
                <tr key={r.runId}>
                  <td className="cell-mono cell-strong">{r.period} <span className="muted">{periodLabel(r.periodStart, r.periodEnd)}</span></td>
                  <td>{r.triggerType === 'SCHEDULED' ? 'Scheduled' : `Manual${r.requestedBy ? ` · ${r.requestedBy}` : ''}`}</td>
                  <td className="cell-mono">{day(r.requestedAt)}</td>
                  <td className="cell-mono">{r.finishedAt ? day(r.finishedAt) : '—'}</td>
                  <td>
                    <span className={RUN_PILL[r.status]}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span>
                    {r.failures.length > 0 && <div className="muted" style={{ marginTop: 4 }}>{r.failures.map((f) => f.message).join('; ')}</div>}
                  </td>
                  <td className="cell-mono">{r.contractorsSeen}</td>
                  <td className="cell-mono">{r.statementsCreated} new{r.statementsUpdated > 0 ? ` · ${r.statementsUpdated} updated` : ''}</td>
                  <td className="cell-mono">{r.feesBilled}{r.feesCarried > 0 ? <span className="muted"> · {r.feesCarried} carried</span> : null}</td>
                  <td className="cell-mono">{money(r.totalBilled)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openStatement && (
        <StatementSlideIn invoiceId={openStatement} onClose={() => setOpenStatement(null)} onChanged={() => void refreshAll()} />
      )}
    </div>
  );
}
