/* The signed-in frame: sidebar, nav, and the page slot. */
import { el, chip } from '../ui.js';
import * as store from '../store.js';

export function shell({ user, route, nav, title, sub, actions, body, notices }) {
  const unread = (notices || []).filter(n => !n.read).length;

  return el('div.shell', null, [
    el('aside.side', null, [
      el('div', null, [
        el('span.side__logo', { role: 'img', 'aria-label': 'DUA', text: 'dua' }),
        el('p.side__role', { style: 'margin-top:8px', text: user.role })
      ]),
      el('nav', { 'aria-label': 'Sections' }, nav.map(([href, label, badge]) =>
        el('a', {
          href, class: (route === href.replace(/^#\/?/, '') ? 'is-on' : ''),
        }, [el('span', { text: label }), badge ? chip(String(badge), 'wine') : null]))),
      el('div.side__foot', null, [
        el('p.side__who', { text: user.name }),
        el('p', { text: user.email }),
        el('button.linkish', { type: 'button', text: 'Sign out', onclick: () => store.signOut() })
      ])
    ]),
    el('main.main', null, [
      el('header.head', null, [
        el('div', null, [
          el('h1', { text: title }),
          sub ? el('p', { text: sub }) : null
        ]),
        actions ? el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, actions) : null
      ]),
      unread ? el('div.grid', { style: 'margin-bottom:18px' },
        (notices || []).filter(n => !n.read).slice(0, 3).map(n =>
          el('div', { class: 'notice notice--' + (n.tone === 'good' ? 'good' : n.tone === 'warn' ? 'warn' : '') }, [
            el('span', { text: n.text }),
            el('button.linkish', { type: 'button', text: 'Dismiss', style: 'margin-left:auto',
              onclick: () => store.markNoticesRead(user.id) })
          ]))) : null,
      body
    ])
  ]);
}
