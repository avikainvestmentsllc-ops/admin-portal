import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createLandlordTerms, deleteLandlordTerms, listLandlordTerms, loadLandlordTermsFile, type LandlordTermsVersion,
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

/** Upload a new version: the PDF, its effective date and an optional title. */
function NewVersionSlideIn({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState(todayEt());
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<{ file?: string; date?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: { file?: string; date?: string } = {};
    if (!file) next.file = 'Choose the agreement PDF.';
    else if (!/\.pdf$/i.test(file.name)) next.file = 'The agreement must be a PDF.';
    else if (file.size > 10 * 1024 * 1024) next.file = 'The PDF is larger than 10 MB.';
    if (!date || date < todayEt()) next.date = 'Choose today or a later date.';
    setErrors(next);
    if (Object.keys(next).length || !file) return;
    setSaving(true); setError(null);
    try {
      await createLandlordTerms(file, date, title);
      onCreated();
    } catch (err) {
      setError(toUserMessage(err, 'Could not upload the agreement'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="slide-overlay">
      <aside className="slide-panel">
        <div className="slide-head">
          <h3>New landlord agreement version</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="slide-body" onSubmit={submit} noValidate>
          {error && <div className="error" role="alert">{error}</div>}
          <fieldset>
            <legend>Agreement</legend>
            <label>Agreement PDF
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" className="ghost sm" onClick={() => input.current?.click()} data-testid="landlord-terms-pick">
                  {file ? 'Replace file' : 'Choose PDF'}
                </button>
                <span className="muted">{file?.name ?? 'Up to 10 MB'}</span>
              </span>
              <input ref={input} type="file" accept="application/pdf,.pdf" hidden data-testid="landlord-terms-file"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErrors((x) => ({ ...x, file: undefined })); }} />
            </label>
            {errors.file && <p className="field-error">{errors.file}</p>}
            <label>Effective date
              <input type="date" min={todayEt()} value={date} aria-invalid={!!errors.date} data-testid="landlord-terms-date"
                onChange={(e) => { setDate(e.target.value); setErrors((x) => ({ ...x, date: undefined })); }} />
            </label>
            {errors.date && <p className="field-error">{errors.date}</p>}
            <label>Title (optional)
              <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 2027 update" />
            </label>
            <p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>
              New landlords accept the version in force on the day they sign up. Today's date publishes it at once.
            </p>
          </fieldset>
          <div className="slide-actions">
            <button type="button" className="ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving} data-testid="landlord-terms-save">{saving ? 'Uploading…' : 'Upload version'}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}

/** Landlord Agreement: the PDF landlords read and accept to create an account, versioned. */
export default function LandlordTermsPage() {
  const [rows, setRows] = useState<LandlordTermsVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<LandlordTermsVersion | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setRows(await listLandlordTerms());
    } catch (e) {
      setError(toUserMessage(e, 'Failed to load the landlord agreement'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  usePageHeader({
    title: 'Landlord Agreement',
    subtitle: 'The agreement landlords accept when they create an account',
    cta: { label: '+ New version', onClick: () => setAdding(true) },
  });

  const loadPreview = useCallback(() => loadLandlordTermsFile(preview?.termsId ?? ''), [preview]);

  async function remove(v: LandlordTermsVersion) {
    if (!window.confirm(`Remove version ${v.version}?`)) return;
    try {
      await deleteLandlordTerms(v.termsId);
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
        <div className="error" role="alert" data-testid="landlord-terms-missing">
          No landlord agreement is in force, so landlords sign up without accepting one. Upload one with today's date to require it.
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Version</th><th>Title</th><th>Effective</th><th>Status</th><th>Accepted by</th><th>Uploaded</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-loading">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">No versions yet.</td></tr>
            ) : rows.map((v) => (
              <tr key={v.termsId} data-testid="landlord-terms-row">
                <td className="cell-strong">v{v.version}</td>
                <td>{v.title ?? '—'}</td>
                <td>{day(v.effectiveFrom)}</td>
                <td><span className={`pill ${STATE_PILL[v.state]}`}>{STATE_LABEL[v.state]}</span></td>
                <td className="cell-mono">{v.acceptedCount} landlord{v.acceptedCount === 1 ? '' : 's'}</td>
                <td>{day(v.createdAt)}{v.createdBy ? ` · ${v.createdBy}` : ''}</td>
                <td className="actions">
                  <button className="ghost sm" onClick={() => setPreview(v)}>View</button>{' '}
                  {v.acceptedCount === 0 && v.state !== 'SUPERSEDED' && (
                    <button className="ghost sm" onClick={() => void remove(v)}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <NewVersionSlideIn onClose={() => setAdding(false)} onCreated={() => { setAdding(false); void load(); }} />}
      {preview && <PdfPreview title={`Landlord agreement v${preview.version}`} load={loadPreview} onClose={() => setPreview(null)} />}
    </div>
  );
}
