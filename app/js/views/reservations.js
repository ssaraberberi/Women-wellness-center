/* ============================================================
   DUA — the desk: reservations, offers, the weekly schedule and
   the studio's own rules.

   Everything here is a view of what the server holds, and every
   action goes back to the server and re-reads. The screens predict
   so they can warn early — a full class, a deadline passed — but
   the server is the one that decides.
   ============================================================ */
import { el, frag, chip, dot, modal, closeModal, toast, field, input, select, money, typeName, typeShort,
         range, niceDate, shortDate, dayMonth, t, icon, datatable, jobLabel, touch } from '../ui.js';
import * as store from '../store.js';
import { todayIn, plusDays, weekdayOf, minutes, clockIn, WEEK_ORDER } from '../../../shared/domain.js';
import { spots, creditSummary, creditLines, settingsOf, packagesOf, validOn } from '../../../shared/rules.js';

const STATUS_TONE = { pending: 'warn', confirmed: 'good', completed: '', cancelled: 'bad' };
const statusChip = s => chip(s.charAt(0).toUpperCase() + s.slice(1), STATUS_TONE[s]);
const payChip = p => chip(p === 'paid' ? 'Paid' : 'Unpaid', p === 'paid' ? 'good' : 'warn');
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const telLink = phone => phone ? el('a.linkish', { href: 'tel:' + String(phone).replace(/[^\d+]/g, ''), text: phone }) : null;
const fail = (box, msg) => { box.textContent = t(msg); box.hidden = false; box.scrollIntoView({ block: 'nearest' }); };

/* ================================================================
   Reservations
   ================================================================ */
let resMode = 'list';
let resDay = null;
const resFilter = { q: '', status: '', payment: '', offer: '', staff: '' };

export function reservationsView(ctx) {
  const { state, now } = ctx;
  if (!resDay) resDay = todayIn(now);

  const modes = el('div.switchbar', { role: 'group', 'aria-label': 'View' }, [['list', 'List'], ['day', 'Day']].map(([m, label]) =>
    el('button', { type: 'button', class: resMode === m ? 'is-on' : null, 'aria-pressed': resMode === m ? 'true' : 'false', text: label,
      onclick: () => { resMode = m; ctx.go(location.hash); } })));
  return frag([el('div.toolbar', null, [modes]), resMode === 'day' ? dayView(ctx) : listView(ctx)]);
}

/* ---------- the list ---------- */
function listView(ctx) {
  const { state } = ctx;
  const list = state.reservations || [];
  const offers = state.offers || [];
  const host = el('div');

  const draw = () => {
    const q = resFilter.q.trim().toLowerCase();
    const rows = list.filter(r =>
      (!resFilter.status || r.status === resFilter.status) &&
      (!resFilter.payment || r.payment === resFilter.payment) &&
      (!resFilter.offer || (resFilter.offer === '-' ? !r.offerId : r.offerId === resFilter.offer)) &&
      (!q || [r.ref, r.title].concat(r.people.flatMap(p => [p.name, p.phone])).some(v => String(v || '').toLowerCase().includes(q))));
    host.textContent = '';
    host.appendChild(datatable([
      { label: 'Reservation' }, { label: 'Package' }, { label: 'Classes', cls: 'right' },
      { label: 'Total', cls: 'right' }, { label: 'Status', cls: 'right' }, { label: 'Payment', cls: 'right' }, { label: '', cls: 'right' }
    ], rows.map(r => {
      const pkgs = (state.memberships || []).filter(m => m.reservationId === r.id);
      const sums = pkgs.map(m => creditSummary(state, m));
      const used = sums.reduce((n, s) => n + s.used, 0);
      const total = sums.some(s => s.unlimited) ? '∞' : sums.reduce((n, s) => n + s.total, 0);
      return [
        [el('div', null, [el('b', { text: r.people.map(p => p.name).join(' & ') || '—' })]),
         el('div.cell-sub', { text: r.ref + ' · ' + r.people.map(p => p.phone).filter(Boolean).join(', ') })],
        el('span.small', { text: r.title }),
        el('span.num', { text: pkgs.length ? used + ' / ' + total : '—' }),
        el('span.num', { text: r.totalPrice == null ? '—' : money(r.totalPrice) }),
        statusChip(r.status),
        payChip(r.payment),
        el('div.rowend', null, el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Open', onclick: () => reservationSheet(ctx, r.id) }))
      ];
    }), list.length ? 'Nothing matches those filters.' : 'No reservations yet. They appear here as soon as someone books on the website.'));
  };

  const filters = el('div.filters', null, [
    el('input.input', { type: 'search', value: resFilter.q, placeholder: 'Name, phone or reference', 'aria-label': 'Search reservations',
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', oninput: e => { resFilter.q = e.target.value; draw(); } }),
    filterSelect('Status', resFilter, 'status', [['', 'All statuses'], ['pending', 'Pending'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['cancelled', 'Cancelled']], draw),
    filterSelect('Payment', resFilter, 'payment', [['', 'Paid and unpaid'], ['unpaid', 'Unpaid'], ['paid', 'Paid']], draw),
    filterSelect('Offer', resFilter, 'offer', [['', 'All offers'], ['-', 'No offer']].concat(offers.map(o => [o.id, o.title])), draw)
  ]);
  draw();
  return frag([filters, host]);
}

function filterSelect(label, obj, key, opts, onChange) {
  const s = el('select.input.select', { 'aria-label': label, onchange: e => { obj[key] = e.target.value; onChange(); } },
    opts.map(([v, l]) => el('option', { value: v, selected: obj[key] === v, text: l })));
  return s;
}

/* ---------- a day at the desk ---------- */
function dayView(ctx) {
  const { state, now } = ctx;
  const move = n => { resDay = plusDays(resDay, n); ctx.go(location.hash); };
  const staff = state.instructors.filter(i => i.active);

  const bar = el('div.toolbar', null, [
    el('input.input', { type: 'date', value: resDay, style: 'max-width:190px', 'aria-label': 'Date',
      onchange: e => { if (e.target.value) { resDay = e.target.value; ctx.go(location.hash); } } }),
    filterSelect('Employee', resFilter, 'staff', [['', 'Everyone']].concat(staff.map(i => [i.id, i.name])), () => ctx.go(location.hash)),
    el('div.toolbar__nav', null, [
      el('span.toolbar__label', { text: niceDate(resDay) }),
      el('button.iconbtn', { type: 'button', 'aria-label': 'Previous', onclick: () => move(-1) }, icon('left')),
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Today', onclick: () => { resDay = todayIn(now); ctx.go(location.hash); } }),
      el('button.iconbtn', { type: 'button', 'aria-label': 'Next', onclick: () => move(1) }, icon('right'))
    ])
  ]);

  const closed = (state.closures || []).find(c => c.date === resDay);
  const classes = state.classes.filter(k => k.date === resDay && (!resFilter.staff || k.instructorId === resFilter.staff))
    .sort((a, b) => a.start.localeCompare(b.start));

  return frag([
    bar,
    closed ? el('div.notice.notice--warn', { style: 'margin-bottom:14px' }, [el('span', { text: t('The studio is closed this day') + (closed.reason ? ' — ' + closed.reason : '') })]) : null,
    classes.length ? el('div.grid', null, classes.map(k => classCard(ctx, k)))
      : el('p.empty', { text: t('Nothing on %s', niceDate(resDay)) })
  ]);
}

/* One class, as the desk needs it: who is in, whether they came, and
   what can be done about each of them. */
function classCard(ctx, k) {
  const { state, now } = ctx;
  const cap = spots(state, k);
  const who = state.instructors.find(i => i.id === k.instructorId);
  const roster = state.bookings.filter(b => b.classId === k.id && b.status === 'booked');
  const started = k.date <= todayIn(now);   // from the day of the class, attendance can be marked
  const client = id => state.clients.find(c => c.id === id) || {};
  const resv = id => (state.reservations || []).find(r => r.id === id);

  return el('div', { class: 'desk' + (k.cancelled ? ' desk--off' : '') }, [
    el('div.desk__head', null, [
      el('div', null, [
        el('b.desk__time.num', { text: range(k) }),
        el('span.desk__what', null, [dot(k.typeId), typeName(k.typeId), who ? ' · ' + who.name : ' · ' + t('Nobody assigned')])
      ]),
      el('div.desk__cap', null, [
        el('span.num', { text: cap.taken + ' / ' + k.capacity }),
        cap.blocked ? chip(t('%s blocked', cap.blocked)) : null,
        k.cancelled ? chip('Cancelled', 'bad') : cap.full ? chip('Full', 'wine') : null
      ])
    ]),
    roster.length ? el('ul.desk__list', null, roster.map(b => {
      const c = client(b.clientId);
      const r = resv(b.reservationId);
      return el('li', null, [
        el('span.avatar', { 'aria-hidden': 'true', text: initials(c.name) }),
        el('div.desk__who', null, [
          el('b', { text: c.name || '—' }),
          el('span', null, [telLink(c.phone), r ? ' · ' + r.ref : null])
        ]),
        r ? payChip(r.payment) : null,
        started && !k.cancelled ? el('div.attn', { role: 'group', 'aria-label': 'Attendance' }, [
          el('button', { type: 'button', class: b.attendance === 'attended' ? 'is-on is-good' : null, 'aria-pressed': b.attendance === 'attended' ? 'true' : 'false',
            title: 'Attended', 'aria-label': 'Attended', onclick: () => mark(b, b.attendance === 'attended' ? null : 'attended') }, icon('check')),
          el('button', { type: 'button', class: b.attendance === 'noshow' ? 'is-on is-bad' : null, 'aria-pressed': b.attendance === 'noshow' ? 'true' : 'false',
            title: 'No-show', 'aria-label': 'No-show', onclick: () => mark(b, b.attendance === 'noshow' ? null : 'noshow') }, icon('close'))
        ]) : null,
        b.reservationId ? el('button.iconbtn', { type: 'button', 'aria-label': 'Open', onclick: () => reservationSheet(ctx, b.reservationId) }, icon('more')) : null
      ]);
    })) : el('p.small.muted', { style: 'padding:6px 0 2px', text: k.cancelled ? '' : 'Nobody booked yet.' }),
    k.cancelled ? null : el('div.desk__foot', null, [
      el('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => addToClass(ctx, k) }, [icon('plus'), el('span', { text: 'Add someone' })]),
      el('div.stepper', { role: 'group', 'aria-label': 'Blocked places' }, [
        el('button', { type: 'button', 'aria-label': 'Block one place less', disabled: !cap.blocked, onclick: () => block(k, cap.blocked - 1) }, '−'),
        el('span', { text: t('%s blocked', cap.blocked) }),
        el('button', { type: 'button', 'aria-label': 'Block one more place', disabled: cap.left <= 0, onclick: () => block(k, cap.blocked + 1) }, '+')
      ])
    ])
  ]);

  async function mark(b, v) {
    try { await store.attendance(b.id, v); toast(v === 'attended' ? 'Marked as attended' : v === 'noshow' ? 'Marked as no-show — the class counts as used' : 'Attendance cleared'); }
    catch (e) { toast(e.message); }
  }
  async function block(k, n) {
    try { await store.blockPlaces(k.id, n); } catch (e) { toast(e.message); }
  }
}

/* Booking somebody into this class from a package she already holds — or,
   if she has none, starting a new reservation with the class in it. */
function addToClass(ctx, k) {
  const { state, now } = ctx;
  const body = el('div');
  const err = el('p.notice.notice--bad', { hidden: true });
  const pickWho = clientPicker(state, c => {
    body.textContent = '';
    const pkgs = packagesOf(state, c.id, now).filter(m => validOn(m, k.date) &&
      creditLines(state, m).some(l => l.types.includes(k.typeId) && l.left > 0));
    body.appendChild(el('div.picked', null, [el('span.avatar', { text: initials(c.name) }),
      el('div', null, [el('b', { text: c.name }), el('span', { text: c.phone || c.email || '' })])]));
    if (!pkgs.length) {
      body.appendChild(el('p.muted', { style: 'margin-bottom:14px', text: 'She has no package with a class left for this date.' }));
      body.appendChild(el('button.btn', { type: 'button', text: 'New reservation for her', onclick: () => newReservation(ctx, { client: c, classIds: [k.id] }) }));
      return;
    }
    body.appendChild(el('div.sugg', null, pkgs.map(m => {
      const s = creditSummary(state, m);
      return el('button', { type: 'button', onclick: async ev => {
        ev.currentTarget.disabled = true;
        try { await store.bookInto({ membershipId: m.id, classIds: [k.id] }); closeModal(); toast(t('%s is booked', c.name)); }
        catch (ex) { ev.currentTarget.disabled = false; fail(err, ex.message); }
      } }, [el('span.sugg__who', null, [el('b', { text: m.title }),
        el('small', { text: (s.unlimited ? '∞' : t('%s left', s.left)) + ' · ' + t('until %s', dayMonth(m.end)) })]), icon('right')]);
    })));
    body.appendChild(err);
  });
  body.appendChild(pickWho);
  modal(t('Add to %s', range(k) + ' · ' + shortDate(k.date)), body, [
    el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }),
    el('button.btn', { type: 'button', text: 'New reservation', onclick: () => newReservation(ctx, { classIds: [k.id] }) })
  ]);
}

/* ---------- picking a client ---------- */
export function clientPicker(state, onPick, opts) {
  const box = el('div.picker');
  const list = el('div.picker__list', { role: 'listbox', 'aria-label': 'Clients' });
  const search = el('input', { type: 'search', placeholder: 'Search by name, email or phone', 'aria-label': 'Find a client',
    autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'search' });
  const fill = () => {
    const q = search.value.trim().toLowerCase();
    const digits = q.replace(/\D+/g, '');
    const hits = state.clients.filter(c => !q || [c.name, c.email].some(v => String(v || '').toLowerCase().includes(q)) ||
      (digits.length >= 3 && String(c.phone || '').replace(/\D+/g, '').includes(digits))).slice(0, 50);
    list.textContent = '';
    if (!hits.length) list.appendChild(el('p.picker__none', { text: state.clients.length ? 'No client matches that.' : 'No clients yet.' }));
    hits.forEach(c => list.appendChild(el('button', { type: 'button', role: 'option', onclick: () => onPick(c) }, [
      el('span.avatar', { 'aria-hidden': 'true', text: initials(c.name) }),
      el('div', null, [el('b', { text: c.name }), el('span', { text: [c.phone, c.email].filter(Boolean).join(' · ') })])
    ])));
  };
  search.addEventListener('input', fill);
  fill();
  box.appendChild(el('div.picker__search', null, [icon('search'), search]));
  box.appendChild(list);
  if (!touch() && !(opts && opts.noFocus)) setTimeout(() => search.focus(), 0);
  return box;
}

/* ---------- picking classes ----------
   A date, the classes that day with the places left, and the ones chosen
   so far across every date. */
function classPicker(ctx, opts) {
  const { state, now } = ctx;
  const st = settingsOf(state);
  const chosen = opts.selected;
  let date = opts.date || (todayIn(now) > st.openingDate ? todayIn(now) : st.openingDate);
  const box = el('div.cpick');
  const draw = () => {
    box.textContent = '';
    const dateIn = el('input.input', { type: 'date', value: date, 'aria-label': 'Date', onchange: e => { if (e.target.value) { date = e.target.value; draw(); } } });
    box.appendChild(el('div.cpick__bar', null, [
      el('button.iconbtn', { type: 'button', 'aria-label': 'Previous', onclick: () => { date = plusDays(date, -1); draw(); } }, icon('left')),
      dateIn,
      el('button.iconbtn', { type: 'button', 'aria-label': 'Next', onclick: () => { date = plusDays(date, 1); draw(); } }, icon('right'))
    ]));
    const list = state.classes.filter(k => k.date === date && !k.cancelled && (!opts.types || opts.types.includes(k.typeId)))
      .sort((a, b) => a.start.localeCompare(b.start));
    if (!list.length) box.appendChild(el('p.picker__none', { text: t('Nothing on %s', niceDate(date)) }));
    list.forEach(k => {
      const cap = spots(state, k);
      const on = chosen.has(k.id);
      const room = cap.left >= (opts.seats || 1);
      const full = !on && (!room || (opts.max != null && chosen.size >= opts.max));
      box.appendChild(el('label', { class: 'cpick__row' + (full ? ' is-off' : '') }, [
        el('input', { type: 'checkbox', checked: on, disabled: full, onchange: e => { if (e.target.checked) chosen.add(k.id); else chosen.delete(k.id); draw(); if (opts.onChange) opts.onChange(); } }),
        el('span.num', { text: range(k) }),
        el('span', { style: 'flex:1', text: typeShort(k.typeId) }),
        el('span.small.muted', { text: cap.left > 0 ? t('%s left', cap.left) : t('Full') })
      ]));
    });
    if (chosen.size) box.appendChild(el('p.small', { style: 'margin-top:10px', text: t('%s chosen', chosen.size) + ': ' +
      [...chosen].map(id => state.classes.find(k => k.id === id)).filter(Boolean)
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).map(k => dayMonth(k.date) + ' ' + k.start).join(', ') }));
  };
  draw();
  return box;
}

/* ---------- one reservation ---------- */
export async function reservationSheet(ctx, id) {
  let v;
  try { v = await store.reservation(id); } catch (e) { toast(e.message); return; }
  const host = el('div');
  const err = el('p.notice.notice--bad', { hidden: true });

  const run = async (fn, good) => {
    err.hidden = true;
    try { const out = await fn(); if (out && out.ref) v = out; toast(good); draw(); }
    catch (e) { fail(err, e.message); }
  };

  function draw() {
    host.textContent = '';
    const now = new Date();
    host.appendChild(el('div.res__top', null, [
      el('div', null, [el('p.eyebrow', { text: v.ref + ' · ' + shortDate(String(v.createdAt).slice(0, 10)) }), el('h3.display', { style: 'font-size:1.45rem;margin-top:4px', text: v.title })]),
      el('div.chips', null, [statusChip(v.status), payChip(v.payment)])
    ]));

    host.appendChild(el('div.res__block', null, [
      el('p.eyebrow', { text: 'Status' }),
      el('div.segbtns', null, ['pending', 'confirmed', 'completed', 'cancelled'].map(s =>
        el('button', { type: 'button', class: v.status === s ? 'is-on' : null, 'aria-pressed': v.status === s ? 'true' : 'false',
          text: s.charAt(0).toUpperCase() + s.slice(1),
          onclick: () => s === v.status ? null : s === 'cancelled' ? confirmCancel() : run(() => store.updateReservation(v.id, { status: s }), 'Saved') }))),
      el('p.eyebrow', { style: 'margin-top:16px', text: 'Payment' }),
      el('div.segbtns', null, [['unpaid', 'Unpaid'], ['paid', 'Paid']].map(([p, l]) =>
        el('button', { type: 'button', class: v.payment === p ? 'is-on' : null, 'aria-pressed': v.payment === p ? 'true' : 'false', text: l,
          onclick: () => p === v.payment ? null : run(() => store.updateReservation(v.id, { payment: p }), p === 'paid' ? 'Marked as paid' : 'Marked as unpaid') }))),
      el('dl.res__money', null, [
        v.unitPrice != null ? frag([el('dt', { text: v.persons > 1 ? 'Per person' : 'Price' }),
          el('dd.num', null, [v.originalPrice ? el('s.muted', { text: money(v.originalPrice) + ' ' }) : null, money(v.unitPrice),
            v.discountPct ? ' (−' + v.discountPct + '%)' : null])]) : null,
        el('dt', { text: 'Total' }), el('dd.num', { text: v.totalPrice == null ? '—' : money(v.totalPrice) })
      ])
    ]));

    v.people.forEach((p, i) => {
      host.appendChild(el('div.res__block', null, [
        el('div.res__person', null, [
          el('span.avatar', { 'aria-hidden': 'true', text: initials(p.name) }),
          el('div', { style: 'flex:1;min-width:0' }, [el('b', { text: p.name }), el('div.cell-sub', null, [telLink(p.phone), p.email ? ' · ' + p.email : null])]),
          p.status !== 'active' ? chip(p.status, 'bad') : p.expired ? chip('Expired', 'warn') : null
        ]),
        el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 8px' }, [
          el('span.small.muted', { text: t('Valid %s – %s', dayMonth(p.start), dayMonth(p.end)) }),
          el('button.linkish', { type: 'button', text: 'Change dates', onclick: () => datesDialog(p) })
        ]),
        ...p.lines.map(l => el('div.credit', null, [
          el('span', { text: l.label }),
          el('span.num', { text: l.total == null ? '∞' : t('%s used of %s', l.used, l.total) + (l.adjust ? ' (' + (l.adjust > 0 ? '+' : '') + l.adjust + ')' : '') }),
          el('div.stepper', { role: 'group', 'aria-label': 'Credits' }, [
            el('button', { type: 'button', 'aria-label': 'Remove a class', disabled: l.total == null,
              onclick: () => run(() => store.adjustCredits(p.membershipId, { line: l.index, delta: -1 }), 'One class removed') }, '−'),
            el('span', { text: l.total == null ? '∞' : t('%s left', l.left) }),
            el('button', { type: 'button', 'aria-label': 'Add a class', disabled: l.total == null,
              onclick: () => run(() => store.adjustCredits(p.membershipId, { line: l.index, delta: 1, reason: 'added at the desk' }), 'One class added') }, '+')
          ])
        ])),
        p.status === 'active' ? el('button.btn.btn--ghost.btn--sm', { type: 'button', style: 'margin-top:10px',
          onclick: () => addClasses(p) }, [icon('plus'), el('span', { text: v.together && v.people.length > 1 ? 'Book classes for both' : 'Book classes' })]) : null
      ]));
    });
    if (v.friend) host.appendChild(el('div.res__block', null, [el('p.eyebrow', { text: 'Friend' }),
      el('p', null, [v.friend.name, ' · ', telLink(v.friend.phone)])]));

    const bookings = v.bookings.filter(b => b.person === 0 || !v.together);
    host.appendChild(el('div.res__block', null, [
      el('p.eyebrow', { text: 'Classes' }),
      bookings.length ? el('ul.res__list', null, bookings.map(b => bookingRow(b))) : el('p.small.muted', { text: 'No classes booked yet.' })
    ]));

    host.appendChild(el('div.res__block', null, [
      field('Notes', el('textarea.input', { rows: 2, maxlength: 500, onchange: e => run(() => store.updateReservation(v.id, { notes: e.target.value }), 'Saved') }, v.notes || '')),
      el('button.linkish', { type: 'button', text: 'Make a new link for her', onclick: () => newLink() })
    ]));
    host.appendChild(err);
  }

  function bookingRow(b) {
    const past = b.started;
    const two = v.together && v.people.length > 1;
    const statusText = b.classCancelled || b.status === 'released' ? 'Cancelled by the studio'
      : b.status === 'cancelled' ? 'Cancelled in time' : b.status === 'late' ? 'Late cancellation'
      : b.attendance === 'attended' ? 'Attended' : b.attendance === 'noshow' ? 'No-show' : past ? 'Not marked' : 'Booked';
    const live = b.status === 'booked' && !b.classCancelled;
    const d = new Date(b.deadline);
    return el('li', { class: live ? null : 'is-off' }, [
      el('div', { style: 'flex:1;min-width:0' }, [
        el('b.num', { text: shortDate(b.date) + ' · ' + b.start + '–' + b.end }),
        el('div.cell-sub', { text: [b.typeName, b.instructor, !v.together && v.people.length > 1 ? v.people[b.person].name : null].filter(Boolean).join(' · ') +
          (live && !past ? ' · ' + t('cancel by %s', clockIn(d)) : '') })
      ]),
      chip(statusText, b.attendance === 'noshow' || b.status === 'late' ? 'warn' : b.attendance === 'attended' ? 'good' : ''),
      live && past ? el('div.attn', null, [
        el('button', { type: 'button', class: b.attendance === 'attended' ? 'is-on is-good' : null, 'aria-label': 'Attended',
          onclick: () => run(() => store.attendance(b.id, b.attendance === 'attended' ? null : 'attended'), 'Saved') }, icon('check')),
        el('button', { type: 'button', class: b.attendance === 'noshow' ? 'is-on is-bad' : null, 'aria-label': 'No-show',
          onclick: () => run(() => store.attendance(b.id, b.attendance === 'noshow' ? null : 'noshow'), 'Saved') }, icon('close'))
      ]) : null,
      live && !past ? el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Move', onclick: () => moveDialog(b) }) : null,
      live && !past ? el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Cancel', onclick: () => cancelBooking(b, two) }) : null,
      (b.status === 'late' || b.attendance === 'noshow') ? el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Give the class back',
        onclick: () => run(() => store.restoreCredit(b.id), 'The class is back in her package') }) : null
    ]);
  }

  function back() { modal(t('Reservation %s', v.ref), host, [el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal })], { wide: true }); draw(); }

  function confirmCancel() {
    const future = v.bookings.filter(b => b.status === 'booked' && !b.started).length;
    modal('Cancel this reservation?', el('div', null, [
      el('p', { text: 'Her packages stop, and every place she holds in a class that has not started is freed.' }),
      future ? el('div.notice.notice--warn', { style: 'margin-top:12px', text: t(future === 1 ? '%s upcoming class will be freed.' : '%s upcoming classes will be freed.', future) }) : null
    ]), [
      el('button.btn.btn--ghost', { type: 'button', text: 'Keep it', onclick: back }),
      el('button.btn', { type: 'button', text: 'Cancel reservation', onclick: async () => {
        try { v = await store.updateReservation(v.id, { status: 'cancelled' }); toast('Reservation cancelled'); } catch (e) { toast(e.message); }
        back();
      } })
    ]);
  }

  function cancelBooking(b, two) {
    const late = new Date() > new Date(b.deadline);
    modal('Cancel this class?', el('div', null, [
      el('p', { text: shortDate(b.date) + ' · ' + b.start + '–' + b.end + ' · ' + b.typeName }),
      two ? el('p.small.muted', { style: 'margin-top:6px', text: 'Only this person’s place is cancelled.' }) : null,
      el('div', { class: 'notice ' + (late ? 'notice--warn' : 'notice--good'), style: 'margin-top:12px',
        text: late ? 'The 30-minute deadline has passed. You can still give the class back.' : 'Cancelled in time: the class goes back to her package.' })
    ]), [
      el('button.btn.btn--ghost', { type: 'button', text: 'Keep it', onclick: back }),
      late ? el('button.btn.btn--ghost', { type: 'button', text: 'Cancel, counts as used', onclick: async () => {
        try { v = await store.cancelFor(b.id, 'keep'); toast('Cancelled — the class counts as used'); } catch (e) { toast(e.message); } back(); } }) : null,
      el('button.btn', { type: 'button', text: 'Cancel, give it back', onclick: async () => {
        try { v = await store.cancelFor(b.id, 'return'); toast('Cancelled — the class is back in her package'); } catch (e) { toast(e.message); } back(); } })
    ]);
  }

  function moveDialog(b) {
    const chosen = new Set();
    const p = v.people[b.person];
    const box = el('div', null, [
      el('p.muted', { style: 'margin-bottom:12px', text: t('Move %s to another class', shortDate(b.date) + ' ' + b.start) }),
      classPicker(ctx, { selected: chosen, date: b.date, types: [b.typeId], max: 1, seats: 1 })
    ]);
    const e2 = el('p.notice.notice--bad', { hidden: true });
    box.appendChild(e2);
    modal('Move to another class', box, [
      el('button.btn.btn--ghost', { type: 'button', text: 'Back', onclick: back }),
      el('button.btn', { type: 'button', text: 'Move', onclick: async () => {
        if (!chosen.size) return fail(e2, 'Pick a class to move to');
        try { v = await store.moveBooking(b.id, [...chosen][0]); toast('Moved — she has been told'); back(); }
        catch (e) { fail(e2, e.message); }
      } })
    ]);
  }

  function addClasses(p) {
    const chosen = new Set();
    const two = v.together && v.people.length > 1;
    const left = p.left == null ? null : p.left;
    const box = el('div', null, [
      el('p.muted', { style: 'margin-bottom:12px', text: left == null ? t('Valid %s – %s', dayMonth(p.start), dayMonth(p.end)) : t('%s left', left) + ' · ' + t('Valid %s – %s', dayMonth(p.start), dayMonth(p.end)) }),
      classPicker(ctx, { selected: chosen, date: p.start > todayIn(new Date()) ? p.start : todayIn(new Date()),
        types: [...new Set(p.lines.flatMap(l => l.types))], max: left, seats: two ? v.people.length : 1 })
    ]);
    const e2 = el('p.notice.notice--bad', { hidden: true });
    box.appendChild(e2);
    modal('Book classes', box, [
      el('button.btn.btn--ghost', { type: 'button', text: 'Back', onclick: back }),
      el('button.btn', { type: 'button', text: 'Book', onclick: async () => {
        if (!chosen.size) return fail(e2, 'Pick at least one class');
        try { v = await store.bookInto({ membershipId: p.membershipId, classIds: [...chosen] }); toast('Booked'); back(); }
        catch (e) { fail(e2, e.message); }
      } })
    ]);
  }

  /* A package's start and end, by hand — an extension, a pause. Classes
     already booked outside the new dates are flagged under Attention. */
  function datesDialog(p) {
    const s = input('start', { type: 'date', value: p.start });
    const e = input('end', { type: 'date', value: p.end });
    const e2 = el('p.notice.notice--bad', { hidden: true });
    modal(t('Dates for %s', p.name), el('div', null, [el('div.row.row--keep', null, [field('Starts', s), field('Ends', e)]), e2]), [
      el('button.btn.btn--ghost', { type: 'button', text: 'Back', onclick: back }),
      el('button.btn', { type: 'button', text: 'Save', onclick: async () => {
        if (!s.value || !e.value || e.value < s.value) return fail(e2, 'The membership has to end after it starts');
        try { await store.updateMembership(p.membershipId, { start: s.value, end: e.value }); v = await store.reservation(v.id); toast('Saved'); back(); }
        catch (ex) { fail(e2, ex.message); }
      } })
    ]);
  }

  async function newLink() {
    try {
      const r = await store.newLink(v.id);
      const url = location.origin + r.path;
      const msg = 'DUA — ' + v.ref + ': ' + url;
      const first = v.people[0];
      const wa = first && first.phone ? 'https://wa.me/' + waNumber(first.phone) + '?text=' + encodeURIComponent(msg) : null;
      modal('A new link for her', el('div', null, [
        el('p', { text: 'Send her this link. It opens her reservation, and the old one no longer works. It is shown only now.' }),
        el('p.fresh', { style: 'font-size:13px;letter-spacing:0', text: url }),
        wa ? el('a.btn.btn--block', { href: wa, target: '_blank', rel: 'noopener', style: 'margin-top:14px', text: 'Send on WhatsApp' }) : null
      ]), [el('button.btn.btn--ghost', { type: 'button', text: 'Back', onclick: back })]);
    } catch (e) { fail(err, e.message); }
  }

  back();
}
const waNumber = phone => { let d = String(phone).replace(/\D+/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '355' + d.slice(1); if (!d.startsWith('355')) d = '355' + d; return d; };

/* ---------- a reservation made at the desk ---------- */
export function newReservation(ctx, preset) {
  const { state, now } = ctx;
  const st = settingsOf(state);
  const pre = preset || {};
  const plans = state.plans || [];
  const today = todayIn(now);
  const offers = (state.offers || []).filter(o => !o.archived);
  const err = el('p.notice.notice--bad', { hidden: true });
  const chosen = new Set(pre.classIds || []);
  let client = pre.client || null;

  const choice = el('select.input.select', { name: 'choice', 'aria-label': 'Package or offer' }, [
    el('option', { value: '', text: t('Choose…') }),
    el('optgroup', { label: t('Packages') }, plans.map(p => el('option', { value: 'p:' + p.id, text: p.name + (p.price != null ? ' · ' + money(p.price) : '') }))),
    offers.length ? el('optgroup', { label: t('Offers') }, offers.map(o => el('option', { value: 'o:' + o.id,
      text: o.title + (o.active ? '' : ' (' + t('inactive') + ')') + (o.kind === 'bundle' && o.price != null ? ' · ' + money(o.price) + (o.persons === 2 ? ' × 2' : '') : '') }))) : null
  ]);
  const planFor = el('select.input.select', { name: 'planFor', 'aria-label': 'Package' }, plans.map(p => el('option', { value: p.id, text: p.name })));
  const planForField = field('Applies to package', planFor);
  const p2 = { name: input('p2name', { autocapitalize: 'words' }), phone: input('p2phone', { type: 'tel', inputmode: 'tel' }) };
  const fr = { name: input('frname', { autocapitalize: 'words' }), phone: input('frphone', { type: 'tel', inputmode: 'tel' }) };
  const second = el('div', null, [el('p.eyebrow.formsection', { text: 'Second person' }), el('div.row', null, [field('Full name', p2.name), field('Phone', p2.phone)])]);
  const friend = el('div', null, [el('p.eyebrow.formsection', { text: 'Her friend' }), el('div.row', null, [field('Full name', fr.name), field('Phone', fr.phone)])]);
  const start = input('start', { type: 'date', value: today > st.openingDate ? today : st.openingDate });
  const status = el('select.input.select', { name: 'status' }, [['confirmed', 'Confirmed'], ['pending', 'Pending']].map(([v, l]) => el('option', { value: v, text: l })));
  const payment = el('select.input.select', { name: 'payment' }, [['unpaid', 'Unpaid'], ['paid', 'Paid']].map(([v, l]) => el('option', { value: v, text: l })));
  const notes = el('textarea.input', { rows: 2, maxlength: 500, name: 'notes' });

  const sel = () => {
    const v = choice.value;
    const offer = v.startsWith('o:') ? offers.find(o => o.id === v.slice(2)) : null;
    const plan = v.startsWith('p:') ? plans.find(p => p.id === v.slice(2)) : (offer && offer.kind !== 'bundle' ? plans.find(p => p.id === planFor.value) : null);
    return { offer, plan };
  };
  const sync = () => {
    const { offer } = sel();
    planForField.hidden = !(offer && offer.kind !== 'bundle');
    second.hidden = !(offer && offer.kind === 'bundle' && offer.persons === 2);
    friend.hidden = !(offer && offer.kind === 'bonus');
  };
  choice.addEventListener('change', sync);

  const who = el('div');
  const p1 = { name: input('p1name', { autocapitalize: 'words' }), phone: input('p1phone', { type: 'tel', inputmode: 'tel' }), email: input('p1email', { type: 'email', inputmode: 'email', autocapitalize: 'off' }) };
  const drawWho = () => {
    who.textContent = '';
    if (client) {
      who.appendChild(el('div.picked', null, [el('span.avatar', { text: initials(client.name) }),
        el('div', null, [el('b', { text: client.name }), el('span', { text: [client.phone, client.email].filter(Boolean).join(' · ') })]),
        el('button.linkish', { type: 'button', text: 'Change', onclick: () => { client = null; drawWho(); } })]));
      return;
    }
    who.appendChild(el('p.small.muted', { style: 'margin-bottom:8px', text: 'An existing client, or a new one below.' }));
    who.appendChild(clientPicker(state, c => { client = c; drawWho(); }, { noFocus: true }));
    who.appendChild(el('div.row', null, [field('Full name', p1.name), field('Phone', p1.phone)]));
    who.appendChild(field('Email (optional)', p1.email));
  };
  drawWho();

  const form = el('form', { novalidate: true, onsubmit: async e => {
    e.preventDefault();
    err.hidden = true;
    const { offer, plan } = sel();
    if (!offer && !plan) return fail(err, 'Choose a package');
    const body = { offerId: offer ? offer.id : null, planId: plan ? plan.id : null, status: status.value, payment: payment.value,
                   start: start.value, notes: notes.value, classIds: [...chosen], people: [] };
    if (client) body.clientId = client.id;
    else body.people.push({ name: p1.name.value, phone: p1.phone.value, email: p1.email.value });
    if (offer && offer.kind === 'bundle' && offer.persons === 2) { if (!body.people.length) body.people.push({}); body.people.push({ name: p2.name.value, phone: p2.phone.value }); }
    if (offer && offer.kind === 'bonus') body.friend = { name: fr.name.value, phone: fr.phone.value };
    save.disabled = true;
    try {
      const r = await store.createReservation(body);
      toast(t('Reservation %s made', r.ref));
      const list = store.get().reservations || [];
      const made = list.find(x => x.ref === r.ref);
      if (made) reservationSheet(ctx, made.id); else closeModal();
    } catch (ex) { save.disabled = false; fail(err, ex.message); }
  } }, [
    el('div.field', null, [el('span', { text: 'Client' }), who]),
    field('Package or offer', choice),
    planForField, second, friend,
    el('div.row.row--keep', null, [field('Status', status), field('Payment', payment)]),
    field('Package starts', start, 'Its validity is counted from here.'),
    el('div.field', null, [el('span', { text: 'Classes (optional)' }), classPicker(ctx, { selected: chosen, date: pre.classIds && pre.classIds[0] ? (state.classes.find(k => k.id === pre.classIds[0]) || {}).date : null })]),
    field('Notes', notes),
    err
  ]);
  sync();
  const save = el('button.btn', { type: 'button', text: 'Make reservation', onclick: () => form.requestSubmit() });
  modal('New reservation', form, [el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }), save], { wide: true });
}

/* ================================================================
   Offers
   ================================================================ */
const KIND_LABEL = { bundle: 'Package deal', discount: 'Discount', bonus: 'Bonus classes' };

function offerState(o, today) {
  if (o.archived) return ['Archived', ''];
  if (!o.active) return ['Inactive', ''];
  if (o.startsOn && today < o.startsOn) return ['Scheduled', 'warn'];
  if (o.endsOn && today > o.endsOn) return ['Expired', 'bad'];
  if (o.maxRedemptions != null && o.claimed >= o.maxRedemptions) return ['Limit reached', 'warn'];
  return ['Live', 'good'];
}

export function offersView(ctx) {
  const { state, now } = ctx;
  const today = todayIn(now);
  const list = (state.offers || []).slice().sort((a, b) => (a.archived - b.archived) || (a.sort - b.sort));
  if (!list.length) return el('p.empty', { text: 'No offers yet. Add one and it appears on the booking page while it is live.' });
  return el('div.offergrid', null, list.map(o => {
    const [label, tone] = offerState(o, today);
    const what = o.kind === 'bundle' ? [o.price != null ? money(o.price) + (o.persons === 2 ? ' ' + t('per person') : '') : null,
                                        o.lines.map(l => l.total + ' ' + l.types.map(typeShort).join('/')).join(' + ')].filter(Boolean).join(' · ')
      : o.kind === 'discount' ? t('%s off', (o.discountPct || 0) + '%')
      : t('+%s bonus class', o.bonusClasses);
    return el('div', { class: 'offercard' + (o.archived ? ' is-off' : '') }, [
      el('div.offercard__top', null, [el('p.eyebrow', { text: KIND_LABEL[o.kind] }), chip(label, tone)]),
      el('h3.display', { text: o.title }),
      el('p.small', { text: what }),
      o.description ? el('p.small.muted', { text: o.description }) : null,
      el('p.small.muted', { text: [
        o.maxRedemptions != null ? t('%s of %s claimed', o.claimed, o.maxRedemptions) : t('%s claimed', o.claimed),
        o.startsOn || o.endsOn ? (o.startsOn ? dayMonth(o.startsOn) : '…') + ' – ' + (o.endsOn ? dayMonth(o.endsOn) : '…') : null
      ].filter(Boolean).join(' · ') }),
      el('div.rowend', { style: 'justify-content:flex-start;margin-top:auto;padding-top:12px' }, o.archived ? [
        el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Restore', onclick: () => setOffer(o, { archived: false }, 'Restored') })
      ] : [
        el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Edit', onclick: () => offerEditor(ctx, o) }),
        el('button.btn.btn--ghost.btn--sm', { type: 'button', text: o.active ? 'Deactivate' : 'Activate',
          onclick: () => setOffer(o, { active: !o.active }, o.active ? 'Off the booking page' : 'On the booking page while it is valid') }),
        el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Archive', onclick: () => setOffer(o, { archived: true }, 'Archived — reservations keep its terms') })
      ])
    ]);
  }));
  async function setOffer(o, patch, good) { try { await store.setOffer(o.id, patch); toast(good); } catch (e) { toast(e.message); } }
}

export function offerEditor(ctx, o) {
  const { state } = ctx;
  const types = state.classTypes;
  const v = o || { kind: 'bundle', persons: 1, together: true, friendNew: true, bonusTo: 'both', bonusWhen: 'friend_paid', validityDays: 30,
                   lines: [{ types: ['reformer'], total: 8 }], eligiblePlans: [], active: false, bonusClasses: 1 };
  const err = el('p.notice.notice--bad', { hidden: true });
  const f = {};
  const inp = (name, attrs) => (f[name] = input(name, attrs));
  const box = (name, checked) => (f[name] = el('input', { type: 'checkbox', name, checked: !!checked }));
  const check = (name, checked, label) => el('label.check', null, [box(name, checked), el('span', { text: label })]);

  const kinds = el('div.segments', { role: 'radiogroup', 'aria-label': 'Kind' }, Object.keys(KIND_LABEL).map(k =>
    el('label', null, [el('input', { type: 'radio', name: 'kind', value: k, checked: v.kind === k, onchange: () => sync() }), el('span', { text: KIND_LABEL[k] })])));
  const kindOf = () => (kinds.querySelector('input:checked') || {}).value || 'bundle';

  const line = v.lines[0] || { types: ['reformer'], total: 8 };
  const lineType = select('lineType', types.map(c => ({ value: c.id, label: c.name })), line.types[0]);
  const plans = el('div.boxes', null, (state.plans || []).map(p => el('label', null, [
    el('input', { type: 'checkbox', name: 'plan', value: p.id, checked: v.eligiblePlans.includes(p.id) }), el('span', { text: p.name })])));
  const bonusTo = select('bonusTo', [{ value: 'both', label: t('Both of them') }, { value: 'referrer', label: t('The one who brings her') }, { value: 'friend', label: t('The friend') }], v.bonusTo);
  const bonusWhen = select('bonusWhen', [
    { value: 'friend_paid', label: t('When the friend pays for a package') }, { value: 'paid', label: t('When this reservation is paid') },
    { value: 'visit', label: t('When the friend comes to a class') }, { value: 'booked', label: t('Straight away') }], v.bonusWhen);

  const bundle = el('div', null, [
    el('div.row.row--keep', null, [field('Price per person', inp('price', { type: 'number', inputmode: 'numeric', min: 0, value: v.price == null ? '' : v.price }), 'In lek'),
                                   field('Original price', inp('original', { type: 'number', inputmode: 'numeric', min: 0, value: v.original == null ? '' : v.original }), 'Shown crossed out')]),
    el('div.row.row--keep', null, [field('Classes included', inp('total', { type: 'number', inputmode: 'numeric', min: 1, value: line.total == null ? '' : line.total })),
                                   field('Of', lineType)]),
    field('Valid for (days)', inp('validityDays', { type: 'number', inputmode: 'numeric', min: 1, value: v.validityDays || 30 })),
    el('div.segments', { role: 'radiogroup', 'aria-label': 'People' }, [1, 2].map(n => el('label', null, [
      el('input', { type: 'radio', name: 'persons', value: String(n), checked: (v.persons || 1) === n, onchange: () => sync() }),
      el('span', { text: n === 1 ? t('One person') : t('Two people') })]))),
    (f.togetherBox = el('div', null, check('together', v.together !== false, 'Both people come to the same classes')))
  ]);
  const discount = el('div', null, [field('Discount (%)', inp('discountPct', { type: 'number', inputmode: 'numeric', min: 1, max: 100, value: v.discountPct || '' }))]);
  const bonus = el('div', null, [
    el('div.row.row--keep', null, [field('Bonus classes', inp('bonusClasses', { type: 'number', inputmode: 'numeric', min: 1, value: v.bonusClasses || 1 })), field('Who gets it', bonusTo)]),
    field('When', bonusWhen),
    check('friendRequired', v.friendRequired !== false, 'A friend is required (name and phone)'),
    check('friendNew', v.friendNew !== false, 'The friend must be new to DUA')
  ]);
  const eligible = el('div.field', null, [el('span', { text: 'Applies to these packages' }), plans, el('small', { text: 'None ticked: every package (memberships and packs for a discount).' })]);

  function sync() {
    const k = kindOf();
    bundle.hidden = k !== 'bundle'; discount.hidden = k !== 'discount'; bonus.hidden = k !== 'bonus'; eligible.hidden = k === 'bundle';
    const two = (bundle.querySelector('input[name=persons]:checked') || {}).value === '2';
    f.togetherBox.hidden = !two;
  }

  const form = el('form', { novalidate: true, onsubmit: async e => {
    e.preventDefault();
    err.hidden = true;
    const k = kindOf();
    const body = {
      id: o ? o.id : '', title: f.title.value, kind: k, description: f.description.value, descriptionEn: f.descriptionEn.value,
      eligibility: f.eligibility.value, eligibilityEn: f.eligibilityEn.value,
      price: f.price.value, original: f.original.value, discountPct: f.discountPct.value,
      lines: [{ types: [lineType.value], total: f.total.value }], validityDays: f.validityDays.value,
      persons: (bundle.querySelector('input[name=persons]:checked') || {}).value, together: f.together.checked,
      eligiblePlans: [...plans.querySelectorAll('input:checked')].map(i => i.value),
      newCustomersOnly: f.newCustomersOnly.checked, maxRedemptions: f.maxRedemptions.value,
      startsOn: f.startsOn.value, endsOn: f.endsOn.value,
      bonusClasses: f.bonusClasses.value, bonusTo: bonusTo.value, bonusWhen: bonusWhen.value,
      friendRequired: f.friendRequired.checked, friendNew: f.friendNew.checked,
      active: f.active.checked, sort: f.sort.value
    };
    if (!String(body.title).trim()) return fail(err, 'Give the offer a title');
    save.disabled = true;
    try { await store.saveOffer(body); closeModal(); toast(o ? 'Offer saved' : 'Offer added'); }
    catch (ex) { save.disabled = false; fail(err, ex.message); }
  } }, [
    field('Title', inp('title', { value: v.title || '', maxlength: 80, autocapitalize: 'characters', required: true })),
    el('label.field', null, [el('span', { text: 'Kind' }), kinds]),
    field('Description', (f.description = el('textarea.input', { rows: 2, maxlength: 400 }, v.description || ''))),
    bundle, discount, bonus, eligible,
    el('p.eyebrow.formsection', { text: 'Who and when' }),
    check('newCustomersOnly', v.newCustomersOnly, 'New clients only, once each'),
    el('div.row.row--keep', null, [field('Starts', inp('startsOn', { type: 'date', value: v.startsOn || '' })), field('Ends', inp('endsOn', { type: 'date', value: v.endsOn || '' }))]),
    el('div.row.row--keep', null, [field('Maximum claims', inp('maxRedemptions', { type: 'number', inputmode: 'numeric', min: 1, value: v.maxRedemptions || '', placeholder: t('no limit') })),
                                   field('Order', inp('sort', { type: 'number', inputmode: 'numeric', value: v.sort || '' }))]),
    field('Conditions shown to clients', (f.eligibility = el('textarea.input', { rows: 2, maxlength: 300 }, v.eligibility || ''))),
    el('details.en', null, [el('summary', { text: 'In English (optional)' }), el('div', { style: 'margin-top:8px' }, [
      field('Description', (f.descriptionEn = el('textarea.input', { rows: 2, maxlength: 400 }, (v.en && v.en.description) || ''))),
      field('Conditions', (f.eligibilityEn = el('textarea.input', { rows: 2, maxlength: 300 }, (v.en && v.en.eligibility) || '')))
    ])]),
    check('active', v.active, 'Active — on the booking page while it is valid'),
    el('p.small.muted', { text: 'Changing an offer never changes a reservation already made with it: those keep the terms they were made on.' }),
    err
  ]);
  sync();
  const save = el('button.btn', { type: 'button', text: 'Save', onclick: () => form.requestSubmit() });
  modal(o ? t('Edit %s', o.title) : 'New offer', form, [el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }), save], { wide: true });
}

/* ================================================================
   The studio's rules
   ================================================================ */
export function settingsView(ctx) {
  const { state } = ctx;
  const st = settingsOf(state);
  const err = el('p.notice.notice--bad', { hidden: true });
  const opening = input('openingDate', { type: 'date', value: st.openingDate });
  const cancel = input('cancelMinutes', { type: 'number', inputmode: 'numeric', min: 0, value: st.cancelMinutes });
  const horizon = input('horizonDays', { type: 'number', inputmode: 'numeric', min: 1, value: st.horizonDays });
  const cap = input('defaultCapacity', { type: 'number', inputmode: 'numeric', min: 1, value: st.defaultCapacity });
  const save = el('button.btn', { type: 'submit', text: 'Save' });
  const form = el('form.card', { novalidate: true, style: 'max-width:620px', onsubmit: async e => {
    e.preventDefault(); err.hidden = true; save.disabled = true;
    try { await store.saveRules({ openingDate: opening.value, cancelMinutes: cancel.value, horizonDays: horizon.value, defaultCapacity: cap.value }); toast('Saved'); }
    catch (ex) { fail(err, ex.message); }
    save.disabled = false;
  } }, [
    field('Opening date', opening, 'No class before this date can be booked. Clients see “Opening …” until then.'),
    field('Cancellation window (minutes)', cancel, 'Clients can cancel up to this many minutes before a class. After that it counts as used.'),
    field('Booking opens (days ahead)', horizon, 'How far ahead clients can book, counted from today or the opening date.'),
    field('Places in a new time slot', cap, 'The starting capacity when you add a slot to the weekly schedule.'),
    err, save
  ]);
  return form;
}

/* ================================================================
   The weekly schedule
   ================================================================ */
const WD = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
const WD_NAME = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export function templateView(ctx) {
  const { state, now } = ctx;
  const st = settingsOf(state);
  const today = todayIn(now);
  const ts = state.templates || [];
  const current = ts.filter(x => x.effectiveFrom <= today).pop() || null;
  const next = ts.filter(x => x.effectiveFrom > today);
  const base = next.length ? next[next.length - 1] : current;
  let from = base ? (base.effectiveFrom > today ? base.effectiveFrom : today) : (today > st.openingDate ? today : st.openingDate);
  /* Editing the template that starts on the chosen date keeps its slots'
     identity, so classes made from them are updated in place. */
  const editingSame = () => base && base.effectiveFrom === from;
  let slots = (base ? base.slots : []).map(s => ({ ...s }));

  const host = el('div');
  const staff = state.instructors.filter(i => i.active);
  const err = el('p.notice.notice--bad', { hidden: true });

  const draw = () => {
    host.textContent = '';
    host.appendChild(el('div.card', { style: 'margin-bottom:16px' }, [
      el('p.small.muted', { text: current ? t('In use since %s.', niceDate(current.effectiveFrom)) + (next.length ? ' ' + t('A new schedule starts %s.', niceDate(next[next.length - 1].effectiveFrom)) : '')
                                         : 'No weekly schedule yet. Add the times below and save.' }),
      el('div.row.row--keep', { style: 'margin-top:12px' }, [
        field('Applies from', input('from', { type: 'date', value: from, min: today, onchange: e => { from = e.target.value || from; } }),
          'Dates before this keep the schedule they had.'),
        el('div.field', null, [el('span', { text: ' ' }),
          el('button.btn.btn--ghost', { type: 'button', text: 'Copy Monday to Tue–Sat', onclick: copyMonday })])
      ])
    ]));
    WEEK_ORDER.forEach(key => {
      const wd = WD[key];
      const mine = slots.filter(s => s.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
      host.appendChild(el('section.tday', null, [
        el('div.tday__head', null, [el('h3.display', { text: t(WD_NAME[key]) }), mine.length ? chip(t('%s classes', mine.length)) : chip('Closed')]),
        ...mine.map(s => slotRow(s)),
        el('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => { slots.push(newSlot(wd, mine)); draw(); } }, [icon('plus'), el('span', { text: 'Add a time' })])
      ]));
    });
    host.appendChild(err);
    host.appendChild(el('div.rowend', { style: 'justify-content:flex-start;margin-top:16px' }, el('button.btn', { type: 'button', text: 'Review and save', onclick: review })));
  };

  const newSlot = (wd, mine) => {
    const last = mine[mine.length - 1];
    const start = last ? last.end : '07:00';
    const end = String(Math.min(23, Number(start.slice(0, 2)) + 1)).padStart(2, '0') + start.slice(2);
    return { weekday: wd, start, end, capacity: st.defaultCapacity, typeId: (state.classTypes[0] || {}).id || 'reformer', instructorId: null };
  };
  function slotRow(s) {
    const set = (k, v) => { s[k] = v; };
    return el('div.tslot', null, [
      el('input.input', { type: 'time', value: s.start, 'aria-label': 'Starts', onchange: e => set('start', e.target.value) }),
      el('input.input', { type: 'time', value: s.end, 'aria-label': 'Ends', onchange: e => set('end', e.target.value) }),
      el('input.input', { type: 'number', inputmode: 'numeric', min: 1, value: s.capacity, 'aria-label': 'Places', onchange: e => set('capacity', Number(e.target.value)) }),
      el('select.input.select', { 'aria-label': 'Class', onchange: e => set('typeId', e.target.value) },
        state.classTypes.map(c => el('option', { value: c.id, selected: c.id === s.typeId, text: c.short || c.name }))),
      el('select.input.select', { 'aria-label': 'Led by', onchange: e => set('instructorId', e.target.value || null) },
        [el('option', { value: '', text: t('Decide later') })].concat(staff.map(i => el('option', { value: i.id, selected: i.id === s.instructorId, text: i.name })))),
      el('button.iconbtn', { type: 'button', 'aria-label': 'Remove', onclick: () => { slots = slots.filter(x => x !== s); draw(); } }, icon('close'))
    ]);
  }
  function copyMonday() {
    const mon = slots.filter(s => s.weekday === 1);
    slots = slots.filter(s => s.weekday === 1 || s.weekday === 0 || s.weekday > 6);
    for (let wd = 2; wd <= 6; wd++) mon.forEach(s => slots.push({ ...s, id: undefined, weekday: wd }));
    draw();
  }
  const payload = () => ({ effectiveFrom: from, slots: slots.map(s => ({ ...s, id: editingSame() ? s.id : undefined })) });

  async function review() {
    err.hidden = true;
    let r;
    try { r = await store.previewTemplate(payload()); } catch (e) { return fail(err, e.message); }
    const rep = r.report;
    modal('Save the weekly schedule?', el('div', null, [
      el('p', { text: t('From %s:', niceDate(from)) }),
      el('ul.facts', null, [
        el('li', { text: t('%s classes added', rep.created) }),
        el('li', { text: t('%s classes changed', rep.updated) }),
        el('li', { text: t('%s classes removed', rep.removed) })
      ]),
      rep.kept.length ? el('div.notice.notice--warn', { style: 'margin-top:12px;display:block' }, [
        el('p', { style: 'font-weight:500', text: t(rep.kept.length === 1 ? '%s class has bookings and stays as it is:' : '%s classes have bookings and stay as they are:', rep.kept.length) }),
        el('ul', { style: 'margin-top:6px' }, rep.kept.slice(0, 12).map(k => el('li', { text: shortDate(k.date) + ' · ' + k.start + ' · ' + t(k.booked === 1 ? '%s person' : '%s people', k.booked) })))
      ]) : null,
      el('p.small.muted', { style: 'margin-top:12px', text: 'Classes you changed for one date are never touched by the weekly schedule.' })
    ]), [
      el('button.btn.btn--ghost', { type: 'button', text: 'Back', onclick: closeModal }),
      el('button.btn', { type: 'button', text: 'Save', onclick: async ev => {
        ev.currentTarget.disabled = true;
        try { await store.saveTemplate(payload()); closeModal(); toast('Weekly schedule saved'); }
        catch (e) { closeModal(); fail(err, e.message); }
      } })
    ]);
  }
  draw();
  return host;
}

export function closuresView(ctx) {
  const { state, now } = ctx;
  const list = (state.closures || []).filter(c => c.date >= todayIn(now));
  const date = input('date', { type: 'date', min: todayIn(now) });
  const reason = input('reason', { maxlength: 120, placeholder: t('Holiday, maintenance…') });
  const err = el('p.notice.notice--bad', { hidden: true });
  return el('div', null, [
    el('form.card', { style: 'max-width:620px;margin-bottom:18px', novalidate: true, onsubmit: async e => {
      e.preventDefault(); err.hidden = true;
      let p;
      try { p = await store.previewClosure({ date: date.value, reason: reason.value }); } catch (ex) { return fail(err, ex.message); }
      modal(t('Close the studio on %s?', niceDate(date.value)), el('div', null, [
        el('p', { text: t(p.classes === 1 ? '%s class that day is cancelled.' : '%s classes that day are cancelled.', p.classes) }),
        p.affected ? el('div.notice.notice--warn', { style: 'margin-top:12px', text: t(p.affected === 1 ? '%s booking is cancelled. She is told, and the class goes back in her package.' : '%s bookings are cancelled. Each one is told, and the class goes back in her package.', p.affected) }) : null
      ]), [
        el('button.btn.btn--ghost', { type: 'button', text: 'Back', onclick: closeModal }),
        el('button.btn', { type: 'button', text: 'Close the studio', onclick: async ev => {
          ev.currentTarget.disabled = true;
          try { await store.closeDay({ date: date.value, reason: reason.value }); closeModal(); toast('Closed for that day'); }
          catch (ex) { closeModal(); fail(err, ex.message); }
        } })
      ]);
    } }, [
      el('div.row', null, [field('Date', date), field('Reason (optional)', reason)]),
      err,
      el('button.btn', { type: 'submit', text: 'Close the studio that day' })
    ]),
    list.length ? datatable([{ label: 'Closed' }, { label: 'Reason' }, { label: '', cls: 'right' }], list.map(c => [
      el('b', { text: niceDate(c.date) }), c.reason || '—',
      el('div.rowend', null, el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Reopen', onclick: async () => {
        try { const r = await store.reopenDay(c.date); toast(t('Reopened — %s classes back', r.restored)); } catch (e) { toast(e.message); }
      } }))
    ])) : el('p.empty', { text: 'No closed days coming up.' })
  ]);
}
