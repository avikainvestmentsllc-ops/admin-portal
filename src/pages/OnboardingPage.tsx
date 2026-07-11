import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLandlords, listPackages, ApiRequestError } from '../api/client';
import type { LandlordAccountView, PackageOption } from '../api/types';
import LandlordSlideIn, { type SlideMode } from './LandlordSlideIn';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<LandlordAccountView[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slideMode, setSlideMode] = useState<SlideMode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accts, pkgs] = await Promise.all([listLandlords(), listPackages()]);
      setAccounts(accts);
      setPackages(pkgs);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openSlide = (mode: SlideMode, id: string | null) => {
    setSlideMode(mode);
    setSelectedId(id);
  };
  const closeSlide = () => {
    setSlideMode(null);
    setSelectedId(null);
  };
  const onSaved = () => {
    closeSlide();
    void load();
  };

  return (
    <div className="content wide">
      <div className="page-head">
        <h2>Onboarding</h2>
        <button onClick={() => openSlide('add', null)}>+ Onboard Landlord</button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="muted">No landlord accounts yet. Click “Onboard Landlord” to add one.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Business Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.accountId}>
                  <td>{a.customerAccountId}</td>
                  <td>{a.businessName}</td>
                  <td>{a.email}</td>
                  <td>{a.phoneNumber}</td>
                  <td>
                    <span className={a.accountStatus ? 'badge on' : 'badge off'}>
                      {a.accountStatus ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="ghost sm" onClick={() => navigate(`/onboarding/${a.accountId}`)}>View</button>
                    <button className="ghost sm" onClick={() => openSlide('edit', a.accountId)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {slideMode && (
        <LandlordSlideIn
          mode={slideMode}
          accountId={selectedId}
          packages={packages}
          onClose={closeSlide}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
