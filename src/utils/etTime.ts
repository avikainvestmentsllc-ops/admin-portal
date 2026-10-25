/** "10/25/2026, 11:34 AM ET" — admin times are shown in Eastern. */
export function formatEt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })} ET`;
}
