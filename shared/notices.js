/* ============================================================
   DUA — the notices the server writes, in Albanian
   ------------------------------------------------------------
   The server writes every notice in English, and the web app translates
   it on the way to the screen. A push notification never reaches a
   screen of ours: the phone's own system draws it, so it has to leave
   the server already in her language. This is that translation, as a
   pure module the push sender and the phone app both import.

   The same sentences, word for word, as app/js/i18n.js — keep the two in
   step when a notice changes.
   ============================================================ */

const WORDS = {
  'Your reservation is confirmed. See you at DUA.': 'Rezervimi yt u konfirmua. Shihemi në DUA.',
  'Your membership was updated by the studio.': 'Abonimi yt u përditësua nga studioja.',
  'Your password was reset at the studio. Ask for the new one at the desk.':
    'Fjalëkalimi yt u rivendos në studio. Kërko të riun te banaku.'
};

const SHAPES = [
  [/^Your membership (.+) is active until (\d{4}-\d{2}-\d{2})\.$/,
    m => 'Abonimi yt ' + m[1] + ' është aktiv deri më ' + m[2] + '.'],
  [/^A place opened in the (\d\d:\d\d) class on (\d{4}-\d{2}-\d{2}) — you are in\.$/,
    m => 'U lirua një vend në klasën e orës ' + m[1] + ', ' + m[2] + ' — je brenda.'],
  [/^Your class on (\d{4}-\d{2}-\d{2}) at (\d\d:\d\d) will be led by someone new\. Your place is safe\.$/,
    m => 'Klasën tënde, ' + m[1] + ' në orën ' + m[2] + ', do ta mbajë dikush tjetër. Vendi yt është i sigurt.'],
  [/^Your class on (\d{4}-\d{2}-\d{2}) at (\d\d:\d\d) will now be led by (.+)\.$/,
    m => 'Klasën tënde, ' + m[1] + ' në orën ' + m[2] + ', tani e mban ' + (m[3] === 'someone new' ? 'dikush tjetër' : m[3]) + '.'],
  [/^Your class moved to (\d{4}-\d{2}-\d{2}), (\d\d:\d\d)–(\d\d:\d\d)\.$/,
    m => 'Klasa jote u zhvendos: ' + m[1] + ', ' + m[2] + '–' + m[3] + '.'],
  [/^The (\d\d:\d\d) class on (\d{4}-\d{2}-\d{2}) was cancelled\. Your session has been returned\.$/,
    m => 'Klasa e orës ' + m[1] + ', ' + m[2] + ', u anulua. Seanca t\'u kthye.'],
  [/^A bonus class from (.+) has been added to your package\.$/,
    m => 'Një klasë bonus nga ' + m[1] + ' u shtua në paketën tënde.'],
  [/^The studio is closed on (\d{4}-\d{2}-\d{2})\. Your (\d\d:\d\d) class is cancelled and the class is back in your package\.$/,
    m => 'Studioja është e mbyllur më ' + m[1] + '. Klasa jote e orës ' + m[2] + ' u anulua dhe klasa u kthye në paketën tënde.']
];

/* A notice in the language asked for; one we have no words for comes
   through as it was written, which is the right failure. */
export function noticeIn(text, lang) {
  if (lang === 'en' || text == null) return text;
  const key = String(text);
  if (WORDS[key] !== undefined) return WORDS[key];
  for (const [re, to] of SHAPES) { const m = key.match(re); if (m) return to(m); }
  return key;
}
