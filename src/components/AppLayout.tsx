import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppShellProvider, useShellState } from './AppShell';
import { Icon, type IconName } from './Icons';

const NAV_ITEMS: { label: string; short: string; to: string; icon: IconName }[] = [
  { label: 'Dashboard', short: 'Home', to: '/dashboard', icon: 'dashboard' },
  { label: 'Onboarding', short: 'Onboard', to: '/onboarding', icon: 'onboarding' },
  { label: 'Packages', short: 'Plans', to: '/packages', icon: 'packages' },
  { label: 'Add-ons', short: 'Add-ons', to: '/addons', icon: 'addons' },
  { label: 'Mileage Rates', short: 'Mileage', to: '/mileage-rates', icon: 'mileage' },
  { label: 'Contractors', short: 'Contractors', to: '/contractors', icon: 'contractors' },
];

function initials(first?: string, last?: string): string {
  const a = (first ?? '').trim()[0] ?? '';
  const b = (last ?? '').trim()[0] ?? '';
  return (a + b).toUpperCase() || 'A';
}

export function money(n: number | null | undefined): string {
  return n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function compact(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(n)}`;
}

/**
 * The logged-in shell from the "Admin Portal Web" canvas: 236px navy sidebar (brand, nav with the
 * Onboarding badge = inactive accounts, Monthly-recurring card, admin footer with sign-out), a top
 * bar with the page title / subtitle / back link / primary CTA declared by each page via
 * usePageHeader(), a bell, and the toast. Below 1024px the sidebar is a drawer and a bottom nav appears.
 */
function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { header, toast, showToast, summary } = useShellState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  const activeAccounts = summary?.activeLandlords ?? 0;
  const mrr = summary?.monthlyRecurringRevenue ?? 0;

  return (
    <div className="app-shell">
      {drawerOpen && <div className="sidebar-backdrop" onClick={closeDrawer} aria-hidden="true" />}

      <aside className={drawerOpen ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Icon name="house" size={18} strokeWidth={1.8} /></div>
          <div style={{ minWidth: 0 }}>
            <h1>My House Lease®</h1>
            <p>Admin Portal</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const badge = item.to === '/onboarding' ? summary?.inactiveLandlords ?? 0 : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeDrawer}
                className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
              >
                <Icon name={item.icon} />
                <span className="label">{item.label}</span>
                {badge > 0 && <span className="nav-badge">{badge}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-mrr">
            <span className="eyebrow">Monthly recurring</span>
            <div className="value">{summary ? money(mrr) : '—'}</div>
            <div className="note">
              {summary
                ? `${activeAccounts} active account${activeAccounts === 1 ? '' : 's'} · ${compact(mrr * 12)} annualized`
                : 'Loading account summary…'}
            </div>
          </div>
          <div className="sidebar-user">
            <div className="avatar">{initials(user?.firstname, user?.lastname)}</div>
            <div className="who">
              <div className="name">{user?.firstname} {user?.lastname}</div>
              <div className="roles">{(user?.roles ?? []).join(' · ') || 'Admin'}</div>
            </div>
            <button className="logout" onClick={logout} title="Sign out" aria-label="Sign out">
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn menu-btn"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((o) => !o)}
            >
              <Icon name={drawerOpen ? 'close' : 'menu'} size={18} />
            </button>
            <div className="topbar-title-block">
              {header?.backLabel && (
                <button className="topbar-back" onClick={() => (header.onBack ? header.onBack() : navigate(-1))}>
                  ‹ {header.backLabel}
                </button>
              )}
              <h2 className="topbar-title">{header?.title ?? 'Admin Portal'}</h2>
              {header?.subtitle && <p className="topbar-sub">{header.subtitle}</p>}
            </div>
          </div>
          <div className="topbar-right">
            <button className="bell" aria-label="Notifications" onClick={() => showToast('Notifications are on their way — nothing needs you right now.')}>
              <Icon name="bell" />
            </button>
            {header?.cta && (
              <button className="cta" onClick={header.cta.onClick}>{header.cta.label}</button>
            )}
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'bottom-link active' : 'bottom-link')}
          >
            <Icon name={item.icon} size={18} />
            {item.short}
          </NavLink>
        ))}
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default function AppLayout() {
  return (
    <AppShellProvider>
      <Shell />
    </AppShellProvider>
  );
}
