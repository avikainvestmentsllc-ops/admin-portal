import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiRequestError, deletePricingTerms, listPricingTerms, pricingTermsFileUrl } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { PricingTermsVersion } from '../api/types';
import PdfPreview from '../components/PdfPreview';
import { usePageHeader, useToast } from '../components/AppShell';
import { DEFAULT_ROW_LABEL, rowLine, sortRows } from '../utils/pricing';
import PricingSheetSlideIn, { day } from './PricingSheetSlideIn';

const STATE_PILL: Record<PricingTermsVersion['state'], string> = { EFFECTIVE: 'pill on', SCHEDULED: 'pill pending', SUPERSEDED: 'pill off' };
const STATE_LABEL: Record<PricingTermsVersion['state'], string> = { EFFECTIVE: 'Effective', SCHEDULED: 'Scheduled', SUPERSEDED: 'Superseded' };

/**
 * The master pricing sheet and its Terms & Conditions, version by version. A new version has an
 * effective date: contractors who sign up from that date are shown it and must accept it. Only a
 * version still ahead of its date can be edited or deleted.
 */
export default function PricingTermsPage() {
  const toast = useToast();
  const [versions, setVersions] = useState<PricingTermsVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PricingTermsVersion | null | 'new'>(null);
  const [preview, setPreview] = useState<PricingTermsVersion | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const effective = useMemo(() => versions.find((v) => v.state === 'EFFECTIVE') ?? null, [versions]);

  usePageHeader({
    title: 'Pricing Template',
    subtitle: effective
      ? `Default template v${effective.version} in effect since ${day(effective.effectiveFrom)} · applies to every contractor without an override · ${effective.acceptances} acceptance${effective.acceptances === 1 ? '' : 's'}`
      : 'The default per-category pricing and Terms & Conditions for every contractor — new contractors accept it at sign-up',
    cta: { label: effective || versions.length > 0 ? '+ New version' : '+ Set up the default template', onClick: () => setEditing('new') },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVersions(await listPricingTerms());
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load pricing terms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function remove(v: PricingTermsVersion) {
    if (!window.confirm(`Delete scheduled version v${v.version}? Nobody has accepted it yet.`)) return;
    setBusy(v.sheetId);
    try {
      await deletePricingTerms(v.sheetId);
      toast(`Version v${v.version} deleted.`);
      await load();
    } catch (e) {
      setError(toUserMessage(e, 'Could not delete the version'));
    } finally {
      setBusy(null);
    }
  }

  const toggle = (id: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const loadPdf = useCallback(() => pricingTermsFileUrl(preview!.sheetId), [preview]);

  return (
    <div className="content">
      {error && <div className="error" role="alert">{error}</div>}

      {!loading && versions.length === 0 && (
        <div className="detail-card" data-testid="pricing-terms-empty">
          <div className="detail-head" style={{ marginBottom: 0 }}>
            <div style={{ minWidth: 0 }}>
              <h3>No default pricing template yet</h3>
              <p className="muted" style={{ margin: '4px 0 0', maxWidth: '70ch', lineHeight: 1.5 }}>
                The template is the pricing every contractor is charged under unless you set them an override: one row per service category (base fee, percentage above a threshold, optional maximum) plus the Terms &amp; Conditions PDF. Until a version is in effect, jobs are priced at the configuration default and new contractors register without accepting any terms.
              </p>
            </div>
            <button type="button" className="ghost primary" onClick={() => setEditing('new')} data-testid="pricing-terms-setup">Set up the default template</button>
          </div>
        </div>
      )}

      {!loading && versions.length > 0 && !effective && (
        <div className="notice" role="status">
          A version is scheduled but none is in effect yet — jobs stay on the configuration default until its effective date.
        </div>
      )}

      <div className="table-wrap onboarding-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Title</th>
              <th>Effective</th>
              <th>Status</th>
              <th>Categories</th>
              <th>Accepted by</th>
              <th>PDF</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-loading">Loading…</td></tr>
            ) : versions.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">No versions yet.</td></tr>
            ) : versions.map((v) => {
              const isOpen = open.has(v.sheetId);
              return [
                <tr key={v.sheetId} data-testid="pricing-terms-row" onClick={() => toggle(v.sheetId)} style={{ cursor: 'pointer' }} aria-expanded={isOpen}>
                  <td className="cell-strong cell-mono">{isOpen ? '▾' : '▸'} v{v.version}</td>
                  <td>
                    <div className="cell-strong">{v.title || '—'}</div>
                    {v.note && <div className="muted">{v.note}</div>}
                  </td>
                  <td className="cell-mono">{day(v.effectiveFrom)}</td>
                  <td><span className={STATE_PILL[v.state]}>{STATE_LABEL[v.state]}</span></td>
                  <td className="cell-mono">{v.rows.filter((r) => !r.isDefault).length} + default</td>
                  <td className="cell-mono">{v.acceptances}</td>
                  <td><button type="button" className="ghost sm" onClick={(e) => { e.stopPropagation(); setPreview(v); }}>View PDF</button></td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    {v.state === 'SCHEDULED' ? (
                      <>
                        <button className="ghost sm" onClick={() => setEditing(v)}>Edit</button>
                        <button className="ghost sm" disabled={busy === v.sheetId} onClick={() => void remove(v)}>Delete</button>
                      </>
                    ) : <span className="muted">Locked</span>}
                  </td>
                </tr>,
                ...(isOpen ? sortRows(v.rows).map((r) => (
                  <tr key={`${v.sheetId}-${r.rowId ?? r.categoryId ?? 'default'}`} style={{ background: 'var(--row)' }}>
                    <td />
                    <td colSpan={3} style={{ paddingLeft: 32 }} className={r.isDefault ? 'cell-strong' : undefined}>{r.isDefault ? DEFAULT_ROW_LABEL : r.categoryName ?? 'Category'}</td>
                    <td colSpan={4} className="cell-mono">{rowLine(r)}</td>
                  </tr>
                )) : []),
              ];
            })}
          </tbody>
        </table>
      </div>

      <div className="onboarding-cards">
        {!loading && versions.map((v) => (
          <div className="ob-card" key={v.sheetId}>
            <button type="button" className="ob-card-head" onClick={() => toggle(v.sheetId)}>
              <div className="ob-card-main">
                <span className="ob-card-name">v{v.version} · {v.title || 'Pricing terms'}</span>
                <span className="ob-card-cid">Effective {day(v.effectiveFrom)}</span>
              </div>
              <span className={STATE_PILL[v.state]}>{STATE_LABEL[v.state]}</span>
            </button>
            <div className="ob-card-body">
              {sortRows(v.rows).map((r) => (
                <div className="ob-card-row" key={r.rowId ?? r.categoryId ?? 'default'}><span className="ob-card-label">{r.isDefault ? DEFAULT_ROW_LABEL : r.categoryName}</span><span className="cell-mono">{rowLine(r)}</span></div>
              ))}
              <div className="ob-card-actions">
                <button className="ghost sm" onClick={() => setPreview(v)}>View PDF</button>
                {v.state === 'SCHEDULED' && <button className="ghost sm" onClick={() => setEditing(v)}>Edit</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <PricingSheetSlideIn
          mode="template"
          version={editing === 'new' ? null : editing}
          initialRows={editing === 'new' ? (versions[0]?.rows ?? []) : editing.rows}
          onClose={() => setEditing(null)}
          onSaved={(v) => { toast(`Pricing terms v${v.version} ${editing === 'new' ? 'published' : 'saved'} — effective ${day(v.effectiveFrom)}.`); void load(); }}
        />
      )}

      {preview && (
        <PdfPreview title={`Pricing terms v${preview.version} — ${preview.title || 'Terms & Conditions'}`} load={loadPdf} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
