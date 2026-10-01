import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiRequestError, getContractorFees, pricingTermsFileUrl, waivePlatformFee } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { ContractorFeeDetail, PlatformFeeRow, PlatformInvoiceRow } from '../api/types';
import { money } from '../components/AppLayout';
import { usePageHeader, useToast } from '../components/AppShell';
import PdfPreview from '../components/PdfPreview';
import { DEFAULT_ROW_LABEL, periodLabel, periodOf, sortRows, sourceLabel, sourcePill } from '../utils/pricing';
import PricingSheetSlideIn, { day } from './PricingSheetSlideIn';
import StatementSlideIn from './StatementSlideIn';

export { day };

/** Fees are grouped into calendar months in the ledger's zone, the same one the server bills in. */
const ZONE = 'America/New_York';

/** "2026-09" for an instant, in the ledger's zone. */
function monthKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit' }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '00';
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const FEE_PILL: Record<string, string> = { ACCRUED: 'pill pending', INVOICED: 'pill info', WAIVED: 'pill off' };

interface MonthGroup {
  key: string;
  fees: PlatformFeeRow[];
  jobs: number;
  jobAmount: number;
  base: number;
  pct: number;
  total: number;
  unbilled: number;
  waived: number;
  /** Statements whose period ends in this month (the 20th–19th period is named for the month it ends in). */
  invoices: PlatformInvoiceRow[];
}

function groupByMonth(detail: ContractorFeeDetail): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  const at = (key: string) => {
    let g = groups.get(key);
    if (!g) {
      g = { key, fees: [], jobs: 0, jobAmount: 0, base: 0, pct: 0, total: 0, unbilled: 0, waived: 0, invoices: [] };
      groups.set(key, g);
    }
    return g;
  };
  for (const f of detail.fees) {
    const g = at(monthKey(f.assessedAt));
    g.fees.push(f);
    if (f.status === 'WAIVED') { g.waived += Number(f.totalFee); continue; }
    g.jobs += 1;
    g.jobAmount += Number(f.jobAmount);
    g.base += Number(f.baseFee);
    g.pct += Number(f.pctFee);
    g.total += Number(f.totalFee);
    if (f.status === 'ACCRUED') g.unbilled += Number(f.totalFee);
  }
  for (const i of detail.invoices) at(periodOf(i.periodEnd)).invoices.push(i);
  return [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

function statementCell(g: MonthGroup, onOpen: (i: PlatformInvoiceRow) => void) {
  if (g.invoices.length === 0) {
    return g.unbilled > 0
      ? <span className="muted">Not issued yet</span>
      : g.jobs > 0 ? <span className="muted">On another statement</span> : <span className="muted">—</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {g.invoices.map((i) => (
        <div key={i.invoiceId} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="ghost sm" onClick={(e) => { e.stopPropagation(); onOpen(i); }}>{i.invoiceNumber}</button>
          <span className="muted">{periodLabel(i.periodStart, i.periodEnd)}</span>
          <span className={i.status === 'PAID' ? 'pill on' : i.status === 'ISSUED' ? 'pill pending' : 'pill off'}>
            {i.status === 'ISSUED' ? `Due ${day(i.dueDate)}` : i.status === 'PAID' ? `Paid ${day(i.paidAt)}` : 'Void'}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * One contractor's platform fees, month by month: what was invoiced, what the platform charged
 * on it, and the statement each fee went out on. A month opens to show every job under it.
 */
export default function ContractorFeesPage() {
  const { contractorId } = useParams<{ contractorId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [detail, setDetail] = useState<ContractorFeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [editingPricing, setEditingPricing] = useState(false);
  const [openStatement, setOpenStatement] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  const name = detail?.companyName || 'Contractor';
  usePageHeader({
    title: 'Platform Fees',
    subtitle: detail ? `${name}${detail.email ? ` · ${detail.email}` : ''}` : 'Fees by month for this contractor',
    backLabel: 'Back to Platform Fees',
    onBack: () => navigate('/platform-fees'),
    cta: detail ? { label: 'Override pricing', onClick: () => setEditingPricing(true) } : undefined,
  });

  const load = useCallback(async () => {
    if (!contractorId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await getContractorFees(contractorId);
      setDetail(d);
      setOpenMonths((prev) => {
        if (prev.size > 0) return prev;
        const first = d.fees[0] ? monthKey(d.fees[0].assessedAt) : null;
        return first ? new Set([first]) : prev;
      });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load platform fees');
    } finally {
      setLoading(false);
    }
  }, [contractorId]);

  useEffect(() => { void load(); }, [load]);

  const months = useMemo(() => (detail ? groupByMonth(detail) : []), [detail]);
  const termsSheetId = detail?.termsAccepted?.sheetId ?? null;
  const loadTerms = useCallback(() => pricingTermsFileUrl(termsSheetId as string), [termsSheetId]);

  function toggle(key: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function waive(f: PlatformFeeRow) {
    if (!window.confirm(`Waive the ${money(f.totalFee)} fee on "${f.title}"? It will not be billed.`)) return;
    setBusy(f.feeId);
    try {
      await waivePlatformFee(f.feeId);
      toast('Fee waived.');
      await load();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}

      {loading && !detail ? (
        <p className="muted">Loading…</p>
      ) : detail && (
        <>
          <div className="tile-grid">
            <div className="tile"><div><div className="tile-value">{money(detail.accruedThisMonth)}</div><div className="tile-label">This month · {detail.jobsThisMonth} job{detail.jobsThisMonth === 1 ? '' : 's'}</div></div></div>
            <div className="tile"><div><div className="tile-value">{money(detail.unbilled)}</div><div className="tile-label">Unbilled · {detail.unbilledJobs} job{detail.unbilledJobs === 1 ? '' : 's'}</div></div></div>
            <div className="tile"><div><div className="tile-value">{money(detail.outstanding)}</div><div className="tile-label">Outstanding · {detail.openInvoices} statement{detail.openInvoices === 1 ? '' : 's'}</div></div></div>
            <div className="tile"><div><div className="tile-value">{money(detail.lifetime)}</div><div className="tile-label">Lifetime fees</div></div></div>
          </div>

          <div className="detail-card" data-testid="contractor-pricing-card">
            <div className="detail-head">
              <div style={{ minWidth: 0 }}>
                <h3>Pricing</h3>
                <div className="detail-cid">
                  {sourceLabel(detail.pricing.source)}
                  {detail.pricing.version != null ? ` · v${detail.pricing.version}` : ''}
                  {detail.pricing.effectiveFrom ? ` · since ${day(detail.pricing.effectiveFrom)}` : ''}
                  {detail.pricing.createdBy ? ` · set by ${detail.pricing.createdBy}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span className={sourcePill(detail.pricing.source)}>{sourceLabel(detail.pricing.source)}</span>
                <button className="ghost primary" onClick={() => setEditingPricing(true)}>Override pricing</button>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
              <table className="data-table" data-testid="contractor-pricing-rows">
                <thead><tr><th>Category</th><th>Base</th><th>Percentage</th><th>Max per job</th></tr></thead>
                <tbody>
                  {sortRows(detail.pricing.rows).map((r) => (
                    <tr key={r.rowId ?? r.categoryId ?? 'default'}>
                      <td className={r.isDefault ? 'cell-strong' : undefined}>{r.isDefault ? DEFAULT_ROW_LABEL : r.categoryName ?? 'Category'}</td>
                      <td className="cell-mono">{money(r.baseFee)}</td>
                      <td className="cell-mono">{Number(r.pctRate) > 0 ? `${Number(r.pctRate)}% above ${money(r.pctThreshold)}` : 'None'}</td>
                      <td className="cell-mono">{r.maxFee != null && Number(r.maxFee) > 0 ? money(r.maxFee) : 'No maximum'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="detail-grid" style={{ marginTop: 14 }}>
              <div>
                <span className="detail-label">Terms accepted</span>
                {detail.termsAccepted
                  ? <>v{detail.termsAccepted.version ?? '?'} on {day(detail.termsAccepted.acceptedAt)} <button type="button" className="ghost sm" style={{ marginLeft: 8 }} onClick={() => setShowTerms(true)}>View PDF</button></>
                  : <span className="muted">None on file — registered before pricing terms existed</span>}
              </div>
              <div><span className="detail-label">Overrides</span>{detail.overrideHistory.length === 0 ? 'None — priced from the template' : `${detail.overrideHistory.length} version${detail.overrideHistory.length === 1 ? '' : 's'} · earlier jobs keep the sheet they were priced under`}</div>
              {detail.pricing.note && <div><span className="detail-label">Note</span>{detail.pricing.note}</div>}
            </div>
          </div>

          <div className="section-title">Fees by month</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Jobs</th>
                  <th>Invoiced by contractor</th>
                  <th>Base fees</th>
                  <th>Percentage fees</th>
                  <th>Platform fee</th>
                  <th>Statement</th>
                </tr>
              </thead>
              <tbody>
                {months.length === 0 ? (
                  <tr><td colSpan={7} className="table-empty">No fees yet — a fee is assessed each time this contractor invoices a job.</td></tr>
                ) : months.map((g) => {
                  const isOpen = openMonths.has(g.key);
                  return [
                    <tr key={g.key} onClick={() => toggle(g.key)} style={{ cursor: 'pointer' }} aria-expanded={isOpen}>
                      <td className="cell-strong">{isOpen ? '▾' : '▸'} {monthLabel(g.key)}</td>
                      <td className="cell-mono">{g.jobs}{g.waived > 0 && <span className="muted"> · {money(g.waived)} waived</span>}</td>
                      <td className="cell-mono">{money(g.jobAmount)}</td>
                      <td className="cell-mono">{money(g.base)}</td>
                      <td className="cell-mono">{money(g.pct)}</td>
                      <td className="cell-mono cell-strong">{money(g.total)}{g.unbilled > 0 && g.unbilled !== g.total && <span className="muted"> · {money(g.unbilled)} unbilled</span>}</td>
                      <td onClick={(e) => e.stopPropagation()}>{statementCell(g, (i) => setOpenStatement(i.invoiceId))}</td>
                    </tr>,
                    ...(isOpen ? g.fees.map((f) => (
                      <tr key={f.feeId} style={{ background: 'var(--row)' }}>
                        <td colSpan={2} style={{ paddingLeft: 32 }}>
                          <div className="cell-strong">{f.title}</div>
                          <div className="muted">
                            {day(f.assessedAt)} · {f.categoryName ?? 'No category'}
                            {f.sheetVersion != null ? ` · ${sourceLabel(f.pricingSource)} v${f.sheetVersion}` : ' · platform default'}{f.capped ? ' · capped' : ''}
                          </div>
                        </td>
                        <td className="cell-mono">{money(f.jobAmount)}</td>
                        <td className="cell-mono">{money(f.baseFee)}</td>
                        <td className="cell-mono">{money(f.pctFee)}</td>
                        <td className="cell-mono">{money(f.totalFee)}</td>
                        <td>
                          <span className={FEE_PILL[f.status] ?? 'pill off'}>{f.status === 'ACCRUED' ? 'Unbilled' : f.status === 'INVOICED' ? (f.invoiceNumber ?? 'Billed') : 'Waived'}</span>
                          {f.status === 'ACCRUED' && (
                            <button type="button" className="ghost sm" style={{ marginLeft: 8 }} disabled={busy === f.feeId} onClick={() => void waive(f)}>Waive</button>
                          )}
                        </td>
                      </tr>
                    )) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editingPricing && detail && (
        <PricingSheetSlideIn
          mode="override"
          contractorId={detail.contractorId}
          name={name}
          detail={detail}
          onClose={() => setEditingPricing(false)}
          onSaved={(d) => { setDetail(d); toast(`Override v${d.pricing.version} applies to jobs invoiced from now on.`); }}
        />
      )}

      {openStatement && (
        <StatementSlideIn invoiceId={openStatement} onClose={() => setOpenStatement(null)} onChanged={() => void load()} />
      )}

      {showTerms && termsSheetId && (
        <PdfPreview title={`Pricing terms accepted by ${name}`} load={loadTerms} onClose={() => setShowTerms(false)} />
      )}
    </div>
  );
}
