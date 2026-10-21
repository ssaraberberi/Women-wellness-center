/* ============================================================
   DUA on the phone — Albanian and English
   ------------------------------------------------------------
   The same approach as the web app: every screen writes English and
   t() hands back the reader's language. Keys are the English source, so
   there is nothing to keep in sync, and a string with no entry comes
   through in English rather than as a placeholder.

   Server messages (an error, a notice) arrive in English and go through
   the same t(); the notices use shared/notices.js, the very sentences
   the push sender uses, so the list and the lock screen say the same.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getItem, setItem } from './store';
import { noticeIn } from '@shared/notices.js';
import { SQ, SHAPES } from './sq';

export type Lang = 'sq' | 'en';
const KEY = 'dua-lang';

let current: Lang = 'sq';
export const getLang = () => current;

export function translate(lang: Lang, s: string | null | undefined, ...args: (string | number)[]): string {
  if (s == null) return '';
  const key = String(s);
  let out = key;
  if (lang === 'sq') {
    if (SQ[key] !== undefined) out = SQ[key];
    else if (!args.length) {
      const n = noticeIn(key, 'sq');
      if (n !== key) return n;
      for (const [re, to] of SHAPES) { const m = key.match(re); if (m) return to(m); }
    }
  }
  if (!args.length) return out;
  if (/%\d/.test(out)) return out.replace(/%(\d)/g, (_, n) => String(args[Number(n) - 1]));
  let i = 0;
  return out.replace(/%s/g, () => String(args[i++]));
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (s: string | null | undefined, ...args: (string | number)[]) => string };
const LangContext = createContext<Ctx>({ lang: 'sq', setLang: () => {}, t: (s) => String(s ?? '') });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState<Lang>('sq');
  useEffect(() => {
    getItem(KEY).then(v => { if (v === 'en' || v === 'sq') { current = v; set(v); } }).catch(() => {});
  }, []);
  const setLang = useCallback((l: Lang) => {
    current = l;
    set(l);
    setItem(KEY, l).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (s, ...a) => translate(lang, s, ...a) }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useT = () => useContext(LangContext);
