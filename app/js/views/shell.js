/* The signed-in frame: sidebar, nav, and the page slot. */
import { el, chip, t, toast, getLang, setLang } from '../ui.js';
import * as store from '../store.js';

/* Albanian and English, side by side rather than hidden in a menu: the
   studio is bilingual and either word should be one tap away. Changing it
   re-renders from the top, so the whole app turns over at once. */
export function langToggle() {
  const now = getLang();
  return el('div.lang', { role: 'group', 'aria-label': 'Language' }, ['sq', 'en'].map(code =>
    el('button', {
      type: 'button',
      class: 'lang__btn' + (code === now ? ' is-on' : ''),
      'aria-pressed': code === now ? 'true' : 'false',
      text: code === 'sq' ? 'AL' : 'EN',
      onclick: () => { if (code !== getLang()) setLang(code); }
    })));
}

export function shell({ user, route, nav, title, sub, actions, body, notices }) {
  const unread = (notices || []).filter(n => !n.read);

  /* An unconfirmed address is not a problem until the day she forgets her
     password, and on that day it is the whole problem — there is no link
     to send her. So it is said once, at the top, with the remedy on it.
     Strictly false: an older session, before the column existed, must not
     be nagged on a guess. */
  const nudge = user.emailVerified === false ? verifyNudge() : null;

  return el('div.shell', null, [
    el('aside.side', null, [
      el('div', null, [
        el('span.side__logo', { role: 'img', 'aria-label': 'DUA', text: 'dua' }),
        el('p.side__role', { style: 'margin-top:8px', text: t(user.role) })
      ]),
      el('nav', { 'aria-label': 'Sections' }, nav.map(([href, label, badge]) =>
        el('a', { href, class: (route === href.replace(/^#\/?/, '') ? 'is-on' : '') },
          [el('span', { text: label }), badge ? chip(String(badge), 'wine') : null]))),
      el('div.side__foot', null, [
        el('p.side__who', { text: user.name }),
        el('p', { text: user.email }),
        langToggle(),
        el('button.linkish', { type: 'button', text: 'Sign out', onclick: () => store.signOut() })
      ])
    ]),
    el('main.main', null, [
      el('header.head', null, [
        el('div', null, [el('h1', { text: title }), sub ? el('p', { text: sub }) : null]),
        actions ? el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, actions) : null
      ]),
      nudge,
      unread.length ? el('div.grid', { style: 'margin-bottom:18px' }, unread.slice(0, 3).map(n =>
        el('div', { class: 'notice notice--' + (n.tone === 'good' ? 'good' : n.tone === 'warn' ? 'warn' : '') }, [
          el('span', { text: n.text }),
          el('button.linkish', { type: 'button', text: 'Dismiss', style: 'margin-left:auto',
            onclick: () => store.markNoticesRead() })
        ]))) : null,
      body
    ])
  ]);
}

function verifyNudge() {
  const again = el('button.linkish', { type: 'button', text: 'Send the link again',
    style: 'margin-left:auto;white-space:nowrap' });
  again.onclick = async () => {
    again.disabled = true;
    const was = again.textContent;
    again.textContent = t('One moment…');
    try { await store.sendVerification(); toast('Check your inbox for the link.'); }
    catch (e) { toast(e.message); }
    again.disabled = false;
    again.textContent = was;
  };
  return el('div.notice.notice--warn', { style: 'margin-bottom:18px' }, [
    el('span', { text: 'Your email is not confirmed yet. Confirm it so we can send you a way back in if you forget your password.' }),
    again
  ]);
}
