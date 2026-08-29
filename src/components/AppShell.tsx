import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getDashboardSummary } from '../api/client';
import type { DashboardSummary } from '../api/types';

/**
 * The shell state every logged-in page shares (canvas: the top bar's title / subtitle / back link /
 * primary CTA, the toast, and the dashboard summary the sidebar's MRR card and the Onboarding badge
 * read). Pages describe their header with usePageHeader(); AppLayout renders it.
 */
export interface PageHeader {
  title: string;
  subtitle?: string;
  backLabel?: string;
  onBack?: () => void;
  cta?: { label: string; onClick: () => void };
}

interface ShellValue {
  header: PageHeader | null;
  setHeader: (h: PageHeader | null) => void;
  toast: string;
  showToast: (message: string) => void;
  summary: DashboardSummary | null;
  summaryError: string | null;
  refreshSummary: () => void;
}

const ShellContext = createContext<ShellValue | null>(null);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeader | null>(null);
  const [toast, setToast] = useState('');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(''), 3200);
  }, []);

  const refreshSummary = useCallback(() => {
    getDashboardSummary()
      .then((s) => { setSummary(s); setSummaryError(null); })
      .catch((e: unknown) => setSummaryError(e instanceof Error ? e.message : 'Failed to load summary'));
  }, []);

  useEffect(() => { refreshSummary(); }, [refreshSummary]);

  const value = useMemo<ShellValue>(
    () => ({ header, setHeader, toast, showToast, summary, summaryError, refreshSummary }),
    [header, toast, showToast, summary, summaryError, refreshSummary],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

function useShell(): ShellValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used inside AppShellProvider');
  return ctx;
}

/**
 * Declares the page's top-bar content. Callbacks are read through a ref so a page can pass fresh
 * closures on every render without re-registering the header (only the visible strings matter).
 */
export function usePageHeader(header: PageHeader) {
  const { setHeader } = useShell();
  const latest = useRef(header);
  latest.current = header;
  const ctaLabel = header.cta?.label ?? '';
  useEffect(() => {
    setHeader({
      title: header.title,
      subtitle: header.subtitle,
      backLabel: header.backLabel,
      onBack: header.backLabel ? () => latest.current.onBack?.() : undefined,
      cta: ctaLabel ? { label: ctaLabel, onClick: () => latest.current.cta?.onClick() } : undefined,
    });
    return () => setHeader(null);
  }, [setHeader, header.title, header.subtitle, header.backLabel, ctaLabel]);
}

export function useToast() {
  return useShell().showToast;
}

export function useAdminSummary() {
  const { summary, summaryError, refreshSummary } = useShell();
  return { summary, summaryError, refreshSummary };
}

export function useShellState() {
  return useShell();
}
