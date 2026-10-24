import { DateTime } from 'luxon';

/** The studio's clock. Stored values are UTC; every "what day / what time" question is asked here. */
export const TZ = 'Europe/Tirane';

export const studioNow = () => DateTime.now().setZone(TZ);

/** "2026-10-21" + "18:00" in Tirana → the UTC instant (DST handled by luxon). */
export function studioDateTime(date: string, time: string): Date {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: TZ });
  if (!dt.isValid) throw new Error(`Invalid studio date/time ${date} ${time}`);
  return dt.toUTC().toJSDate();
}

/** UTC instant → "YYYY-MM-DD" in Tirana. */
export const studioDate = (d: Date) => DateTime.fromJSDate(d).setZone(TZ).toISODate()!;

/** Start and end (exclusive) of a studio day, as UTC instants. */
export function studioDayRange(date: string): { from: Date; to: Date } {
  const start = DateTime.fromISO(date, { zone: TZ }).startOf('day');
  return { from: start.toUTC().toJSDate(), to: start.plus({ days: 1 }).toUTC().toJSDate() };
}

/** A Prisma @db.Date value for a studio calendar day. */
export const dbDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10);

export const isoWeekday = (date: string) => DateTime.fromISO(date, { zone: TZ }).weekday;

export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

export function hhmmToMinutes(s: string) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export const formatStudio = (d: Date, fmt: string, locale = 'sq') =>
  DateTime.fromJSDate(d).setZone(TZ).setLocale(locale).toFormat(fmt);
