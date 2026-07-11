import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Onboarding', to: '/onboarding' },
  { label: 'Packages', to: '/packages' },
  { label: 'Add-ons', to: '/addons' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">Admin Portal</span>
        <nav className="main-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <span>{user?.firstname} {user?.lastname}</span>
          <button className="ghost" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
