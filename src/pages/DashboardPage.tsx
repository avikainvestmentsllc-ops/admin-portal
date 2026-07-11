import { useAuth } from '../auth/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="content">
      <h2>Welcome, {user?.firstname ?? 'Admin'}</h2>
      <p>
        You are signed in as <strong>{user?.email}</strong> with roles{' '}
        <strong>{user?.roles.join(', ')}</strong>.
      </p>
      <p className="muted">
        Use the <strong>Onboarding</strong> tab to onboard landlords, choose packages and
        add-ons, and manage billing and invoicing.
      </p>
    </div>
  );
}
