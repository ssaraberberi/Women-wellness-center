import { useEffect, useState } from 'react';
import type { SessionDto } from './types';

/**
 * How a class is shown to a client. No head-counts: a client who sees
 * "5 places" next to "2 places" picks the emptier class, and the studio pays
 * the instructor per class. So a class says only whether it is open, and the
 * truth about its last places or when booking closes. Classes someone has
 * already booked come first, as "Suggested for you". The same rules as the
 * website's booking page (book/klase/klase.js).
 */
type Key = 'inProgress' | 'full' | 'bookingClosed' | 'lastPlace' | 'lastTwoPlaces' | 'closesIn' | 'availableSlot';
export type SlotLabel = { key: Key; vars?: Record<string, string | number>; urgent?: boolean };

export const NUDGE_WINDOW_MS = 2 * 3600_000;

const closesAt = (s: Pick<SessionDto, 'startsAt' | 'closesAt'>) => Date.parse(s.closesAt ?? s.startsAt);

export const isOpenForBooking = (s: SessionDto, now: number) => s.status === 'SCHEDULED' && closesAt(s) > now && s.available > 0;

/** Someone else is already in it, there is room, and it is not hers already. */
export const isSuggested = (s: SessionDto, now: number) => isOpenForBooking(s, now) && s.booked > 0 && !s.myBookingId && !s.myWaitlist;

export function slotLabel(s: SessionDto, now: number): SlotLabel {
  const left = closesAt(s) - now;
  if (Date.parse(s.startsAt) <= now) return { key: 'inProgress' };
  if (s.available <= 0) return { key: 'full' };
  if (left <= 0) return { key: 'bookingClosed' };
  if (s.available === 1) return { key: 'lastPlace', urgent: true };
  if (s.available === 2) return { key: 'lastTwoPlaces', urgent: true };
  if (left < 3 * 3600_000) {
    const m = Math.max(1, Math.ceil(left / 60_000));
    return { key: 'closesIn', vars: { h: Math.floor(m / 60), m: m % 60 }, urgent: true };
  }
  return { key: 'availableSlot' };
}

/** Suggested first, every other class after; grouped only when there is a choice to make. */
export function arrange(list: SessionDto[], now: number) {
  const suggested = list.filter((s) => isSuggested(s, now));
  const others = list.filter((s) => !isSuggested(s, now));
  const grouped = suggested.length > 0 && others.some((s) => isOpenForBooking(s, now) && !s.myBookingId);
  return { suggested, others, grouped };
}

/** The suggested class nearest to the one she picked, within two hours that day. */
export function nearestSuggested(list: SessionDto[], picked: SessionDto, now: number, sameDay: (a: string, b: string) => boolean) {
  if (isSuggested(picked, now) || !isOpenForBooking(picked, now) || picked.myBookingId) return null;
  const at = Date.parse(picked.startsAt);
  return (
    list
      .filter((o) => o.id !== picked.id && isSuggested(o, now) && sameDay(o.startsAt, picked.startsAt) && Math.abs(Date.parse(o.startsAt) - at) <= NUDGE_WINDOW_MS)
      .sort((a, b) => Math.abs(Date.parse(a.startsAt) - at) - Math.abs(Date.parse(b.startsAt) - at))[0] ?? null
  );
}

/** The time, ticking once a minute, so countdowns and closed classes move on while a screen is open. */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
