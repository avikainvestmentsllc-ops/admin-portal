import { useEffect, useState } from 'react';
import { getAccountFeatures, updateAccountFeatures, type AccountFeatures } from '../api/client';
import { toUserMessage } from '../api/errorMessages';
import { useToast } from './AppShell';

type Key = 'esignEnabled' | 'rentCollectionEnabled';

const ITEMS: { key: Key; label: string; hint: string }[] = [
  {
    key: 'esignEnabled',
    label: 'Online lease signing',
    hint: 'Word lease templates sent to tenants to sign online. Off hides it for the landlord and their tenants.',
  },
  {
    key: 'rentCollectionEnabled',
    label: 'Stripe rent collection',
    hint: 'Tenants pay rent and fees online through Stripe. Also needs a Premium or Enterprise package. Off hides payment setup and online payments.',
  },
];

/**
 * The landlord account's feature switches. Each change is saved at once (not with "Save Changes"),
 * and rental-service applies it on the next request.
 */
export default function AccountFeaturesSection({ accountId }: { accountId: string }) {
  const toast = useToast();
  const [features, setFeatures] = useState<AccountFeatures | null>(null);
  const [busy, setBusy] = useState<Key | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAccountFeatures(accountId)
      .then((f) => { if (active) setFeatures(f); })
      .catch((e) => { if (active) setError(toUserMessage(e, 'Could not load features')); });
    return () => { active = false; };
  }, [accountId]);

  async function toggle(key: Key, value: boolean) {
    setBusy(key);
    setError(null);
    try {
      const next = await updateAccountFeatures(accountId, { [key]: value });
      setFeatures(next);
      const label = ITEMS.find((i) => i.key === key)?.label ?? 'Feature';
      toast(`${label} turned ${value ? 'on' : 'off'}.`);
    } catch (e) {
      setError(toUserMessage(e, 'Could not change the feature'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <fieldset data-testid="account-features">
      <legend>Features</legend>
      {error && <span className="field-error" role="alert" style={{ gridColumn: '1 / -1' }}>{error}</span>}
      {!features && !error && <p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>Loading…</p>}
      {features && ITEMS.map((item) => (
        <label key={item.key} className="checkbox" data-testid={`feature-${item.key}`}>
          <input type="checkbox" checked={features[item.key]} disabled={busy !== null}
            onChange={(e) => void toggle(item.key, e.target.checked)} />
          <span>
            {item.label}{busy === item.key ? ' — saving…' : ''}
            <span className="field-hint" style={{ display: 'block', textTransform: 'none', letterSpacing: 0 }}>{item.hint}</span>
          </span>
        </label>
      ))}
      {features && (
        <div style={{ gridColumn: '1 / -1' }} data-testid="account-plan-features">
          <span className="muted" style={{ font: '600 10px var(--mono)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Included in their plan</span>
          {features.planFeatures?.length ? (
            <ul className="addon-list" style={{ marginTop: 6 }}>{features.planFeatures.map((f) => <li key={f}>{f}</li>)}</ul>
          ) : <p className="muted" style={{ margin: '6px 0 0' }}>Core features only.</p>}
        </div>
      )}
    </fieldset>
  );
}
