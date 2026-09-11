import { useState, type FormEvent } from 'react';
import { setContractorFeeRule } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import type { ContractorFeeDetail, FeePolicyRequest } from '../api/types';
import { money } from '../components/AppLayout';
import { day } from './ContractorFeesPage';
import { ruleLine } from './PlatformFeesPage';

interface Props {
  contractorId: string;
  name: string;
  detail: ContractorFeeDetail;
  onClose: () => void;
  onSaved: (detail: ContractorFeeDetail) => void;
}

/**
 * A contractor's fee rule. Saving writes a new version effective now: jobs invoiced from then on
 * are priced under it, and every job already priced keeps the version it was priced under.
 */
export default function FeeRuleSlideIn({ contractorId, name, detail, onClose, onSaved }: Props) {
  const [baseFee, setBaseFee] = useState(String(detail.rule.baseFee ?? ''));
  const [pctThreshold, setPctThreshold] = useState(String(detail.rule.pctThreshold ?? ''));
  const [pctRate, setPctRate] = useState(String(detail.rule.pctRate ?? ''));
  const [maxFee, setMaxFee] = useState(detail.rule.maxFee != null ? String(detail.rule.maxFee) : '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = {
    baseFee: baseFee === '' || Number(baseFee) < 0 ? 'Enter the base fee (0 or more)' : '',
    pctThreshold: pctThreshold === '' || Number(pctThreshold) < 0 ? 'Enter the threshold (0 or more)' : '',
    pctRate: pctRate === '' || Number(pctRate) < 0 || Number(pctRate) > 100 ? 'Enter a percentage from 0 to 100' : '',
    maxFee: maxFee !== '' && Number(maxFee) > 0 && Number(maxFee) < Number(baseFee) ? 'The maximum must be at least the base fee' : '',
  };
  const hasErrors = Object.values(errors).some(Boolean);

  // What a few typical jobs would cost under the rule as typed — the quickest check that the
  // numbers mean what the administrator thinks they mean.
  const preview = [150, 350, 1000, 5000].map((amount) => {
    const base = Number(baseFee) || 0;
    const over = amount - (Number(pctThreshold) || 0);
    let fee = base + (over > 0 ? (over * (Number(pctRate) || 0)) / 100 : 0);
    const max = Number(maxFee) || 0;
    if (max > 0 && fee > max) fee = max;
    return { amount, fee };
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (hasErrors) return;
    setSaving(true);
    try {
      const body: FeePolicyRequest = {
        baseFee: Number(baseFee),
        pctThreshold: Number(pctThreshold),
        pctRate: Number(pctRate),
        maxFee: maxFee === '' || Number(maxFee) <= 0 ? null : Number(maxFee),
        note: note.trim() || null,
      };
      const d = await setContractorFeeRule(contractorId, body);
      onSaved(d);
      onClose();
    } catch (err) {
      setSubmitError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="slide-overlay">
      <aside className="slide-panel">
        <div className="slide-head">
          <h3>Fee rule — {name}</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="slide-body" onSubmit={submit} noValidate>
          {submitError && <div className="error" role="alert">{submitError}</div>}

          <fieldset>
            <legend>Current rule</legend>
            <p className="cell-mono" style={{ margin: '0 0 4px' }}>{ruleLine(detail.rule)}</p>
            <p className="muted" style={{ margin: 0 }}>
              {detail.rule.platformDefault ? 'Platform default' : `v${detail.rule.version} since ${day(detail.rule.effectiveFrom)}`}
            </p>
          </fieldset>

          <fieldset>
            <legend>New rule — applies to jobs invoiced from now on</legend>
            <label>Base fee per job ($)
              <input type="number" min="0" step="0.01" value={baseFee} onChange={(e) => setBaseFee(e.target.value)} />
              {errors.baseFee && <span className="field-error">{errors.baseFee}</span>}
            </label>
            <label>Percentage applies to the part above ($)
              <input type="number" min="0" step="0.01" value={pctThreshold} onChange={(e) => setPctThreshold(e.target.value)} />
              {errors.pctThreshold && <span className="field-error">{errors.pctThreshold}</span>}
            </label>
            <label>Percentage (%)
              <input type="number" min="0" max="100" step="0.01" value={pctRate} onChange={(e) => setPctRate(e.target.value)} />
              {errors.pctRate && <span className="field-error">{errors.pctRate}</span>}
            </label>
            <label>Maximum fee per job ($) — blank for no maximum
              <input type="number" min="0" step="0.01" value={maxFee} onChange={(e) => setMaxFee(e.target.value)} />
              {errors.maxFee && <span className="field-error">{errors.maxFee}</span>}
            </label>
            <label>Note (optional)
              <input value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="Why this rule — kept on the version history" />
            </label>
          </fieldset>

          <fieldset>
            <legend>What it comes to</legend>
            {preview.map((p) => (
              <div className="ob-card-row" key={p.amount}>
                <span className="ob-card-label">A {money(p.amount)} job</span>
                <span className="cell-mono">{money(p.fee)}</span>
              </div>
            ))}
          </fieldset>

          {detail.history.length > 0 && (
            <fieldset>
              <legend>Version history</legend>
              {detail.history.map((h) => (
                <div className="ob-card-row" key={h.policyId ?? h.version}>
                  <span className="ob-card-label">v{h.version} · {day(h.effectiveFrom)}</span>
                  <span className="cell-mono">{ruleLine(h)}{h.note ? <span className="muted"> · {h.note}</span> : null}</span>
                </div>
              ))}
            </fieldset>
          )}

          <div className="slide-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving || hasErrors}>{saving ? 'Saving…' : 'Apply to future jobs'}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}
