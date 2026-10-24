import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Tab titles of the pages outside the signed-in shell (AppLayout sets the rest from each page's header).
const TITLES: Record<string, string> = {
  '/login': 'Sign In',
  '/forgot-password': 'Forgot Password',
  '/verify-otp': 'Verify Code',
  '/reset-password': 'Reset Password',
};

export default function PublicTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (TITLES[pathname]) document.title = `${TITLES[pathname]} · Admin Portal · My House Lease`;
  }, [pathname]);
  return null;
}
