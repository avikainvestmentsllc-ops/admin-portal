import { useCallback, useEffect, useState } from 'react';
import { getStatement, markStatementPaid, voidStatement } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { PlatformStatementDetail } from '../api/types';
import { money } from '../components/AppLayout';
import { periodLabel } from '../utils/pricing';
import { day } from './PricingSheetSlideIn';

interface Props {
  invoiceId: string;
  onClose: () => void;
  /** Fired after a mark-paid or void so the page behind reloads. */
  onChanged: () => void;
}

const STATUS_PILL: Record<string, string> = { ISSUED: 'pill pending', PAID: 'pill on', VOID: 'pill off' };

/** One statement: who owes it, the period, every fee line, and the two things an administrator does — mark paid, or void. */
export default function StatementSlideIn({ invoiceId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<PlatformStatementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [voidNote, setVoidNote] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await getStatement(invoiceId));
    } catch (e) {
      setError(toUserMessage(e, 'Could not load the statement'));
    }
  }, [invoiceId]);

  useEffect(() => { void load(); }, [load]);

  async function paid() {
    setBusy(true);
    setError(null);
    try {
      await markStatementPaid(invoiceId, note.trim() || null);
      onChanged();
      await load();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function doVoid() {
    if (!voidNote.trim()) { setError('Say why the statement is voided.'); return; }
    if (!window.confirm('Void this statement? Its fees go back to unbilled and land on the next statement.')) return;
    setBusy(true);
    setError(null);
    try {
      await voidStatement(invoiceId, voidNote.trim());
      onChanged();
      setVoiding(false);
      await load();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const s = detail?.statement;
  return (
    <div className="slide-overlay">
      <aside className="slide-panel" style={{ width: 'min(760px, 96vw)' }} data-testid="statement-slide">
        <div className="slide-head">
          <div>
            <h3>{s ? s.invoiceNumber : 'Statement'}</h3>
            {s && <span className="slide-sub">{s.companyName || '—'}{s.email ? ` · ${s.email}` : ''} · {periodLabel(s.periodStart, s.periodEnd)}</span>}
          </div>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="slide-body">
          {error && <div className="error" role="alert">{error}</div>}
          {!detail && !error && <p className="muted">Loading…</p>}
          {s && (
            <>
              <fieldset>
                <legend>Statement</legend>
                <div className="detail-grid" style={{ gridColumn: '1 / -1', borderTop: 'none', paddingTop: 0 }}>
                  <div><span className="detail-label">Status</span><span className={STATUS_PILL[s.status] ?? 'pill off'}>{s.status === 'ISSUED' ? `Due ${day(s.dueDate)}` : s.status === 'PAID' ? `Paid ${day(s.paidAt)}` : `Void ${day(s.voidedAt)}`}</span></div>
                  <div><span className="detail-label">Period</span>{periodLabel(s.periodStart, s.periodEnd)}</div>
                  <div><span className="detail-label">Issued</span>{day(s.issuedAt)}</div>
                  <div><span className="detail-label">Jobs</span>{s.jobCount}</div>
                  <div><span className="detail-label">Total</span>{money(s.totalAmount)}</div>
                  <div><span className="detail-label">Emailed</span>{s.notifiedAt ? day(s.notifiedAt) : 'Not yet'}</div>
                  {s.paidNote && <div className="detail-wide"><span className="detail-label">Payment reference</span>{s.paidNote}</div>}
                  {s.voidNote && <div className="detail-wide"><span className="detail-label">Void reason</span>{s.voidNote}</div>}
                </div>
              </fieldset>

              <fieldset>
                <legend>Fee lines</legend>
                <div style={{ gridColumn: '1 / -1', overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Date</th><th>Job</th><th>Category</th><th>Job amount</th><th>Fee</th></tr>
                    </thead>
                    <tbody>
                      {detail!.lines.length === 0 ? (
                        <tr><td colSpan={5} className="table-empty">{s.status === 'VOID' ? 'Voided — its fees moved to the next statement.' : 'No lines.'}</td></tr>
                      ) : detail!.lines.map((l) => (
                        <tr key={l.feeId}>
                          <td className="cell-mono">{day(l.assessedAt)}</td>
                          <td className="cell-strong">{l.title}</td>
                          <td>{l.categoryName ?? '—'}</td>
                          <td className="cell-mono">{money(l.jobAmount)}</td>
                          <td className="cell-mono">{money(l.totalFee)}{l.capped ? <span className="muted"> · capped</span> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </fieldset>

              {s.status === 'ISSUED' && !voiding && (
                <fieldset>
                  <legend>Settle</legend>
                  <label>Payment reference (optional)
                    <input value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="Check number, transfer id…" data-testid="statement-paid-note" />
                  </label>
                </fieldset>
              )}
              {s.status === 'ISSUED' && voiding && (
                <fieldset>
                  <legend>Void</legend>
                  <label>Reason
                    <input value={voidNote} maxLength={255} onChange={(e) => setVoidNote(e.target.value)} placeholder="Why this statement is withdrawn" data-testid="statement-void-note" />
                  </label>
                  <p className="muted" style={{ margin: 0 }}>The fees on it return to unbilled and are picked up by the next statement run.</p>
                </fieldset>
              )}
            </>
          )}
        </div>
        {s && s.status === 'ISSUED' && (
          <div className="slide-actions" style={{ padding: '12px 22px' }}>
            {voiding ? (
              <>
                <button type="button" className="ghost" onClick={() => setVoiding(false)} disabled={busy}>Back</button>
                <button type="button" className="ghost" style={{ color: 'var(--red)' }} onClick={() => void doVoid()} disabled={busy} data-testid="statement-void">{busy ? 'Voiding…' : 'Void statement'}</button>
              </>
            ) : (
              <>
                <button type="button" className="ghost" onClick={() => setVoiding(true)} disabled={busy}>Void…</button>
                <button type="submit" onClick={() => void paid()} disabled={busy} data-testid="statement-mark-paid">{busy ? 'Saving…' : `Mark paid · ${money(s.totalAmount)}`}</button>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
