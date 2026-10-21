/* How a package or an offer is described, read off what it allows —
   "8 Reformer", "4 Reformer + 1 Spa" — the way the website's cards are. */
import type { Lang } from './i18n';

export type Line = { types: string[]; total: number | null };
export type ClassType = { id: string; name: string; short: string };

export function linesLabel(lines: Line[], types: ClassType[], lang: Lang) {
  const short = (id: string) => (types.find(t => t.id === id) || { short: id }).short;
  return lines.map(l => (l.total == null ? (lang === 'en' ? 'Unlimited ' : 'Pa limit ') : l.total + ' ') +
    l.types.map(short).join(' / ')).join(' + ');
}

/* The studio writes in Albanian and may add English; either falls back
   to the other, so a studio that writes once is not missing anything. */
export function inLang(sq: string | null | undefined, en: string | null | undefined, lang: Lang) {
  return (lang === 'en' ? en || sq : sq || en) || '';
}

/* A reservation's status, as a word and a colour. */
const STATUS: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed' };
export const statusLabel = (s: string) => STATUS[s] || s;
export const statusTone = (s: string): 'good' | 'warn' | 'bad' | 'neutral' =>
  s === 'confirmed' ? 'good' : s === 'pending' ? 'warn' : s === 'cancelled' ? 'bad' : 'neutral';
