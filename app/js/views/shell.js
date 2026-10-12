/* The signed-in frame. On a desk: a sidebar, and the page beside it. On a
   phone or a tablet held upright: a top bar with the account behind it,
   and a tab bar under the thumb — the first four sections and, when there
   are more than five, a "More" sheet with the rest. Both are in the page
   at every width; the stylesheet shows one. */
import { el, chip, t, toast, icon, modal, closeModal, jobLabel, dateText, getLang, setLang } from '../ui.js';
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

const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const roleLabel = user => user.role === 'instructor' ? jobLabel(user.job) : t(user.role);
const isOn = (route, href) => route === href.replace(/^#\/?/, '');

/* nav: [href, label, badge, icon] */
export function shell({ user, route, nav, title, sub, actions, body, notices }) {
  const unread = (notices || []).filter(n => !n.read);

  /* An unconfirmed address is not a problem until the day she forgets her
     password, and on that day it is the whole problem — there is no link
     to send her. So it is said once, at the top, with the remedy on it.
     Strictly false: an older session, before the column existed, must not
     be nagged on a guess. */
  const nudge = user.emailVerified === false ? verifyNudge() : null;

  const many = nav.length > 5;
  const primary = many ? nav.slice(0, 4) : nav;
  const rest = many ? nav.slice(4) : [];
  const restOn = rest.some(([href]) => isOn(route, href));
  const restBadge = rest.reduce((n, item) => n + (Number(item[2]) || 0), 0);

  const tab = ([href, label, badge, ico]) => el('a', {
    href, class: isOn(route, href) ? 'is-on' : null, 'aria-current': isOn(route, href) ? 'page' : null
  }, [icon(ico), el('span', { text: label }), badge ? el('span.tabbar__badge', { text: String(badge) }) : null]);

  return el('div.shell', null, [
    el('aside.side', null, [
      el('div', null, [
        el('span.side__logo', { role: 'img', 'aria-label': 'DUA', text: 'dua' }),
        el('p.side__role', { text: roleLabel(user) })
      ]),
      el('nav', { 'aria-label': 'Sections' }, nav.map(([href, label, badge, ico]) =>
        el('a', { href, class: isOn(route, href) ? 'is-on' : null, 'aria-current': isOn(route, href) ? 'page' : null },
          [icon(ico), el('span', { text: label }), badge ? chip(String(badge), 'wine') : null]))),
      el('div.side__foot', null, [
        el('p.side__who', { text: user.name }),
        el('p', { style: 'overflow-wrap:anywhere', text: user.email }),
        langToggle(),
        el('button.linkish', { type: 'button', text: 'Sign out', onclick: () => store.signOut() })
      ])
    ]),

    el('header.topbar', null, [
      el('a.topbar__logo', { href: '#/', 'aria-label': 'DUA', text: 'dua' }),
      el('button.topbar__me', { type: 'button', 'aria-label': 'Account', text: initials(user.name),
        onclick: () => accountSheet(user) })
    ]),

    el('main.main', { id: 'main' }, el('div.main__inner', null, [
      el('header.head', null, [
        el('div', null, [el('h1', { text: title }), sub ? el('p', { text: sub }) : null]),
        actions ? el('div.head__actions', null, actions) : null
      ]),
      nudge,
      unread.length ? el('div.notices', { role: 'status' }, [
        ...unread.slice(0, 3).map(n =>
          el('div', { class: 'notice' + (n.tone === 'good' ? ' notice--good' : n.tone === 'warn' ? ' notice--warn' : n.tone === 'bad' ? ' notice--bad' : '') },
            el('span', { text: dateText(t(n.text)) }))),
        el('button.linkish', { type: 'button', style: 'justify-self:start',
          text: unread.length > 1 ? 'Mark all as read' : 'Dismiss', onclick: () => store.markNoticesRead() })
      ]) : null,
      body
    ])),

    el('nav.tabbar', { 'aria-label': 'Sections' }, [
      ...primary.map(tab),
      many ? el('button', { type: 'button', class: restOn ? 'is-on' : null, 'aria-haspopup': 'dialog',
        onclick: () => moreSheet(rest, route) },
        [icon('more'), el('span', { text: 'More' }), restBadge ? el('span.tabbar__badge', { text: String(restBadge) }) : null]) : null
    ])
  ]);
}

/* The sections that did not fit in the tab bar. */
function moreSheet(rest, route) {
  modal('More', el('nav.sheetnav', { 'aria-label': 'More sections' }, rest.map(([href, label, badge, ico]) =>
    el('a', { href, class: isOn(route, href) ? 'is-on' : null, onclick: closeModal },
      [icon(ico), el('span', { text: label }), badge ? chip(String(badge), 'wine') : null]))));
}

/* Who is signed in, the language, and the way out. */
function accountSheet(user) {
  modal('Account', el('div', null, [
    el('div.who', null, [
      el('span.avatar', { 'aria-hidden': 'true', text: initials(user.name) }),
      el('div', null, [el('b', { text: user.name }), el('span', { text: user.email }), el('span', { text: roleLabel(user) })])
    ]),
    el('div.sheetnav', null, [
      el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:56px;border-top:1px solid var(--line-soft)' }, [
        el('span', { style: 'font-size:16px', text: 'Language' }), langToggle()
      ]),
      el('button', { type: 'button', style: 'color:var(--wine)', onclick: () => { closeModal(); store.signOut(); } },
        [icon('close'), el('span', { text: 'Sign out' })])
    ])
  ]));
}

function verifyNudge() {
  const again = el('button.linkish', { type: 'button', text: 'Send the link again' });
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
