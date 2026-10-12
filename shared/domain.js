/* ============================================================
   DUA — vocabulary shared by the browser and the server
   Dates, times, and nothing that depends on either runtime.

   The studio is in Tirana and so is every class: a class at 07:00 on
   2 November is 07:00 in Europe/Tirane, whatever clock the server or
   the phone is set to. The server runs on UTC, so "when does this class
   start" and "what is today's date" are always answered in the studio's
   own timezone, through the helpers below. Calendar arithmetic on date
   strings (adding days, finding a weekday) needs no timezone at all.
   ============================================================ */

export const TZ = 'Europe/Tirane';
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const WEEK_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/* A Date built from a date string at local midnight, for calendar maths
   only — never for "when does it happen". */
export const day = dateStr => new Date(dateStr + 'T00:00:00');

export function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export const plusDays = (dateStr, n) => iso(addDays(day(dateStr), n));
export const weekdayOf = dateStr => day(dateStr).getDay();          // 0 = Sunday
export function startOfWeek(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));            // weeks run Monday to Sunday
  return x;
}
export function minutes(hhmm) { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; }
export const hhmm = t => String(t).slice(0, 5);               // Postgres hands back 'HH:MM:SS'

/* ---------- the studio's clock ---------- */
let FMT = null;
function partsOf(instant) {
  FMT = FMT || new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const o = {};
  for (const p of FMT.formatToParts(instant)) o[p.type] = p.value;
  if (o.hour === '24') o.hour = '00';
  return o;
}
/* Minutes Tirana is ahead of UTC at that instant: 60 in winter, 120 in summer. */
function offsetAt(instant) {
  const p = partsOf(instant);
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wall - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}
/* Today's date in Tirana. */
export function todayIn(now) { const p = partsOf(now || new Date()); return p.year + '-' + p.month + '-' + p.day; }
/* The time of day in Tirana, as HH:MM. */
export function clockIn(instant) { const p = partsOf(instant); return p.hour + ':' + p.minute; }

/* The instant a class on that date at that time starts, in Tirana. */
export function at(dateStr, time) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [h, mi] = hhmm(time).split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let t = wall - offsetAt(new Date(wall)) * 60000;
  const again = wall - offsetAt(new Date(t)) * 60000;          // across a clock change, settle once more
  if (again !== t) t = again;
  return new Date(t);
}

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

/* A phone number as one key, however it was typed: "069 710 4072",
   "+355 69 710 4072" and "00355697104072" are the same person. */
export function phoneKey(raw) {
  let d = String(raw || '').replace(/\D+/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('355')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d.length >= 7 ? d : '';
}
