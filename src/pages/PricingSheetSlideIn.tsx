import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPricingTerms, listPricingCategories, setContractorPricing, updatePricingTerms } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { CategoryOption, ContractorFeeDetail, PricingRow, PricingSheetRequest, PricingTermsVersion } from '../api/types';
import { money } from '../components/AppLayout';
import { DEFAULT_ROW_LABEL, feeFor, rowLine, sortRows, sourceLabel } from '../utils/pricing';

/** Today's date as yyyy-MM-dd in the viewer's local timezone. */
function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** An effective-from instant as the Eastern calendar day it names, for <input type="date">. */
function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** A calendar date as-is; an instant on the day it falls in Eastern, the zone the server bills and publishes in. */
export function day(iso: string | null | undefined): string {
  if (!iso) return '—';
  const calendar = iso.length === 10;
  const d = new Date(calendar ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(calendar ? {} : { timeZone: 'America/New_York' }) });
}

/** One editable line. `categoryId` null is the pinned default row. */
interface Line {
  key: string;
  categoryId: string | null;
  baseFee: string;
  pctThreshold: string;
  pctRate: string;
  maxFee: string;
}

function linesFrom(rows: PricingRow[]): Line[] {
  const out = sortRows(rows).map((r, i) => ({
    key: `${r.categoryId ?? 'default'}-${i}`,
    categoryId: r.isDefault ? null : r.categoryId,
    baseFee: String(r.baseFee ?? ''),
    pctThreshold: String(r.pctThreshold ?? ''),
    pctRate: String(r.pctRate ?? ''),
    maxFee: r.maxFee != null && Number(r.maxFee) > 0 ? String(r.maxFee) : '',
  }));
  if (!out.some((l) => l.categoryId === null)) out.push({ key: 'default-new', categoryId: null, baseFee: '20', pctThreshold: '200', pctRate: '5', maxFee: '100' });
  return out;
}

function lineErrors(l: Line) {
  return {
    baseFee: l.baseFee === '' || Number(l.baseFee) < 0 ? 'Base fee: 0 or more' : '',
    pctThreshold: l.pctThreshold === '' || Number(l.pctThreshold) < 0 ? 'Threshold: 0 or more' : '',
    pctRate: l.pctRate === '' || Number(l.pctRate) < 0 || Number(l.pctRate) > 100 ? 'Percentage: 0 to 100' : '',
    maxFee: l.maxFee !== '' && Number(l.maxFee) > 0 && Number(l.maxFee) < Number(l.baseFee) ? 'Maximum must be at least the base fee' : '',
  };
}

type Props =
  | {
      mode: 'template';
      /** The version being edited (SCHEDULED only), or null to publish a new one. */
      version: PricingTermsVersion | null;
      /** Rows to start from when publishing a new version — the latest version's. */
      initialRows: PricingRow[];
      onClose: () => void;
      onSaved: (v: PricingTermsVersion) => void;
    }
  | {
      mode: 'override';
      contractorId: string;
      name: string;
      detail: ContractorFeeDetail;
      onClose: () => void;
      onSaved: (d: ContractorFeeDetail) => void;
    };

/**
 * A pricing sheet, line by line: one row per service category plus the pinned "all other
 * categories" row. In template mode it is the platform's master sheet — a version with an
 * effective date and the Terms & Conditions PDF new contractors accept. In override mode it is
 * one contractor's sheet, effective now; jobs already priced keep the sheet they were priced under.
 */
export default function PricingSheetSlideIn(props: Props) {
  const template = props.mode === 'template';
  const editing = template ? props.version : null;
  const startRows = template ? (editing ? editing.rows : props.initialRows) : props.detail.pricing.rows;

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [lines, setLines] = useState<Line[]>(() => linesFrom(startRows));
  const [title, setTitle] = useState(editing?.title ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(editing ? isoToDateInput(editing.effectiveFrom) : todayInput());
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [addCategory, setAddCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    listPricingCategories().then(setCategories).catch((e) => setSubmitError(toUserMessage(e, 'Could not load categories')));
  }, []);

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.categoryId, c.name])), [categories]);
  const used = new Set(lines.map((l) => l.categoryId).filter(Boolean) as string[]);
  const available = categories.filter((c) => !used.has(c.categoryId));

  const errors = lines.map(lineErrors);
  const fileError = template && !editing && !file ? 'Upload the Terms & Conditions PDF' : file && file.type && file.type !== 'application/pdf' ? 'The terms must be a PDF' : file && file.size > 10 * 1024 * 1024 ? 'The PDF must be 10 MB or smaller' : '';
  const titleError = template && !title.trim() ? 'Give the version a title' : '';
  const dateError = template && (!effectiveFrom || effectiveFrom < todayInput()) ? 'Effective date must be today or later' : '';
  const hasErrors = errors.some((e) => Object.values(e).some(Boolean)) || Boolean(fileError) || Boolean(titleError) || Boolean(dateError);

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function add() {
    if (!addCategory) return;
    const dflt = lines.find((l) => l.categoryId === null);
    setLines((prev) => [...prev.filter((l) => l.categoryId !== null), {
      key: `${addCategory}-${Date.now()}`, categoryId: addCategory,
      baseFee: dflt?.baseFee ?? '20', pctThreshold: dflt?.pctThreshold ?? '200', pctRate: dflt?.pctRate ?? '5', maxFee: dflt?.maxFee ?? '',
    }, ...(dflt ? [dflt] : [])]);
    setAddCategory('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (hasErrors) return;
    setSaving(true);
    const body: PricingSheetRequest = {
      effectiveFrom: template ? effectiveFrom : null,
      title: template ? title.trim() : null,
      note: note.trim() || null,
      rows: lines.map((l) => ({
        categoryId: l.categoryId,
        baseFee: Number(l.baseFee),
        pctThreshold: Number(l.pctThreshold),
        pctRate: Number(l.pctRate),
        maxFee: l.maxFee === '' || Number(l.maxFee) <= 0 ? null : Number(l.maxFee),
      })),
    };
    try {
      if (props.mode === 'template') {
        const v = editing ? await updatePricingTerms(editing.sheetId, body, file) : await createPricingTerms(body, file as File);
        props.onSaved(v);
      } else {
        props.onSaved(await setContractorPricing(props.contractorId, body));
      }
      props.onClose();
    } catch (err) {
      setSubmitError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const heading = template
    ? editing ? `Pricing template v${editing.version} (scheduled)` : 'New pricing template version'
    : `Override pricing — ${props.name}`;

  return (
    <div className="slide-overlay">
      <aside className="slide-panel" style={{ width: 'min(760px, 96vw)' }}>
        <div className="slide-head">
          <h3>{heading}</h3>
          <button className="ghost" onClick={props.onClose} aria-label="Close">✕</button>
        </div>
        <form className="slide-body" onSubmit={submit} noValidate data-testid="pricing-sheet-form">
          {submitError && <div className="error" role="alert">{submitError}</div>}

          {template ? (
            <fieldset>
              <legend>Version</legend>
              <div className="row-2">
                <label>Title
                  <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Contractor pricing terms 2027" data-testid="terms-title" />
                  {titleError && <span className="field-error">{titleError}</span>}
                </label>
                <label>Effective from
                  <input type="date" min={todayInput()} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} data-testid="terms-effective" />
                  {dateError && <span className="field-error">{dateError}</span>}
                </label>
              </div>
              <label>Terms &amp; Conditions PDF{editing ? ' — leave empty to keep the current file' : ''}
                <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="terms-pdf-input" />
                {file && <span className="muted">{file.name} · {(file.size / 1024).toFixed(0)} KB</span>}
                {fileError && <span className="field-error">{fileError}</span>}
              </label>
              <p className="muted" style={{ margin: 0 }}>
                This is the default pricing for every contractor without an override. Contractors who sign up on or after the effective date are shown this version and must accept it; jobs invoiced from that date are priced under it. A version already in effect cannot be changed — publish a new one.
              </p>
            </fieldset>
          ) : (
            <fieldset>
              <legend>Current pricing</legend>
              <p className="muted" style={{ margin: 0 }}>
                {sourceLabel(props.detail.pricing.source)}{props.detail.pricing.version != null ? ` · v${props.detail.pricing.version}` : ''}
                {props.detail.pricing.effectiveFrom ? ` since ${day(props.detail.pricing.effectiveFrom)}` : ''}
                {props.detail.termsAccepted ? ` · accepted terms v${props.detail.termsAccepted.version ?? '?'} on ${day(props.detail.termsAccepted.acceptedAt)}` : ' · no terms on file'}
              </p>
            </fieldset>
          )}

          <fieldset>
            <legend>{template ? 'Pricing by service category' : 'New pricing — applies to jobs invoiced from now on'}</legend>
            <div style={{ gridColumn: '1 / -1', overflowX: 'auto' }}>
              <table className="data-table" data-testid="pricing-rows">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Base ($)</th>
                    <th>% applies above ($)</th>
                    <th>Percentage</th>
                    <th>Max ($)</th>
                    <th>$1,000 job</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const err = errors[i];
                    const isDefault = l.categoryId === null;
                    return (
                      <tr key={l.key} data-testid={isDefault ? 'pricing-row-default' : 'pricing-row'}>
                        <td className={isDefault ? 'cell-strong' : undefined}>{isDefault ? DEFAULT_ROW_LABEL : categoryName.get(l.categoryId!) ?? 'Category'}</td>
                        <td><input type="number" min="0" step="0.01" value={l.baseFee} aria-invalid={Boolean(err.baseFee)} aria-label="Base fee" onChange={(e) => update(l.key, { baseFee: e.target.value })} style={{ width: 90 }} /></td>
                        <td><input type="number" min="0" step="0.01" value={l.pctThreshold} aria-invalid={Boolean(err.pctThreshold)} aria-label="Percentage threshold" onChange={(e) => update(l.key, { pctThreshold: e.target.value })} style={{ width: 100 }} /></td>
                        <td><input type="number" min="0" max="100" step="0.01" value={l.pctRate} aria-invalid={Boolean(err.pctRate)} aria-label="Percentage" onChange={(e) => update(l.key, { pctRate: e.target.value })} style={{ width: 80 }} /></td>
                        <td><input type="number" min="0" step="0.01" value={l.maxFee} aria-invalid={Boolean(err.maxFee)} aria-label="Maximum fee" placeholder="none" onChange={(e) => update(l.key, { maxFee: e.target.value })} style={{ width: 90 }} /></td>
                        <td className="cell-mono">{money(feeFor({ baseFee: l.baseFee, pctThreshold: l.pctThreshold, pctRate: l.pctRate, maxFee: l.maxFee || null }, 1000))}</td>
                        <td className="actions">
                          {!isDefault && <button type="button" className="ghost sm" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} aria-label="Remove row">Remove</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {errors.some((e) => Object.values(e).some(Boolean)) && (
                <span className="field-error">{errors.flatMap((e) => Object.values(e)).filter(Boolean)[0]}</span>
              )}
            </div>
            <div className="row-2">
              <label>Add a category
                <select value={addCategory} onChange={(e) => setAddCategory(e.target.value)} data-testid="pricing-add-category">
                  <option value="">{available.length === 0 ? 'Every category is priced' : 'Choose a category…'}</option>
                  {available.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.name}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="button" className="ghost" onClick={add} disabled={!addCategory}>Add row</button>
              </div>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              A job pays its category's row; a job in a category with no row pays the “{DEFAULT_ROW_LABEL}” row. Each row: base fee on every job, plus the percentage on the part of the job above the threshold, never more than the maximum.
            </p>
            <label>Note (optional)
              <input value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="Why this version — kept on the history" />
            </label>
          </fieldset>

          <fieldset>
            <legend>What it comes to</legend>
            <div style={{ gridColumn: '1 / -1' }}>
              {lines.map((l) => (
                <div className="ob-card-row" key={l.key}>
                  <span className="ob-card-label" style={{ minWidth: '11rem' }}>{l.categoryId === null ? DEFAULT_ROW_LABEL : categoryName.get(l.categoryId) ?? 'Category'}</span>
                  <span className="cell-mono">{[150, 350, 1000, 5000].map((a) => `${money(a)} → ${money(feeFor({ baseFee: l.baseFee, pctThreshold: l.pctThreshold, pctRate: l.pctRate, maxFee: l.maxFee || null }, a))}`).join(' · ')}</span>
                </div>
              ))}
            </div>
          </fieldset>

          {props.mode === 'override' && props.detail.overrideHistory.length > 0 && (
            <fieldset>
              <legend>Override history</legend>
              <div style={{ gridColumn: '1 / -1' }}>
                {props.detail.overrideHistory.map((h) => (
                  <div className="ob-card-row" key={h.sheetId ?? String(h.version)}>
                    <span className="ob-card-label" style={{ minWidth: '9rem' }}>v{h.version} · {day(h.effectiveFrom)}</span>
                    <span className="cell-mono">{sortRows(h.rows).map((r) => `${r.isDefault ? DEFAULT_ROW_LABEL : r.categoryName ?? 'Category'}: ${rowLine(r)}`).join(' · ')}{h.note ? <span className="muted"> · {h.note}</span> : null}</span>
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          <div className="slide-actions">
            <button type="button" className="ghost" onClick={props.onClose}>Cancel</button>
            <button type="submit" disabled={saving || hasErrors} data-testid="pricing-sheet-save">
              {saving ? 'Saving…' : template ? (editing ? 'Save version' : 'Publish version') : 'Apply to future jobs'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
