/* The client side: simple, visual, never showing the arithmetic — and
   made for a phone, because that is where she books from. */
import { el, frag, chip, dot, modal, closeModal, toast, meter, money, typeName, typeShort, range, niceDate,
         relDay, shortDate, startsAt, t, tw } from '../ui.js';
import * as store from '../store.js';
import { iso, addDays } from '../../../shared/domain.js';
import { balances, canBook, canCancel, cancelDeadline, spots, membershipOf, isExpired,
         planOf, bookingOf, BOOKING_HORIZON_DAYS } from '../../../shared/rules.js';
import { shell } from './shell.js';

export function renderClient(ctx) {
  const { user, state, now, route } = ctx;
  const m = membershipOf(state, user.id);
  const expired = isExpired(m, now);

  const nav = [
    ['#/', 'Today', null, 'home'],
    ['#/calendar', 'Book', null, 'calendar'],
    ['#/mine', 'My classes', null, 'list'],
    ['#/memberships', 'Membership', null, 'card']
  ];

  let title = 'Today', sub = '', body;
  if (route === 'calendar') { title = 'Book a class'; sub = t('The next %s days', BOOKING_HORIZON_DAYS); body = calendar(ctx, m, expired); }
  else if (route === 'mine') { title = 'My classes'; body = mine(ctx); }
  else if (route === 'memberships') { title = 'Membership'; sub = 'What you have, and what the studio offers'; body = memberships(ctx, m, expired); }
  else { title = t('Hello, %s', firstName(user.name)); sub = niceDate(iso(now)); body = home(ctx, m, expired); }

  return shell({ user, route, nav, title, sub, body, notices: state.notices });
}

const firstName = full => String(full || '').trim().split(/\s+/)[0] || '';

/* A button that goes to the server: disable it, say what happened. */
async function run(btn, fn, good) {
  btn.disabled = true; const was = btn.textContent; btn.textContent = t('One moment…');
  try { await fn(); toast(good); }
  catch (e) { toast(e.message); btn.disabled = false; btn.textContent = was; }
}

/* ---------- membership card ---------- */
function membershipCard(ctx, m, expired) {
  const { state, user, now } = ctx;
  const plan = m && planOf(state, m.planId);
  if (!m || m.status !== 'active' || !plan) {
    return el('div.card', null, [
      el('p.eyebrow', { text: 'No membership' }),
      el('h3.display', { style: 'font-size:1.4rem;margin:8px 0 8px', text: 'Ask at the studio to start one' }),
      el('p.muted.small', { style: 'margin-bottom:14px', text: 'Pay at the desk and we link it to your account. It shows here straight away and you can book.' }),
      el('a.btn.btn--sm.btn--ghost', { href: '#/memberships', text: 'See the packages' })
    ]);
  }
  const rows = expired ? [] : balances(state, user.id, now);
  return el('div.card', null, [
    el('div', { style: 'display:flex;justify-content:space-between;gap:14px;align-items:flex-start' }, [
      el('div', { style: 'min-width:0' }, [
        el('p.eyebrow', { text: 'Your membership' }),
        el('h3.display', { style: 'font-size:1.6rem;margin-top:6px', text: plan.name })
      ]),
      expired ? chip('Expired', 'bad') : chip('Active', 'good')
    ]),
    rows.length ? el('div.grid', { style: 'margin-top:16px' }, rows.map(b =>
      el('div', null, [
        el('div', { style: 'display:flex;justify-content:space-between;gap:12px;font-size:14.5px' }, [
          el('span', { text: b.label }),
          el('b', { style: 'font-weight:400', class: 'num',
            text: b.unlimited ? t('Unlimited') : t(b.left === 1 ? 'One left this %s' : '%s left this %s', b.left === 1 ? tw(b.per) : b.left, tw(b.per)) })
        ]),
        b.unlimited ? null : meter(b.used, b.allowance.limit)
      ]))) : null,
    el('p.muted.small', { style: 'margin-top:14px', text: t(expired ? 'Expired %s' : 'Valid until %s', niceDate(m.end)) }),
    expired ? el('p.small', { style: 'margin-top:6px', text: 'Renew it at the studio and it is linked here again straight away.' }) : null
  ]);
}

/* ---------- today ---------- */
function home(ctx, m, expired) {
  const { state, user, now } = ctx;
  const today = iso(now);
  const upcoming = state.bookings
    .filter(b => b.clientId === user.id && (b.status === 'booked' || b.status === 'waitlist'))
    .map(b => ({ b, s: state.classes.find(x => x.id === b.classId) }))
    .filter(x => x.s && !x.s.cancelled && startsAt(x.s) > now)
    .sort((a, z) => startsAt(a.s) - startsAt(z.s));

  const todays = state.classes.filter(s => s.date === today && !s.cancelled && startsAt(s) > now)
    .sort((a, b) => a.start.localeCompare(b.start));

  return frag([
    el('div.split', null, [
      membershipCard(ctx, m, expired),
      el('div.card', null, [
        el('p.eyebrow', { text: 'Next up' }),
        upcoming.length
          ? el('div.grid', { style: 'margin-top:12px' }, upcoming.slice(0, 3).map(({ b, s }) => slotRow(ctx, s, { booking: b, withDay: true })))
          : el('p.muted', { style: 'margin-top:10px', text: 'Nothing booked yet.' }),
        el('a.btn.btn--sm' + (upcoming.length ? '.btn--ghost' : ''), { href: '#/calendar', style: 'margin-top:16px',
          text: upcoming.length ? 'Book another' : 'Book a class' })
      ])
    ]),
    el('h2.section-title', { text: 'Still to come today' }),
    todays.length ? el('div.grid', null, todays.map(s => slotRow(ctx, s, {})))
                  : el('p.empty', { text: 'Nothing else on today.' })
  ]);
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
    action = [chip('Booked', 'good'),
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Cancel', onclick: () => confirmCancel(ctx, existing, s) })];
  } else if (waiting) {
    action = [chip('On waitlist', 'warn'),
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Leave', onclick: e => run(e.currentTarget, () => store.cancelBooking(existing.id), 'You left the waitlist') })];
  } else {
    const v = canBook(state, user.id, s, now);
    if (v.ok) {
      action = el('button.btn.btn--sm', { type: 'button', text: 'Book class',
        onclick: e => run(e.currentTarget, () => store.book(s.id), 'Booked — see you there') });
    } else if (v.code === 'full') {
      action = el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Join waitlist',
        onclick: e => run(e.currentTarget, () => store.joinWaitlist(s.id), 'You are on the waitlist') });
    } else if (v.code === 'not-included' || v.code === 'no-membership' || v.code === 'expired') {
      action = [el('span.slot__note', { text: v.message }),
        el('a.btn.btn--ghost.btn--sm', { href: '#/memberships', text: 'Membership' })];
    } else {
      /* Nothing to press: a quiet line reads better than a dead button. */
      action = el('span.slot__note', { text: v.message });
    }
  }

  return el('div', {
    class: 'slot slot--' + s.typeId + (cap.full && !mine ? ' slot--full' : '') + (mine ? ' slot--mine' : '')
  }, [
    el('span.slot__time.num', { text: (o.withDay ? relDay(s.date, now) + ' · ' : '') + range(s) }),
    el('span.slot__name', null, [dot(s.typeId), typeName(s.typeId)]),
    el('span.slot__cap.num', { text: cap.full ? t('Full') : t(cap.left === 1 ? '%s place left' : '%s places left', cap.left) }),
    el('span.slot__who', { text: instr ? t('with %s', instr.name.split(' ')[0]) : t('To be confirmed') }),
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
        ? t('Free cancellation until %s. Your session goes straight back to your balance.', hh)
        : t('The %s deadline has passed. This class will still count against your membership.', hh) })
  ]), [
    el('button.btn.btn--ghost', { type: 'button', text: 'Keep it', onclick: closeModal }),
    el('button.btn', { type: 'button', text: cc.ok ? 'Cancel class' : 'Cancel anyway', onclick: async e => {
      e.currentTarget.disabled = true;
      try {
        const r = await store.cancelBooking(booking.id);
        closeModal();
        toast(r.late ? 'Cancelled — the session stays deducted' : 'Cancelled — session returned');
      } catch (ex) { closeModal(); toast(ex.message); }
    } })
  ]);
}

/* ---------- calendar ----------
   A strip of the days ahead to thumb along, and the days themselves
   underneath; tapping a day in the strip brings it up. */
function calendar(ctx, m, expired) {
  const { state, now } = ctx;
  const days = Array.from({ length: BOOKING_HORIZON_DAYS + 1 }, (_, i) => iso(addDays(now, i)));
  const byDay = d => state.classes.filter(s => s.date === d && !s.cancelled && startsAt(s) > now)
    .sort((a, b) => a.start.localeCompare(b.start));

  const strip = el('div.daystrip', { role: 'tablist', 'aria-label': 'Days' });
  const sections = [];
  days.forEach((d, i) => {
    const list = byDay(d);
    const [wd, n] = shortDate(d).split(' ');
    const btn = el('button', { type: 'button', class: (i === 0 ? 'is-on' : '') + (list.length ? '' : ' is-empty'),
      'aria-label': relDay(d, now), onclick: () => {
        strip.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === btn));
        const target = document.getElementById('day-' + d);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } }, [el('span', { text: i === 0 ? t('Today') : wd }), el('b', { text: n })]);
    strip.appendChild(btn);
    if (list.length) sections.push(el('section.day', { id: 'day-' + d }, [
      el('h2', { text: relDay(d, now) }),
      el('div.grid', null, list.map(s => slotRow(ctx, s, { m, expired })))
    ]));
  });

  return frag([
    strip,
    sections.length ? el('div.grid', { style: 'gap:26px' }, sections)
                    : el('p.empty', { text: 'Nothing on the timetable for the coming days yet.' })
  ]);
}

/* ---------- my classes ---------- */
function mine(ctx) {
  const { state, user, now } = ctx;
  const rows = state.bookings.filter(b => b.clientId === user.id)
    .map(b => ({ b, s: state.classes.find(x => x.id === b.classId) }))
    .filter(x => x.s);

  const live = x => startsAt(x.s) > now && !x.s.cancelled && (x.b.status === 'booked' || x.b.status === 'waitlist');
  const upcoming = rows.filter(live).sort((a, z) => startsAt(a.s) - startsAt(z.s));
  const past = rows.filter(x => !live(x)).sort((a, z) => startsAt(z.s) - startsAt(a.s));

  const label = { booked: ['Attended', ''], cancelled: ['Cancelled', ''], late: ['Late cancel', 'warn'],
                  released: ['Class cancelled', 'warn'], waitlist: ['Did not get a place', ''] };

  return frag([
    el('h2.section-title', { style: 'margin-top:0', text: 'Upcoming' }),
    upcoming.length
      ? el('div.grid', null, upcoming.map(({ b, s }) => slotRow(ctx, s, { booking: b, withDay: true })))
      : el('div', null, [el('p.empty', { style: 'padding-bottom:12px', text: 'Nothing booked.' }),
          el('a.btn.btn--sm', { href: '#/calendar', text: 'Book a class' })]),
    el('h2.section-title', { text: 'History' }),
    past.length ? el('div.grid', { style: 'gap:8px' }, past.slice(0, 30).map(({ b, s }) => {
      const i = state.instructors.find(x => x.id === s.instructorId);
      const [txt, tone] = label[b.status] || ['—', ''];
      return el('div', { class: 'slot slot--' + s.typeId, style: 'opacity:.9' }, [
        el('span.slot__time.num', { text: shortDate(s.date) + ' · ' + range(s) }),
        el('span.slot__name', null, [dot(s.typeId), typeName(s.typeId)]),
        el('span.slot__who', { text: i ? t('with %s', i.name.split(' ')[0]) : '' }),
        el('span.slot__act', null, chip(txt, tone))
      ]);
    })) : el('p.empty', { text: 'Nothing yet.' })
  ]);
}

/* ---------- memberships ----------
   Read only. Memberships are arranged at the desk — she pays there and the
   studio links it to her account — so this page says what she has, what
   the studio offers, and how to get it. A package arrives without its
   price while the studio is holding them back, so the price line says so. */
const priceText = p => p.price == null ? 'Price coming soon' : money(p.price);

function memberships(ctx, m, expired) {
  const { state } = ctx;
  const PLANS = state.plans || [];
  const current = m && !expired && m.status === 'active' ? m.planId : null;

  return frag([
    membershipCard(ctx, m, expired),
    el('div.howto', null, [
      el('b', { text: 'How to get one' }),
      el('span', { text: 'Choose a package below and tell us at the studio. Pay at the desk and we link it to your account — it shows here straight away and you can start booking.' })
    ]),
    el('h2.section-title', { text: 'Packages at DUA' }),
    PLANS.length ? el('div.plans', null, PLANS.map(p => el('div', { class: 'plan' + (p.id === current ? ' plan--on' : '') }, [
      p.id === current ? el('p.eyebrow', { text: 'Your membership' }) : p.featured ? el('p.eyebrow', { text: 'Most chosen' }) : null,
      el('h3', { text: p.name }),
      el('p', { class: 'plan__price' + (p.price == null ? ' plan__price--soon' : ''), text: priceText(p) }),
      p.blurb ? el('p.muted.small', { text: p.blurb }) : null,
      el('ul', null, p.allowances.map(a => el('li', {
        text: a.limit == null ? t('Unlimited %s', a.types.map(typeShort).join(' + '))
                              : t('%s %s a %s', a.limit, a.types.map(typeShort).join(' + '), tw(a.per))
      })))
    ]))) : el('p.empty', { text: 'The packages go up here soon.' })
  ]);
}
