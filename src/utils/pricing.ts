import type { PricingRow, PricingSource } from '../api/types';
import { money } from '../components/AppLayout';

/** The fee a row charges on a job of `amount`: base + pct on the part above the threshold, capped when a maximum is set. */
export function feeFor(row: { baseFee: number | string; pctThreshold: number | string; pctRate: number | string; maxFee: number | string | null }, amount: number): number {
  const base = Number(row.baseFee) || 0;
  const over = amount - (Number(row.pctThreshold) || 0);
  let fee = base + (over > 0 ? (over * (Number(row.pctRate) || 0)) / 100 : 0);
  const max = Number(row.maxFee) || 0;
  if (max > 0 && fee > max) fee = max;
  return Math.round(fee * 100) / 100;
}

/** "$20.00 + 5% over $200.00 · max $100.00" — one row in one line. */
export function rowLine(row: { baseFee: number | string; pctThreshold: number | string; pctRate: number | string; maxFee: number | string | null }): string {
  let line = money(Number(row.baseFee));
  if (Number(row.pctRate) > 0) line += ` + ${Number(row.pctRate)}% over ${money(Number(row.pctThreshold))}`;
  return row.maxFee != null && Number(row.maxFee) > 0 ? `${line} · max ${money(Number(row.maxFee))}` : `${line} · no max`;
}

export const DEFAULT_ROW_LABEL = 'All other categories';

export function rowName(row: PricingRow): string {
  return row.isDefault || row.categoryId == null ? DEFAULT_ROW_LABEL : row.categoryName ?? 'Category';
}

/** Category rows by name, the default row last. */
export function sortRows<T extends { categoryId: string | null; categoryName: string | null; isDefault?: boolean }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ad = a.isDefault || a.categoryId == null;
    const bd = b.isDefault || b.categoryId == null;
    if (ad !== bd) return ad ? 1 : -1;
    return (a.categoryName ?? '').localeCompare(b.categoryName ?? '');
  });
}

export function sourceLabel(source: PricingSource | null | undefined): string {
  switch (source) {
    case 'OVERRIDE': return 'Override';
    case 'ACCEPTED_TEMPLATE': return 'Default template (accepted)';
    case 'CURRENT_TEMPLATE': return 'Default template';
    default: return 'No template — config default';
  }
}

export function sourcePill(source: PricingSource | null | undefined): string {
  switch (source) {
    case 'OVERRIDE': return 'pill info';
    case 'ACCEPTED_TEMPLATE': return 'pill on';
    case 'CURRENT_TEMPLATE': return 'pill pending';
    default: return 'pill off';
  }
}

function shortDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Sep 20 – Oct 19" for a statement period. */
export function periodLabel(periodStart: string, periodEnd: string): string {
  return `${shortDay(periodStart)} – ${shortDay(periodEnd)}`;
}

/** The run month (yyyy-MM) of the latest period whose cutoff (the 20th) has passed. */
export function latestClosedPeriod(now = new Date()): string {
  const d = new Date(now);
  if (d.getDate() < 20) d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** The run month (yyyy-MM) a statement belongs to — the month of its period end. */
export function periodOf(periodEnd: string): string {
  return periodEnd.slice(0, 7);
}
