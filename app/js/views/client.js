/* The client side: simple, visual, and never showing the arithmetic. */
import { el, frag, chip, dot, modal, closeModal, toast, meter, money,
         typeName, typeShort, range, niceDate, relDay, shortDate, startsAt } from '../ui.js';
import * as store from '../store.js';
import { PLANS, iso, addDays, startOfWeek } from '../data.js';
import { balances, canBook, canCancel, cancelDeadline, spots, membershipOf, isExpired,
         planOf, bookingOf, allowanceFor, BOOKING_HORIZON_DAYS } from '../rules.js';
import { shell } from './shell.js';

export function renderClient(ctx) {
  const { user, state, now, route } = ctx;
  const m = membershipOf(state, user.id);
  const expired = isExpired(m, now);

  const nav = [
    ['#/', 'Today'],
    ['#/calendar', 'Book a class'],
    ['#/mine', 'My classes'],
    ['#/memberships', 'Membership']
  ];

  let title = 'Today', sub = '', body;
  if (route === 'calendar') { title = 'Book a class'; sub = 'The next ' + BOOKING_HORIZON_DAYS + ' days'; body = calendar(ctx, m, expired); }
  else if (route === 'mine') { title = 'My classes'; body = mine(ctx); }
  else if (route === 'memberships') { title = 'Membership'; sub = 'Choose what fits your week'; body = memberships(ctx, m, expired); }
  else { sub = relDay(iso(now), now) + ' at DUA'; body = home(ctx, m, expired); }

  return shell({ user, route, nav, title, sub, body, notices: store.noticesFor(user.id) });
}

/* ---------- membership card ---------- */
function membershipCard(ctx, m, expired) {
  const { state, user, now } = ctx;
  if (!m || m.status === 'cancelled') {
    return el('div.card', null, [
      el('p.eyebrow', { text: 'No membership' }),
      el('h3.display', { style: 'font-size:1.4rem;margin:8px 0 10px', text: 'Pick a membership to start booking' }),
      el('a.btn.btn--sm', { href: '#/memberships', text: 'View memberships' })
    ]);
  }
  const plan = planOf(m.planId);
  const rows = balances(state, user.id, now);
  return el('div.card', null, [
    el('div', { style: 'display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start' }, [
      el('div', null, [
        el('p.eyebrow', { text: 'Your membership' }),
        el('h3.display', { style: 'font-size:1.6rem;margin-top:6px', text: plan.name })
      ]),
      expired ? chip('Expired', 'bad') : chip('Active', 'good')
    ]),
    el('div.grid', { style: 'margin-top:16px' }, rows.map(b =>
      el('div', null, [
        el('div', { style: 'display:flex;justify-content:space-between;gap:12px;font-size:14px' }, [
          el('span', { text: b.label }),
          el('b', { style: 'font-weight:400', class: 'num',
            text: b.unlimited ? 'Unlimited' : b.left + ' left this ' + b.per })
        ]),
        b.unlimited ? null : meter(b.used, b.allowance.limit)
      ]))),
    el('p.muted', { style: 'margin-top:14px;font-size:13px',
      text: (expired ? 'Expired ' : 'Renews ') + niceDate(m.end) })
  ]);
}

/* ---------- today ---------- */
function home(ctx, m, expired) {
  const { state, user, now } = ctx;
  const today = iso(now);
  const upcoming = state.bookings
    .filter(b => b.clientId === user.id && b.status === 'booked')
    .map(b => ({ b, s: state.sessions.find(x => x.id === b.sessionId) }))
    .filter(x => x.s && !x.s.cancelled && x.s.date >= today)
    .sort((a, z) => startsAt(a.s) - startsAt(z.s));

  return frag([
    el('div', { style: 'display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:16px;align-items:start',
                class: 'stack' }, [
      membershipCard(ctx, m, expired),
      el('div.card', null, [
        el('p.eyebrow', { text: 'Next up' }),
        upcoming.length
          ? el('div.grid', { style: 'margin-top:12px' }, upcoming.slice(0, 4).map(({ b, s }) => slotRow(ctx, s, { booking: b })))
          : el('p.muted', { style: 'margin-top:12px', text: 'Nothing booked yet.' }),
        el('a.btn.btn--ghost.btn--sm', { href: '#/calendar', style: 'margin-top:16px;align-self:flex-start',
          text: upcoming.length ? 'Book another' : 'Browse classes' })
      ])
    ]),
    el('h2.display', { style: 'font-size:1.3rem;margin:28px 0 12px', text: relDay(today, now) + ' at the studio' }),
    el('div.grid', null, dayList(ctx, today, m, expired))
  ]);
}

function dayList(ctx, date, m, expired) {
  const { state } = ctx;
  const list = state.sessions.filter(s => s.date === date && !s.cancelled)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!list.length) return [el('p.muted', { text: 'No classes scheduled.' })];
  return list.map(s => slotRow(ctx, s, { m, expired }));
}

/* ---------- one class row ---------- */
function slotRow(ctx, s, opts) {
  const { state, user, now } = ctx;
  const o = opts || {};
  const cap = spots(state, s);
  const instr = state.instructors.find(i => i.id === s.instructorId);
  const existing = o.booking || bookingOf(state, user.id, s.id);
  const mine = existing && existing.status === 'booked';
  const waiting = existing && existing.status === 'waitlist';

  let action;
  if (mine) {
    const cc = canCancel(s, now);
    action = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
      chip('Booked', 'good'),
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Cancel',
        onclick: () => confirmCancel(ctx, existing, s) })
    ]);
  } else if (waiting) {
    action = chip('On waitlist', 'warn');
  } else {
    const v = canBook(state, user.id, s, now);
    if (v.ok) {
      action = el('button.btn.btn--sm', { type: 'button', text: 'Book class',
        onclick: () => { const r = store.book(user.id, s.id, now); toast(r.ok ? 'Booked — see you there' : r.message); } });
    } else if (v.code === 'full') {
      action = el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Join waitlist',
        onclick: () => { store.joinWaitlist(user.id, s.id); toast('You are on the waitlist'); } });
    } else if (v.code === 'not-included' || v.code === 'no-membership' || v.code === 'expired') {
      action = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
        el('span.muted', { style: 'font-size:12.5px', text: v.message }),
        el('a.btn.btn--ghost.btn--sm', { href: '#/memberships', text: 'View memberships' })
      ]);
    } else {
      /* Nothing to press: a quiet line reads better than a dead button. */
      action = el('span.muted', { style: 'font-size:12.5px', text: v.message });
    }
  }

  return el('div', {
    class: 'slot slot--' + s.typeId + (cap.full && !mine ? ' slot--full' : '') + (mine ? ' slot--mine' : '')
  }, [
    el('span.slot__time.num', { text: range(s) }),
    el('span.slot__name', null, [dot(s.typeId), ' ', typeName(s.typeId)]),
    el('span.slot__who', { text: instr ? instr.name.split(' ')[0] : 'To be confirmed' }),
    el('span.slot__cap.num', { text: cap.taken + ' / ' + cap.capacity }),
    el('span.slot__act', null, action)
  ]);
}

/* ---------- cancel ---------- */
function confirmCancel(ctx, booking, s) {
  const { now } = ctx;
  const cc = canCancel(s, now);
  const deadline = cancelDeadline(s);
  const hh = String(deadline.getHours()).padStart(2, '0') + ':' + String(deadline.getMinutes()).padStart(2, '0');

  modal('Cancel this class?', el('div', null, [
    el('p', { text: typeName(s.typeId) + ' · ' + niceDate(s.date) + ' · ' + range(s) }),
    el('div', { class: 'notice ' + (cc.ok ? 'notice--good' : 'notice--warn'), style: 'margin-top:14px',
      text: cc.ok
        ? 'Free cancellation until ' + hh + '. Your session goes straight back to your balance.'
        : 'The ' + hh + ' deadline has passed. This class will still count against your membership.' })
  ]), [
    el('button.btn.btn--ghost', { type: 'button', text: 'Keep it', onclick: closeModal }),
    el('button.btn', { type: 'button', text: cc.ok ? 'Cancel class' : 'Cancel anyway', onclick: () => {
      const r = store.cancelBooking(booking.id, now);
      closeModal();
      toast(r.late ? 'Cancelled — the session stays deducted' : 'Cancelled — session returned');
    } })
  ]);
}

/* ---------- calendar ---------- */
function calendar(ctx, m, expired) {
  const { state, now } = ctx;
  const days = Array.from({ length: BOOKING_HORIZON_DAYS + 1 }, (_, i) => iso(addDays(now, i)));
  return el('div.grid', { style: 'gap:22px' }, days.map(d => {
    const list = state.sessions.filter(s => s.date === d && !s.cancelled).sort((a, b) => a.start.localeCompare(b.start));
    if (!list.length) return null;
    return el('section', null, [
      el('h2.display', { style: 'font-size:1.15rem;margin-bottom:10px', text: relDay(d, now) }),
      el('div.grid', null, list.map(s => slotRow(ctx, s, { m, expired })))
    ]);
  }).filter(Boolean));
}

/* ---------- my classes ---------- */
function mine(ctx) {
  const { state, user, now } = ctx;
  const today = iso(now);
  const rows = state.bookings.filter(b => b.clientId === user.id)
    .map(b => ({ b, s: state.sessions.find(x => x.id === b.sessionId) }))
    .filter(x => x.s)
    .sort((a, z) => startsAt(z.s) - startsAt(a.s));

  const upcoming = rows.filter(x => x.s.date >= today && (x.b.status === 'booked' || x.b.status === 'waitlist'))
    .sort((a, z) => startsAt(a.s) - startsAt(z.s));
  const past = rows.filter(x => !(x.s.date >= today && (x.b.status === 'booked' || x.b.status === 'waitlist')));

  const label = { booked: ['Attended', ''], cancelled: ['Cancelled', 'good'], late: ['Late cancel', 'warn'],
                  released: ['Class cancelled', 'warn'], waitlist: ['Waitlist', 'warn'] };

  return frag([
    el('h2.display', { style: 'font-size:1.2rem;margin-bottom:10px', text: 'Upcoming' }),
    upcoming.length
      ? el('div.grid', null, upcoming.map(({ b, s }) => slotRow(ctx, s, { booking: b })))
      : el('p.muted', { text: 'Nothing booked.' }),
    el('h2.display', { style: 'font-size:1.2rem;margin:28px 0 10px', text: 'History' }),
    past.length ? el('div.tablewrap', null, el('table', null, [
      el('thead', null, el('tr', null, [
        el('th', { text: 'Class' }), el('th', { text: 'When' }), el('th', { text: 'Instructor' }), el('th', { text: '' })
      ])),
      el('tbody', null, past.slice(0, 20).map(({ b, s }) => {
        const i = state.instructors.find(x => x.id === s.instructorId);
        const [txt, tone] = label[b.status] || ['—', ''];
        return el('tr', null, [
          el('td', null, [dot(s.typeId), ' ', typeName(s.typeId)]),
          el('td.num', { text: shortDate(s.date) + ' · ' + range(s) }),
          el('td', { text: i ? i.name : '—' }),
          el('td.right', null, chip(txt, tone))
        ]);
      }))
    ])) : el('p.muted', { text: 'Nothing yet.' })
  ]);
}

/* ---------- memberships ---------- */
function memberships(ctx, m, expired) {
  const { user, now } = ctx;
  const current = m && !expired ? m.planId : null;

  return frag([
    el('div.plans', null, PLANS.map(p => el('div', { class: 'plan' + (p.id === current ? ' plan--on' : '') }, [
      el('p.eyebrow', { text: p.featured && p.id !== current ? 'Most chosen' : p.id === current ? 'Your membership' : ' ' }),
      el('h3.display', { style: 'font-size:1.5rem', text: p.name }),
      el('p.plan__price', { text: money(p.price) }),
      el('p.muted', { style: 'font-size:13px', text: p.blurb }),
      el('ul', null, p.allowances.map(a => el('li', {
        text: (a.limit == null ? 'Unlimited ' : a.limit + ' ') +
              a.types.map(typeShort).join(' + ') + (a.limit == null ? '' : ' a ' + a.per)
      }))),
      p.id === current
        ? el('button.btn.btn--sm', { type: 'button', disabled: true, text: 'Current plan' })
        : el('button.btn.btn--sm' + (p.featured ? '' : '.btn--ghost'), { type: 'button',
            text: 'Choose ' + p.name, onclick: () => checkout(ctx, p) })
    ]))),
    el('p.muted', { style: 'margin-top:18px;font-size:13px',
      text: 'Memberships run for 30 days from purchase. This is a mockup — no payment is taken.' })
  ]);
}

function checkout(ctx, plan) {
  const { user, now } = ctx;
  const body = el('div', null, [
    el('p.eyebrow', { text: 'You are buying' }),
    el('h3.display', { style: 'font-size:1.6rem;margin:6px 0 4px', text: plan.name }),
    el('p.muted', { text: plan.blurb }),
    el('ul', { class: 'plan', style: 'background:none;border:0;padding:14px 0 0' },
      plan.allowances.map(a => el('li', {
        text: (a.limit == null ? 'Unlimited ' : a.limit + ' ') + a.types.map(typeShort).join(' + ') +
              (a.limit == null ? '' : ' a ' + a.per) }))),
    el('div', { style: 'display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:16px;padding-top:14px' }, [
      el('span', { text: 'Due today' }), el('b', { class: 'num', style: 'font-weight:400', text: money(plan.price) })
    ]),
    el('div.row', { style: 'margin-top:16px' }, [
      el('label.field', null, [el('span', { text: 'Card number' }), el('input', { value: '4242 4242 4242 4242', readonly: true })]),
      el('label.field', null, [el('span', { text: 'Expiry' }), el('input', { value: '04 / 29', readonly: true })])
    ]),
    el('p.muted', { style: 'font-size:12.5px', text: 'Demo checkout — the card details are filled in for you and nothing is charged.' })
  ]);

  modal('Checkout', body, [
    el('button.btn.btn--ghost', { type: 'button', text: 'Back', onclick: closeModal }),
    el('button.btn', { type: 'button', text: 'Pay ' + money(plan.price), onclick: () => {
      store.purchaseMembership(user.id, plan.id, now);
      closeModal();
      location.hash = '#/';
      toast(plan.name + ' active — your calendar is unlocked');
    } })
  ]);
}
