import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createTermsOfService, deleteTermsOfService, listTermsOfService, loadTermsOfServiceFile, type TermsOfServiceVersion,
} from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import { usePageHeader } from '../components/AppShell';
import PdfPreview from '../components/PdfPreview';

const STATE_LABEL: Record<string, string> = { EFFECTIVE: 'In force', SCHEDULED: 'Scheduled', SUPERSEDED: 'Superseded' };
const STATE_PILL: Record<string, string> = { EFFECTIVE: 'on', SCHEDULED: 'info', SUPERSEDED: 'off' };

function todayEt(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US');
}

function emailLabel(v: TermsOfServiceVersion): string {
  if (v.emailStatus === 'PENDING') return 'Goes out at 2 AM ET';
  const parts = [`${v.emailsSent} sent`];
  if (v.emailsPending) parts.push(`${v.emailsPending} pending`);
  if (v.emailsFailed) parts.push(`${v.emailsFailed} failed`);
  return (v.emailStatus === 'DONE' ? 'Done · ' : 'Sending · ') + parts.join(', ');
}

/** Upload a new version: the PDF, its effective date, an optional title and "what changed" (shown in the email). */
function NewVersionSlideIn({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState(todayEt());
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [errors, setErrors] = useState<{ file?: string; date?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: { file?: string; date?: string } = {};
    if (!file) next.file = 'Choose the Terms of Service PDF.';
    else if (!/\.pdf$/i.test(file.name)) next.file = 'The Terms of Service must be a PDF.';
    else if (file.size > 10 * 1024 * 1024) next.file = 'The PDF is larger than 10 MB.';
    if (!date || date < todayEt()) next.date = 'Choose today or a later date.';
    setErrors(next);
    if (Object.keys(next).length || !file) return;
    if (!window.confirm('Publish this version? Every user will be emailed at 2 AM ET and asked to accept it at their next sign-in.')) return;
    setSaving(true); setError(null);
    try {
      await createTermsOfService(file, date, title, summary);
      onCreated();
    } catch (err) {
      setError(toUserMessage(err, 'Could not upload the Terms of Service'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="slide-overlay">
      <aside className="slide-panel">
        <div className="slide-head">
          <h3>New Terms of Service version</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="slide-body" onSubmit={submit} noValidate>
          {error && <div className="error" role="alert">{error}</div>}
          <fieldset>
            <legend>Terms of Service</legend>
            <label>Terms of Service PDF
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" className="ghost sm" onClick={() => input.current?.click()} data-testid="tos-pick">
                  {file ? 'Replace file' : 'Choose PDF'}
                </button>
                <span className="muted">{file?.name ?? 'Up to 10 MB'}</span>
              </span>
              <input ref={input} type="file" accept="application/pdf,.pdf" hidden data-testid="tos-file"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErrors((x) => ({ ...x, file: undefined })); }} />
            </label>
            {errors.file && <p className="field-error">{errors.file}</p>}
            <label>Effective date
              <input type="date" min={todayEt()} value={date} aria-invalid={!!errors.date} data-testid="tos-date"
                onChange={(e) => { setDate(e.target.value); setErrors((x) => ({ ...x, date: undefined })); }} />
            </label>
            {errors.date && <p className="field-error">{errors.date}</p>}
            <label>Title (optional)
              <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 2027 update" data-testid="tos-title" />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>What changed (optional — shown in the email and on the acceptance screen)
              <textarea rows={4} maxLength={4000} value={summary} onChange={(e) => setSummary(e.target.value)} data-testid="tos-summary"
                placeholder="e.g. We added a section on electronic signatures and updated how disputes are handled." />
            </label>
            <p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>
              Every user (landlords, managers, tenants, contractors, agents) must accept the version in force before they can
              continue after signing in. All of them are emailed about a new version at 2 AM Eastern. Today's date publishes it at once.
            </p>
          </fieldset>
          <div className="slide-actions">
            <button type="button" className="ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving} data-testid="tos-save">{saving ? 'Uploading…' : 'Publish version'}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}

/** Terms of Service: the platform terms every user accepts at sign-in, versioned, with acceptance and email progress. */
export default function TermsOfServicePage() {
  const [rows, setRows] = useState<TermsOfServiceVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<TermsOfServiceVersion | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setRows(await listTermsOfService());
    } catch (e) {
      setError(toUserMessage(e, 'Failed to load the Terms of Service'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  usePageHeader({
    title: 'Terms of Service',
    subtitle: 'The terms every user accepts when they sign in',
    cta: { label: '+ New version', onClick: () => setAdding(true) },
  });

  const loadPreview = useCallback(() => loadTermsOfServiceFile(preview?.tosId ?? ''), [preview]);

  async function remove(v: TermsOfServiceVersion) {
    if (!window.confirm(`Remove version ${v.version}?`)) return;
    try {
      await deleteTermsOfService(v.tosId);
      void load();
    } catch (e) {
      setError(toUserMessage(e, 'Could not remove the version'));
    }
  }

  const inForce = rows.find((r) => r.state === 'EFFECTIVE');

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}
      {!loading && !inForce && (
        <div className="error" role="alert" data-testid="tos-missing">
          No Terms of Service are in force, so users are not asked to accept any. Upload a version with today's date to require it.
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Version</th><th>Title</th><th>Effective</th><th>Status</th><th>Accepted</th><th>Email</th><th>Uploaded</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-loading">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">No versions yet.</td></tr>
            ) : rows.map((v) => (
              <tr key={v.tosId} data-testid="tos-row">
                <td className="cell-strong">v{v.version}</td>
                <td title={v.summary ?? undefined}>{v.title ?? '—'}</td>
                <td>{day(v.effectiveFrom)}</td>
                <td><span className={`pill ${STATE_PILL[v.state]}`}>{STATE_LABEL[v.state]}</span></td>
                <td className="cell-mono">{v.acceptedCount} of {v.activeUsers}</td>
                <td>{emailLabel(v)}</td>
                <td>{day(v.createdAt)}{v.createdBy ? ` · ${v.createdBy}` : ''}</td>
                <td className="actions">
                  <button className="ghost sm" onClick={() => setPreview(v)}>View</button>{' '}
                  {v.acceptedCount === 0 && v.emailStatus === 'PENDING' && v.state !== 'SUPERSEDED' && (
                    <button className="ghost sm" onClick={() => void remove(v)}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <NewVersionSlideIn onClose={() => setAdding(false)} onCreated={() => { setAdding(false); void load(); }} />}
      {preview && <PdfPreview title={`Terms of Service v${preview.version}`} load={loadPreview} onClose={() => setPreview(null)} />}
    </div>
  );
}
