/* ============================================================
   DUA — vocabulary shared by the browser and the server
   Dates, times, and nothing that depends on either runtime.
   ============================================================ */

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const WEEK_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function startOfWeek(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));            // weeks run Monday to Sunday
  return x;
}
export function minutes(hhmm) { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; }
export const hhmm = t => String(t).slice(0, 5);               // Postgres hands back 'HH:MM:SS'
export function at(dateStr, time) { return new Date(dateStr + 'T' + hhmm(time) + ':00'); }

/* The window an allowance is counted over, as [fromISO, toISO]. */
export function periodRange(per, ref) {
  if (per === 'week') {
    const s = startOfWeek(ref);
    return [iso(s), iso(addDays(s, 6))];
  }
  const s = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const e = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return [iso(s), iso(e)];
}
