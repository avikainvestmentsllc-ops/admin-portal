import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { compact, money } from '../components/AppLayout';
import { useAdminSummary, usePageHeader, useToast } from '../components/AppShell';
import { Icon, type IconName } from '../components/Icons';
import type { DashboardAttentionItem, DashboardSummary } from '../api/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_AREA = 174; // px — the bar area inside the 206px plot (16px padding top/bottom)

function monthLabel(yyyyMm: string): string {
  const m = Number(yyyyMm.slice(5, 7));
  return MONTHS[m - 1] ?? yyyyMm;
}

/** Axis ticks: a "nice" max above the tallest month, split in three. */
function axisFor(max: number): number[] {
  const nice = max <= 0 ? 1000 : Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil((max * 1.1) / nice) * nice || nice;
  return [top, (top * 2) / 3, top / 3, 0];
}

function attentionPill(item: DashboardAttentionItem): string {
  return item.tag === 'Expiring' || item.tag === 'Missing' ? 'pill pending' : 'pill off';
}

/** Dashboard (canvas isDash): four tiles, subscription revenue, package mix, needs attention. */
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { summary, summaryError } = useAdminSummary();

  usePageHeader({
    title: `Welcome, ${user?.firstname ?? 'Admin'}`,
    subtitle: 'Accounts, packages and subscription revenue across the platform',
  });

  const s: DashboardSummary | null = summary;
  const tiles: { label: string; value: string; icon: IconName; tone: 'navy' | 'green' | 'amber'; onClick: () => void }[] = [
    { label: 'Active landlords', value: s ? String(s.activeLandlords) : '—', icon: 'onboarding', tone: 'navy', onClick: () => navigate('/onboarding') },
    { label: 'Active packages · add-ons', value: s ? `${s.activePackages} · ${s.activeAddons}` : '—', icon: 'packages', tone: 'navy', onClick: () => navigate('/packages') },
    { label: 'Monthly recurring revenue', value: s ? compact(s.monthlyRecurringRevenue) : '—', icon: 'addons', tone: 'green', onClick: () => toast('Sums every active account’s current package and add-on prices.') },
    { label: 'Registered contractors', value: s ? String(s.registeredContractors) : '—', icon: 'contractors', tone: 'amber', onClick: () => navigate('/contractors') },
  ];

  const revenue = s?.revenue ?? [];
  const maxMonth = Math.max(0, ...revenue.map((m) => m.packages + m.addons));
  const axis = axisFor(maxMonth);
  const yMax = axis[0];
  const mix = s?.packageMix ?? [];
  const maxMix = Math.max(1, ...mix.map((m) => m.accounts));
  const attention = s?.attention ?? [];

  const openAttention = (item: DashboardAttentionItem) => {
    switch (item.kind) {
      case 'INACTIVE_LANDLORD': navigate(item.targetId ? `/onboarding/${item.targetId}` : '/onboarding'); break;
      case 'EXPIRING_ADDON': navigate('/addons'); break;
      case 'INACTIVE_CONTRACTOR': navigate('/contractors'); break;
      default: navigate('/mileage-rates');
    }
  };

  return (
    <div className="content">
      {summaryError && <div className="error" role="alert">{summaryError}</div>}

      <div className="tile-grid">
        {tiles.map((t) => (
          <button key={t.label} type="button" className="tile" onClick={t.onClick}>
            <span className={`tile-icon ${t.tone}`}><Icon name={t.icon} size={19} strokeWidth={1.7} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="tile-value">{t.value}</div>
              <div className="tile-label">{t.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="dash-grid">
        <div className="card" style={{ padding: 20 }}>
          <div className="card-head">
            <div>
              <div className="card-title">Subscription revenue</div>
              <div className="card-sub">Packages vs. add-ons billed, last 12 months</div>
            </div>
            <div className="legend">
              <div className="legend-item"><span className="legend-swatch" style={{ background: 'var(--blue)' }} /> Packages</div>
              <div className="legend-item"><span className="legend-swatch" style={{ background: 'var(--blue-pale)' }} /> Add-ons</div>
            </div>
          </div>
          <div className="chart">
            <div className="chart-axis">
              {axis.map((a, i) => <span key={i}>{compact(a)}</span>)}
            </div>
            <div className="chart-plot">
              <div className="chart-grid">{axis.map((_, i) => <div key={i} />)}</div>
              <div className="chart-bars">
                {revenue.map((m, i) => {
                  const current = i === revenue.length - 1;
                  const total = m.packages + m.addons;
                  return (
                    <div key={m.month} className={current ? 'chart-col current' : 'chart-col'} title={`${m.month}: ${money(total)}`}>
                      <div className="chart-label">{total > 0 ? compact(total) : ''}</div>
                      <div className="chart-stack">
                        <div className="chart-addons" style={{ height: Math.round((m.addons / yMax) * CHART_AREA) }} />
                        <div className="chart-packages" style={{ height: Math.round((m.packages / yMax) * CHART_AREA) }} />
                      </div>
                      <span className="chart-month">{monthLabel(m.month)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="dash-col">
          <div className="card-navy" style={{ padding: 20 }}>
            <span className="eyebrow" style={{ color: 'var(--on-navy-faint)', display: 'block', marginBottom: 13 }}>Package mix</span>
            {mix.length === 0 && <div className="mix-note">No active packages yet.</div>}
            {mix.map((m) => (
              <div key={m.packageId} className="mix-row">
                <div className="mix-head"><span className="mix-name">{m.packageName}</span><span className="mix-count">{m.accounts}</span></div>
                <div className="mix-track"><div className="mix-bar" style={{ width: `${Math.round((m.accounts / maxMix) * 100)}%` }} /></div>
              </div>
            ))}
            <div className="mix-note">Counted from active landlord accounts on each plan.</div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="card-title" style={{ fontSize: 14, marginBottom: 3 }}>Needs attention</div>
            <div className="card-sub" style={{ marginTop: 0, marginBottom: 12 }}>Expiring terms and inactive records</div>
            {s && attention.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: '8px 0' }}>Nothing needs attention right now.</div>}
            {attention.map((a, i) => (
              <button key={`${a.kind}-${a.targetId ?? i}`} type="button" className="attn-row" onClick={() => openAttention(a)}>
                <div className="attn-text">
                  <div className="attn-label">{a.label}</div>
                  <div className="attn-sub">{a.detail}</div>
                </div>
                <span className={attentionPill(a)}>{a.tag}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
