import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', short: 'Home', to: '/dashboard', icon: 'dashboard' },
  { label: 'Onboarding', short: 'Onboard', to: '/onboarding', icon: 'person_add' },
  { label: 'Packages', short: 'Plans', to: '/packages', icon: 'inventory_2' },
  { label: 'Add-ons', short: 'Add-ons', to: '/addons', icon: 'extension' },
  { label: 'Mileage Rates', short: 'Mileage', to: '/mileage-rates', icon: 'directions_car' },
];

function initials(first?: string, last?: string): string {
  const a = (first ?? '').trim()[0] ?? '';
  const b = (last ?? '').trim()[0] ?? '';
  return (a + b).toUpperCase() || 'A';
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  // Drawer is used on mobile/tablet (below the desktop breakpoint); ignored on desktop
  // where the sidebar is permanently visible.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <div className="bg-atmosphere" aria-hidden="true" />

      <div className="app-shell">
        {/* Backdrop shown behind the drawer on mobile/tablet */}
        {drawerOpen && <div className="sidebar-backdrop" onClick={closeDrawer} aria-hidden="true" />}

        {/* Sidebar — permanent on desktop, slide-out drawer on mobile/tablet */}
        <aside className={drawerOpen ? 'sidebar open' : 'sidebar'}>
          <div className="sidebar-brand">
            <h1>Admin Portal</h1>
            <p>Management Console</p>
          </div>

          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeDrawer}
                className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-foot">
            <button className="side-link" onClick={logout}>
              <span className="material-symbols-outlined">logout</span>
              Log out
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div className="main-wrap">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="icon-btn menu-btn"
                aria-label="Open navigation menu"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen((o) => !o)}
              >
                <span className="material-symbols-outlined">{drawerOpen ? 'close' : 'menu'}</span>
              </button>
              <span className="brand">Admin Portal</span>
            </div>

            <div className="topbar-right">
              <div className="user-box">
                <span className="user-name">
                  {user?.firstname} {user?.lastname}
                </span>
                <span className="avatar">{initials(user?.firstname, user?.lastname)}</span>
                <button className="ghost sm" onClick={logout}>Log out</button>
              </div>
            </div>
          </header>

          <main className="page">
            <Outlet />
          </main>
        </div>

        {/* Bottom nav (mobile) */}
        <nav className="bottom-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'bottom-link active' : 'bottom-link')}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.short}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
