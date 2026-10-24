import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { decideRefundRequest, listRefundRequests, ApiRequestError, type RefundRequestView } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import { money } from '../components/AppLayout';
import { usePageHeader } from '../components/AppShell';

const REASON_LABEL: Record<string, string> = {
  WORK_NOT_DONE: 'Work not done',
  POOR_QUALITY: 'Poor quality',
  OVERCHARGED: 'Overcharged',
  DUPLICATE: 'Duplicate payment',
  OTHER: 'Other',
};

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'To review',
  APPROVED: 'Approved',
  PROCESSING: 'Refunding',
  REFUNDED: 'Refunded',
  DECLINED: 'Declined',
  FAILED: 'Failed',
};

const STATUS_PILL: Record<string, string> = {
  REQUESTED: 'pending',
  APPROVED: 'info',
  PROCESSING: 'info',
  REFUNDED: 'on',
  DECLINED: 'off',
  FAILED: 'danger',
};

const FILTERS: { value: string; label: string }[] = [
  { value: 'REQUESTED', label: 'To review' },
  { value: '', label: 'All' },
  { value: 'PROCESSING', label: 'Refunding' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'FAILED', label: 'Failed' },
];

function age(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`;
}

function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-US') : '—';
}

function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${STATUS_PILL[status] ?? 'off'}`}>{STATUS_LABEL[status] ?? status}</span>;
}

/** The request in full, with Approve / Decline while it is still waiting on the admin. */
function RefundRequestSlideIn({ request, onClose, onDecided }: {
  request: RefundRequestView;
  onClose: () => void;
  onDecided: (r: RefundRequestView) => void;
}) {
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<'approve' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const open = request.status === 'REQUESTED';
  const contractorKeeps = request.amount != null && request.platformFee != null && request.processingFee != null
    ? request.amount - request.platformFee - request.processingFee : null;

  async function decide(choice: 'approve' | 'decline') {
    setDecision(choice);
    if (choice === 'decline' && !note.trim()) { setError('Add a note: the landlord sees why it was declined.'); return; }
    setSaving(true); setError(null);
    try {
      onDecided(await decideRefundRequest(request.requestId, choice, note));
    } catch (err) {
      setError(toUserMessage(err, 'Could not save the decision'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="slide-overlay">
      <aside className="slide-panel">
        <div className="slide-head">
          <h3>Refund request</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="slide-body" onSubmit={(e: FormEvent) => { e.preventDefault(); void decide('approve'); }} noValidate>
          {error && <div className="error" role="alert">{error}</div>}

          <fieldset>
            <legend>Request</legend>
            <dl className="kv">
              <dt>Status</dt><dd><StatusPill status={request.status} /></dd>
              <dt>Landlord</dt><dd>{request.landlordName ?? '—'}</dd>
              <dt>Contractor</dt><dd>{request.contractorName ?? '—'}</dd>
              <dt>Job</dt><dd>{request.jobTitle ?? '—'}</dd>
              <dt>Reason</dt><dd>{REASON_LABEL[request.reason] ?? request.reason}</dd>
              <dt>Landlord's note</dt><dd>{request.note ?? '—'}</dd>
              <dt>Requested</dt><dd>{date(request.createdAt)} ({age(request.createdAt)})</dd>
            </dl>
          </fieldset>

          <fieldset>
            <legend>Payment</legend>
            <dl className="kv">
              <dt>Paid</dt><dd className="cell-mono">{money(request.amount)} by {request.method === 'card' ? 'card' : 'bank'} on {date(request.paidAt)}</dd>
              <dt>Platform fee</dt><dd className="cell-mono">{money(request.platformFee)}</dd>
              <dt>Processing</dt><dd className="cell-mono">{money(request.processingFee)}</dd>
              <dt>Contractor received</dt><dd className="cell-mono">{money(contractorKeeps)}</dd>
              <dt>Payment status</dt><dd>{request.paymentStatus ?? '—'}</dd>
              <dt>Stripe intent</dt><dd className="cell-mono">{request.paymentIntentId ?? '—'}</dd>
            </dl>
          </fieldset>

          {!open && (request.adminNote || request.decidedBy || request.failure) && (
            <fieldset>
              <legend>Decision</legend>
              <dl className="kv">
                <dt>By</dt><dd>{request.decidedBy ?? '—'} · {date(request.decidedAt)}</dd>
                <dt>Note</dt><dd>{request.adminNote ?? '—'}</dd>
                {request.failure && (<><dt>Refund failed</dt><dd className="field-error">{request.failure}</dd></>)}
              </dl>
            </fieldset>
          )}

          {open && (
            <fieldset>
              <legend>Decide</legend>
              <p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>
                Approving refunds the landlord {money(request.amount)} in full: the contractor's {money(contractorKeeps)} is
                taken back from their Stripe balance and the platform fee is returned. The job goes back to invoiced.
              </p>
              <label>Note {decision === 'decline' ? '(required — the landlord sees it)' : '(optional)'}
                <textarea rows={3} maxLength={1000} value={note} data-testid="refund-admin-note"
                  aria-invalid={!!error && decision === 'decline' && !note.trim()}
                  onChange={(e) => { setNote(e.target.value); setError(null); }} />
              </label>
            </fieldset>
          )}

          {open && (
            <div className="slide-actions">
              <button type="button" className="ghost" disabled={saving} data-testid="refund-decline"
                onClick={() => void decide('decline')}>
                {saving && decision === 'decline' ? 'Declining…' : 'Decline'}
              </button>
              <button type="submit" disabled={saving} data-testid="refund-approve">
                {saving && decision === 'approve' ? 'Approving…' : `Approve refund of ${money(request.amount)}`}
              </button>
            </div>
          )}
        </form>
      </aside>
    </div>
  );
}

/** Refund Requests: landlords asking for an in-app contractor payment back. */
export default function RefundRequestsPage() {
  const [status, setStatus] = useState('REQUESTED');
  const [rows, setRows] = useState<RefundRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RefundRequestView | null>(null);

  usePageHeader({
    title: 'Refund Requests',
    subtitle: 'Landlords asking for an in-app contractor payment back',
  });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setRows(await listRefundRequests(status || undefined));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load refund requests');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const onDecided = (r: RefundRequestView) => { setSelected(r); void load(); };

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}

      <div className="toolbar">
        <label>Status{' '}
          <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="refund-status-filter">
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
      </div>

      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Landlord</th>
              <th>Contractor</th>
              <th>Job</th>
              <th>Paid</th>
              <th>Platform fee</th>
              <th>Reason</th>
              <th>Age</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="table-loading">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="table-empty">No refund requests here.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.requestId}>
                <td className="cell-strong">{r.landlordName ?? '—'}</td>
                <td>{r.contractorName ?? '—'}</td>
                <td>{r.jobTitle ?? '—'}</td>
                <td className="cell-mono">{money(r.amount)}</td>
                <td className="cell-mono">{money(r.platformFee)}</td>
                <td title={r.note ?? undefined}>{REASON_LABEL[r.reason] ?? r.reason}</td>
                <td>{age(r.createdAt)}</td>
                <td><StatusPill status={r.status} /></td>
                <td className="actions">
                  <button className="ghost sm" onClick={() => setSelected(r)}>{r.status === 'REQUESTED' ? 'Review' : 'View'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {!loading && rows.map((r) => (
          <button key={r.requestId} type="button" className="ob-card ob-card-head" onClick={() => setSelected(r)}>
            <div className="ob-card-main">
              <span className="ob-card-name">{r.landlordName ?? '—'} → {r.contractorName ?? '—'}</span>
              <span className="ob-card-cid">{money(r.amount)} · {REASON_LABEL[r.reason] ?? r.reason} · {age(r.createdAt)}</span>
            </div>
            <StatusPill status={r.status} />
          </button>
        ))}
      </div>

      {selected && <RefundRequestSlideIn request={selected} onClose={() => setSelected(null)} onDecided={onDecided} />}
    </div>
  );
}
