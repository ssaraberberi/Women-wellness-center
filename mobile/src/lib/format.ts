/* Dates said the way people say them, in either language. Class dates
   are the studio's calendar dates (Tirana), so they are formatted from
   the date string itself and never pass through the phone's clock. */
import { at } from '@shared/domain.js';
import type { Lang } from './i18n';

const DAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  sq: ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë']
};
const DAYS_SHORT = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  sq: ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht']
};
const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  sq: ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor']
};

const parts = (d: string) => { const [y, m, day] = d.split('-').map(Number); return { y, m, day, wd: new Date(Date.UTC(y, m - 1, day)).getUTCDay() }; };

/* "Monday 3 November" / "e hënë, 3 nëntor". Albanian writes the weekday
   small inside a sentence; `start` capitalises it where it opens a line. */
export function longDate(d: string, lang: Lang, start?: boolean) {
  const p = parts(d);
  if (lang === 'en') return DAYS.en[p.wd] + ' ' + p.day + ' ' + MONTHS.en[p.m - 1];
  const s = DAYS.sq[p.wd] + ', ' + p.day + ' ' + MONTHS.sq[p.m - 1];
  return start ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
/* "3 Nov" */
export function shortDate(d: string, lang: Lang) {
  const p = parts(d);
  return p.day + ' ' + MONTHS[lang][p.m - 1].slice(0, 3);
}
export const weekdayShort = (d: string, lang: Lang) => DAYS_SHORT[lang][parts(d).wd];
export const dayOfMonth = (d: string) => parts(d).day;

export const startsAt = (date: string, start: string): Date => at(date, start);

export function money(n: number | null | undefined, lang: Lang) {
  if (n == null) return lang === 'en' ? 'Price at the studio' : 'Çmimi në studio';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : '.') + ' ALL';
}
