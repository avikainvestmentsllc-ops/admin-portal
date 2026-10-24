import { useCallback, useEffect, useState } from 'react';
import {
  decideAgent, getAgent, listAgents, loadAgentDocument, revealAgentTaxId, ApiRequestError,
  type AgentDetail, type AgentRow,
} from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import { usePageHeader } from '../components/AppShell';
import PdfPreview from '../components/PdfPreview';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'To verify', ACTIVE: 'Active', REJECTED: 'Rejected', SUSPENDED: 'Suspended',
};
const STATUS_PILL: Record<string, string> = {
  PENDING: 'pending', ACTIVE: 'on', REJECTED: 'off', SUSPENDED: 'danger',
};
const FILTERS = [
  { value: 'PENDING', label: 'To verify' },
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
];

function day(iso: string | null): string {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('en-US');
}

function phone(p: string): string {
  return /^\d{10}$/.test(p) ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p;
}

function expired(iso: string | null): boolean {
  return !!iso && new Date(`${iso}T23:59:59`) < new Date();
}

function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${STATUS_PILL[status] ?? 'off'}`}>{STATUS_LABEL[status] ?? status}</span>;
}

/** One agent's sign-up in full: identity, licenses, insurance, tax ID (last 4, reveal on click), files, decision. */
function AgentSlideIn({ agentId, onClose, onChanged }: { agentId: string; onClose: () => void; onChanged: () => void }) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taxId, setTaxId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ key: string; label: string } | null>(null);
  const [mode, setMode] = useState<'reject' | 'suspend' | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAgent(agentId).then(setAgent).catch((e) => setError(toUserMessage(e, 'Could not load the agent')));
  }, [agentId]);

  const loadDoc = useCallback(() => loadAgentDocument(agentId, preview?.key ?? ''), [agentId, preview]);

  async function act(action: 'activate' | 'reject' | 'suspend') {
    if (action !== 'activate') {
      if (mode !== action) { setMode(action); setReason(''); setReasonError(null); return; }
      if (!reason.trim()) { setReasonError('Enter the reason — it is emailed to the agent.'); return; }
    }
    setSaving(true); setError(null);
    try {
      setAgent(await decideAgent(agentId, action, reason.trim()));
      setMode(null);
      onChanged();
    } catch (e) {
      setError(toUserMessage(e, 'Could not save the change'));
    } finally {
      setSaving(false);
    }
  }

  async function reveal() {
    try {
      const t = await revealAgentTaxId(agentId);
      setTaxId(t.value);
    } catch (e) {
      setError(toUserMessage(e, 'Could not reveal the tax ID'));
    }
  }

  const a = agent;
  return (
    <div className="slide-overlay">
      <aside className="slide-panel">
        <div className="slide-head">
          <h3>{a ? [a.firstName, a.middleName, a.lastName].filter(Boolean).join(' ') : 'Real estate agent'}</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="slide-body">
          {error && <div className="error" role="alert">{error}</div>}
          {!a ? <p className="muted">Loading…</p> : (
            <>
              <fieldset>
                <legend>Agent</legend>
                <dl className="kv">
                  <dt>Status</dt><dd><StatusPill status={a.status} /></dd>
                  <dt>Email</dt><dd>{a.email}</dd>
                  <dt>Phone</dt><dd className="cell-mono">{phone(a.phone)}</dd>
                  <dt>Date of birth</dt><dd>{day(a.dateOfBirth)}</dd>
                  <dt>Address</dt><dd>{a.formattedAddress ?? '—'}</dd>
                  <dt>Driver license</dt><dd className="cell-mono">{a.dlNumber} · {a.dlState}</dd>
                  <dt>Signed up</dt><dd>{day(a.createdAt)}</dd>
                </dl>
              </fieldset>

              <fieldset>
                <legend>Business &amp; tax</legend>
                <dl className="kv">
                  <dt>Company</dt><dd>{a.companyName ?? 'None — individual'}</dd>
                  <dt>{a.taxIdType}</dt>
                  <dd className="cell-mono">
                    {taxId ?? `•••${a.taxIdType === 'EIN' ? '-•••' : '-••-'}${a.taxIdLast4}`}{' '}
                    {!taxId && <button type="button" className="ghost sm" onClick={() => void reveal()} data-testid="agent-reveal-tax">Reveal</button>}
                  </dd>
                </dl>
              </fieldset>

              <fieldset>
                <legend>Real estate licenses</legend>
                <table className="data-table">
                  <thead><tr><th>State</th><th>License #</th><th>Expires</th></tr></thead>
                  <tbody>
                    {a.licenses.map((l) => (
                      <tr key={l.state}>
                        <td className="cell-strong">{l.state}</td>
                        <td className="cell-mono">{l.licenseNumber}</td>
                        <td className={expired(l.expiresOn) ? 'field-error' : undefined}>{day(l.expiresOn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted" style={{ margin: 0 }}>Check each number with the state's real estate commission before activating.</p>
              </fieldset>

              <fieldset>
                <legend>Insurance</legend>
                <dl className="kv">
                  <dt>Carrier</dt><dd>{a.insuranceCarrier}</dd>
                  <dt>Policy</dt><dd className="cell-mono">{a.insurancePolicy}</dd>
                  <dt>Expires</dt><dd className={expired(a.insuranceExpiresOn) ? 'field-error' : undefined}>{day(a.insuranceExpiresOn)}</dd>
                </dl>
              </fieldset>

              <fieldset>
                <legend>Documents</legend>
                <ul className="doc-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                  {a.documents.map((d) => (
                    <li key={d.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span><strong>{d.label}</strong> <span className="muted">{d.fileName}</span></span>
                      <button type="button" className="ghost sm" onClick={() => setPreview({ key: d.key, label: d.label })}
                        data-testid={`agent-doc-${d.key}`}>View</button>
                    </li>
                  ))}
                </ul>
                <p className="muted" style={{ margin: 0 }}>
                  Terms {a.termsVersion} signed {day(a.termsAcceptedAt)}{a.termsIp ? ` from ${a.termsIp}` : ''}.
                </p>
              </fieldset>

              {(a.rejectionReason || a.verifiedBy) && (
                <fieldset>
                  <legend>Last decision</legend>
                  <dl className="kv">
                    <dt>By</dt><dd>{a.verifiedBy ?? '—'} · {day(a.verifiedAt)}</dd>
                    {a.rejectionReason && (<><dt>Reason</dt><dd>{a.rejectionReason}</dd></>)}
                  </dl>
                </fieldset>
              )}

              {mode && (
                <fieldset>
                  <legend>{mode === 'reject' ? 'Reject' : 'Suspend'}</legend>
                  <label>Reason (emailed to the agent)
                    <textarea rows={3} maxLength={500} value={reason} data-testid="agent-reason"
                      aria-invalid={!!reasonError}
                      onChange={(e) => { setReason(e.target.value); setReasonError(null); }} />
                  </label>
                  {reasonError && <p className="field-error">{reasonError}</p>}
                </fieldset>
              )}

              <div className="slide-actions">
                {a.status === 'PENDING' && (
                  <button type="button" className="ghost" disabled={saving} onClick={() => void act('reject')} data-testid="agent-reject">
                    {mode === 'reject' ? (saving ? 'Rejecting…' : 'Confirm reject') : 'Reject'}
                  </button>
                )}
                {a.status === 'ACTIVE' && (
                  <button type="button" className="ghost" disabled={saving} onClick={() => void act('suspend')} data-testid="agent-suspend">
                    {mode === 'suspend' ? (saving ? 'Suspending…' : 'Confirm suspend') : 'Suspend'}
                  </button>
                )}
                {mode && <button type="button" className="ghost" disabled={saving} onClick={() => setMode(null)}>Cancel</button>}
                {a.status !== 'ACTIVE' && !mode && (
                  <button type="button" className="ghost primary" disabled={saving} onClick={() => void act('activate')} data-testid="agent-activate">
                    {saving ? 'Saving…' : a.status === 'SUSPENDED' ? 'Reinstate' : 'Verify & activate'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
      {preview && <PdfPreview title={preview.label} load={loadDoc} onClose={() => setPreview(null)} />}
    </div>
  );
}

/** Real Estate Agents: self-registered agents waiting for verification, and the ones already verified. */
export default function AgentsPage() {
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  usePageHeader({
    title: 'Real Estate Agents',
    subtitle: 'Verify licenses, insurance and identity before an agent can sign in',
  });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setRows(await listAgents(status || undefined));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}

      <div className="toolbar">
        <label>Status{' '}
          <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="agent-status-filter">
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
      </div>

      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent</th><th>Company</th><th>Email</th><th>Phone</th><th>Licensed in</th>
              <th>Insurance</th><th>Signed up</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="table-loading">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="table-empty">No agents here.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.agentId} data-testid="agent-row">
                <td className="cell-strong">{r.name}</td>
                <td>{r.companyName ?? '—'}</td>
                <td>{r.email}</td>
                <td className="cell-mono">{phone(r.phone)}</td>
                <td>{r.licensedStates.join(', ')}</td>
                <td className={expired(r.insuranceExpiresOn) ? 'field-error' : undefined}>{day(r.insuranceExpiresOn)}</td>
                <td>{day(r.createdAt)}</td>
                <td><StatusPill status={r.status} /></td>
                <td className="actions">
                  <button className="ghost sm" onClick={() => setSelected(r.agentId)}>{r.status === 'PENDING' ? 'Review' : 'View'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {!loading && rows.map((r) => (
          <button key={r.agentId} type="button" className="ob-card ob-card-head" onClick={() => setSelected(r.agentId)}>
            <div className="ob-card-main">
              <span className="ob-card-name">{r.name}</span>
              <span className="ob-card-cid">{r.companyName ?? 'Individual'} · {r.licensedStates.join(', ')}</span>
            </div>
            <StatusPill status={r.status} />
          </button>
        ))}
      </div>

      {selected && <AgentSlideIn agentId={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />}
    </div>
  );
}
