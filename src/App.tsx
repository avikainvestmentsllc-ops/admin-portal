import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import PublicTitle from './components/PublicTitle';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import VerifyOtpPage from './pages/VerifyOtpPage';
import DashboardPage from './pages/DashboardPage';
import OnboardingPage from './pages/OnboardingPage';
import PackagesPage from './pages/PackagesPage';
import AddonsPage from './pages/AddonsPage';
import LandlordBillingPage from './pages/LandlordBillingPage';
import MileageRatesPage from './pages/MileageRatesPage';
import ContractorsPage from './pages/ContractorsPage';
import AgentsPage from './pages/AgentsPage';
import AgentTermsPage from './pages/AgentTermsPage';
import LandlordTermsPage from './pages/LandlordTermsPage';
import PlatformFeesPage from './pages/PlatformFeesPage';
import RefundRequestsPage from './pages/RefundRequestsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import ContractorFeesPage from './pages/ContractorFeesPage';
import PricingTermsPage from './pages/PricingTermsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PublicTitle />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/onboarding/:accountId" element={<LandlordBillingPage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/addons" element={<AddonsPage />} />
            <Route path="/mileage-rates" element={<MileageRatesPage />} />
            <Route path="/contractors" element={<ContractorsPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agent-terms" element={<AgentTermsPage />} />
            <Route path="/landlord-terms" element={<LandlordTermsPage />} />
            <Route path="/platform-fees" element={<PlatformFeesPage />} />
            <Route path="/refund-requests" element={<RefundRequestsPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/platform-fees/:contractorId" element={<ContractorFeesPage />} />
            <Route path="/pricing-terms" element={<PricingTermsPage />} />
          </Route>
          {/* /dashboard is the default landing page after login */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
