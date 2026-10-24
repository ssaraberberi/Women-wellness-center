/**
 * Everything is shown in studio time (Europe/Tirane), whatever zone the phone
 * is in. Names of days and months are ours, so Albanian is right on every
 * device regardless of which locales its Intl build ships.
 */
export const TZ = 'Europe/Tirane';

const DAYS = {
  sq: ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
const DAYS_LONG = {
  sq: ['e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë', 'e diel'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};
const MONTHS = {
  sq: ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const MONTHS_SHORT = {
  sq: ['JAN', 'SHK', 'MAR', 'PRI', 'MAJ', 'QER', 'KOR', 'GUS', 'SHT', 'TET', 'NËN', 'DHJ'],
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
};

type Lang = 'sq' | 'en';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The wall-clock parts of an instant, in Tirana. */
export function tirane(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour,
    minute: +p.minute,
    weekday: WD.indexOf(p.weekday) + 1, // 1 = Monday
    iso: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

export const todayISO = () => tirane(new Date()).iso;

/** "YYYY-MM-DD" ± days, as calendar arithmetic (no time zone involved). */
export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isoWeekday(iso: string) {
  const w = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}

export const time = (d: Date | string) => tirane(d).time;
export const dayShort = (iso: string, lang: Lang) => DAYS[lang][isoWeekday(iso) - 1];
export const dayNum = (iso: string) => +iso.slice(8, 10);
export const monthShort = (iso: string, lang: Lang) => MONTHS_SHORT[lang][+iso.slice(5, 7) - 1];

/** "e martë, 21 Tetor" */
export function longDate(d: Date | string, lang: Lang) {
  const t = tirane(d);
  const s = `${DAYS_LONG[lang][t.weekday - 1]}, ${t.day} ${MONTHS[lang][t.month - 1]}`;
  return lang === 'sq' ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** "Sot · 18:00", "Nesër · 07:00", "Sht 25 Tet · 17:00" */
export function whenShort(d: Date | string, lang: Lang) {
  const t = tirane(d);
  const today = todayISO();
  const label =
    t.iso === today ? (lang === 'sq' ? 'Sot' : 'Today') : t.iso === addDays(today, 1) ? (lang === 'sq' ? 'Nesër' : 'Tomorrow') : `${DAYS[lang][t.weekday - 1]} ${t.day} ${MONTHS_SHORT[lang][t.month - 1].charAt(0)}${MONTHS_SHORT[lang][t.month - 1].slice(1).toLowerCase()}`;
  return `${label} · ${t.time}`;
}

export const dateShort = (d: Date | string, lang: Lang) => {
  const t = tirane(d);
  return `${t.day} ${MONTHS[lang][t.month - 1]} ${t.year}`;
};

export const monthTitle = (iso: string, lang: Lang) => `${MONTHS[lang][+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;

/** 14500 → "14,500 L" */
export const lek = (n: number) => `${n.toLocaleString('en-US')} L`;

/** Tirana wall time → the UTC instant (handles daylight saving by asking Intl what the offset was). */
export function studioInstant(iso: string, hhmm: string) {
  const guess = new Date(`${iso}T${hhmm}:00Z`);
  for (let i = 0; i < 2; i++) {
    const t = tirane(guess);
    const shown = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute);
    const wanted = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), +hhmm.slice(0, 2), +hhmm.slice(3, 5));
    guess.setTime(guess.getTime() + (wanted - shown));
  }
  return guess;
}

/** The timetable reads in two halves, as the studio's own does. */
export const partOfDay = (d: Date | string): 'morning' | 'afternoon' => (tirane(d).hour < 12 ? 'morning' : 'afternoon');
