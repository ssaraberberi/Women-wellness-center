/* The studio's own side: built to answer "who is in the 16:00 and who can
   take it" without leaving the page — on a laptop at the desk or on a
   phone in the studio. */
import { el, frag, chip, dot, modal, closeModal, toast, field, input, select, bandsEditor, money, typeName, typeShort,
         range, niceDate, relDay, shortDate, dayMonth, t, tw, icon, datatable, jobLabel, touch } from '../ui.js';
import * as store from '../store.js';
import { iso, addDays, startOfWeek, minutes, WEEK_ORDER, todayIn, plusDays } from '../../../shared/domain.js';
import { spots, suggestInstructors, instructorFit, membershipOf, isExpired, planOf, creditSummary, packagesOf, settingsOf } from '../../../shared/rules.js';
import { shell } from './shell.js';
import { reservationsView, reservationSheet, newReservation, offersView, offerEditor, settingsView,
         templateView, closuresView } from './reservations.js';

export function renderAdmin(ctx) {
  const { user, state, now, route } = ctx;
  const problems = state.issues || [];
  const pending = (state.reservations || []).filter(r => r.status === 'pending').length;
  const nav = [
    ['#/', 'Dashboard', null, 'home'],
    ['#/reservations', 'Reservations', pending || null, 'card'],
    ['#/schedule', 'Schedule', null, 'calendar'],
    ['#/clients', 'Clients', null, 'clients'],
    ['#/offers', 'Offers', null, 'spark'],
    ['#/packages', 'Packages', null, 'tag'],
    ['#/employees', 'Employees', null, 'staff'],
    ['#/settings', 'Settings', null, 'clock'],
    ['#/issues', 'Attention', problems.length || null, 'alert']
  ];

  let title = 'Dashboard', sub = '', body, actions = null;
  const add = (label, fn) => [el('button.btn.btn--sm', { type: 'button', onclick: fn }, [icon('plus'), el('span', { text: label })])];
  if (route === 'reservations' || route === 'memberships') {
    title = 'Reservations'; sub = 'Every booking, its classes, its credits and its payment';
    actions = add('New reservation', () => newReservation(ctx, null));
    body = reservationsView(ctx);
  } else if (route === 'offers') {
    title = 'Offers'; sub = 'Live offers appear on the booking page while they are valid';
    actions = add('Add offer', () => offerEditor(ctx, null));
    body = offersView(ctx);
  } else if (route === 'settings') {
    title = 'Settings'; sub = 'The rules every booking follows';
    body = settingsView(ctx);
  } else if (route === 'schedule') {
    title = 'Schedule'; sub = 'The weekly schedule, and changes for single dates';
    actions = schedTab === 'calendar' ? add('One-off class', () => classEditor(ctx, null)) : null;
    body = scheduleView(ctx);
  } else if (route === 'employees') {
    title = 'Employees'; sub = 'Instructors and body therapists, and what each of them takes';
    actions = add('Add employee', () => employeeEditor(ctx));
    body = employeesView(ctx);
  } else if (route === 'packages') {
    title = 'Packages'; sub = 'What the studio sells, and what each one lets you book';
    actions = add('Add package', () => planEditor(ctx, null));
    body = packagesView(ctx);
  } else if (route === 'clients') {
    title = 'Clients'; sub = t(state.clients.length === 1 ? '%s client' : '%s clients', state.clients.length);
    body = clientsView(ctx);
  } else if (route === 'issues') {
    title = 'Needs attention'; sub = 'Things that were valid when they were set, and are not now';
    body = issuesView(ctx, problems);
  } else { sub = niceDate(todayIn(now)); body = dashboard(ctx, problems); }

  return shell({ user, route, nav, title, sub, actions, body, notices: state.notices });
}

/* The letters are not arriving, and nobody would otherwise find out.
   Both halves are said: what went wrong, and what to do — because the
   fix is in a dashboard somewhere else, not on this screen. */
function mailTrouble(state) {
  const mail = state.mail;
  if (!mail) return null;
  if (!mail.configured) return el('div.notice.notice--warn', { style: 'margin-top:16px' }, [
    el('span', { text: 'No reset links can be sent: the mail key is not set on the server. Clients who forget a password have to be reset at the desk.' })
  ]);
  if (!mail.last || mail.last.ok) return null;
  return el('div.notice.notice--bad', { style: 'margin-top:16px;display:block' }, [
    el('p', { style: 'font-weight:500', text: 'The last letter could not be sent' }),
    el('p', { style: 'margin-top:6px', text: t('Sending as %s. The provider answered: %s', mail.from, mail.last.problem || '') }),
    el('p', { style: 'margin-top:6px', text: 'Until this is fixed, nobody can get a password reset link. Reset at the desk in the meantime.' })
  ]);
}

const tile = (big, label, note, href) => el(href ? 'a.tile' : 'div.tile', href ? { href } : null, [
  el('b', { class: 'num', text: big }), el('span', { text: label }), note ? el('i', { text: note }) : null
]);

/* ---------- dashboard ---------- */
function dashboard(ctx, problems) {
  const { state, now } = ctx;
  const today = todayIn(now);
  const st = settingsOf(state);
  const todays = state.classes.filter(s => s.date === today).sort((a, b) => a.start.localeCompare(b.start));
  const activeMems = state.memberships.filter(m => m.status === 'active' && !isExpired(m, now));
  const liveToday = todays.filter(s => !s.cancelled);
  const seatsToday = liveToday.reduce((a, s) => a + spots(state, s).taken, 0);
  const capToday = liveToday.reduce((a, s) => a + s.capacity, 0);
  const res = state.reservations || [];
  const pending = res.filter(r => r.status === 'pending').length;
  const unpaid = res.filter(r => r.payment === 'unpaid' && r.status !== 'cancelled').length;
  const openIn = Math.round((new Date(st.openingDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);

  return frag([
    openIn > 0 ? el('div.notice', { style: 'margin-bottom:16px' }, [el('span', { text: t(openIn === 1 ? 'The studio opens tomorrow, %s.' : 'The studio opens in %s days, on %s.', openIn === 1 ? niceDate(st.openingDate) : openIn, niceDate(st.openingDate)) }),
      el('a.linkish', { href: '#/settings', text: 'Change' })]) : null,
    el('div.tiles', null, [
      tile(String(liveToday.length), "Today's classes", capToday ? t('%s of %s seats booked', seatsToday, capToday) : null, '#/reservations'),
      tile(String(pending), 'Waiting to confirm', null, '#/reservations'),
      tile(String(unpaid), 'Not paid yet', null, '#/reservations'),
      tile(String(activeMems.length), 'Active packages', null, '#/reservations'),
      tile(String(state.clients.length), 'Clients', null, '#/clients'),
      tile(String(problems.length), 'Needs attention', problems.length ? null : t('All in order'), '#/issues')
    ]),
    mailTrouble(state),
    problems.length ? el('div', { class: 'notice notice--warn', style: 'margin-top:16px' }, [
      el('span', { text: t(problems.length > 1 ? '%s classes need attention' : '%s class needs attention', problems.length) }),
      el('a.linkish', { href: '#/issues', text: 'Review' })
    ]) : null,
    el('h2.section-title', { text: "Today's classes" }),
    todays.length
      ? el('div.grid', null, todays.map(s => adminSlot(ctx, s)))
      : el('p.empty', { text: 'Nothing scheduled today.' })
  ]);
}

/* ---------- one admin class row ---------- */
function adminSlot(ctx, s) {
  const { state } = ctx;
  const cap = spots(state, s);
  const i = state.instructors.find(x => x.id === s.instructorId);
  const fit = i ? instructorFit(state, i, s) : null;
  const bad = !s.cancelled && (!i || (fit && fit.status !== 'recommended'));

  return el('div', { class: 'slot slot--' + s.typeId + (s.cancelled ? ' slot--off' : '') }, [
    el('span.slot__time.num', { text: range(s) }),
    el('span.slot__name', null, [dot(s.typeId), typeName(s.typeId)]),
    el('span.slot__cap.num', { text: cap.taken + ' / ' + cap.capacity }),
    s.cancelled
      ? el('span.slot__who', { text: 'Cancelled' })
      : el('button.slot__who', { type: 'button', text: i ? i.name : 'Assign someone', onclick: () => assignDialog(ctx, s) }),
    el('span.slot__act', null, [
      bad ? chip(i ? fit.why : 'Unassigned', 'warn') : null,
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Who booked', onclick: () => rosterDialog(ctx, s) }),
      s.cancelled ? null : el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Edit', onclick: () => classEditor(ctx, s) })
    ])
  ]);
}

/* ---------- schedule: day / week / month ----------
   On a phone the week is the natural unit and the default; a day is a
   list, and a month is four weeks of the same. */
let schedMode = 'week';
let schedAnchor = null;
let schedTab = 'calendar';

/* Three ways into one timetable: the dates as they are, the week they are
   made from, and the days the studio is closed. */
function scheduleView(ctx) {
  const tabs = el('div.switchbar', { role: 'tablist', 'aria-label': 'Schedule', style: 'margin-bottom:18px' },
    [['calendar', 'Calendar'], ['template', 'Weekly schedule'], ['closed', 'Closed days']].map(([k, label]) =>
      el('button', { type: 'button', role: 'tab', class: schedTab === k ? 'is-on' : null, 'aria-selected': schedTab === k ? 'true' : 'false',
        text: label, onclick: () => { schedTab = k; ctx.go(location.hash); } })));
  const body = schedTab === 'template' ? templateView(ctx) : schedTab === 'closed' ? closuresView(ctx) : calendarView(ctx);
  return frag([tabs, body]);
}

function calendarView(ctx) {
  const { state, now } = ctx;
  if (!schedAnchor) schedAnchor = todayIn(now);
  const anchor = new Date(schedAnchor + 'T00:00:00');
  const step = schedMode === 'day' ? 1 : schedMode === 'week' ? 7 : 28;
  const move = n => { schedAnchor = iso(addDays(anchor, n)); ctx.go(location.hash); };

  const from = schedMode === 'day' ? anchor : startOfWeek(anchor);
  const label = schedMode === 'day' ? relDay(schedAnchor, now)
    : t('%s – %s', shortDate(iso(from)), shortDate(iso(addDays(from, schedMode === 'week' ? 6 : 27))));

  const bar = el('div.toolbar', null, [
    el('div.switchbar', { role: 'group', 'aria-label': 'View' }, ['day', 'week', 'month'].map(mode =>
      el('button', { type: 'button', class: schedMode === mode ? 'is-on' : null, 'aria-pressed': schedMode === mode ? 'true' : 'false',
        text: tw(mode), onclick: () => { schedMode = mode; ctx.go(location.hash); } }))),
    el('div.toolbar__nav', null, [
      el('span.toolbar__label', { text: label }),
      el('button.iconbtn', { type: 'button', 'aria-label': 'Previous', onclick: () => move(-step) }, icon('left')),
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Today', onclick: () => { schedAnchor = todayIn(now); ctx.go(location.hash); } }),
      el('button.iconbtn', { type: 'button', 'aria-label': 'Next', onclick: () => move(step) }, icon('right'))
    ])
  ]);

  let grid;
  if (schedMode === 'day') {
    const list = state.classes.filter(s => s.date === schedAnchor).sort((a, b) => a.start.localeCompare(b.start));
    grid = list.length ? el('div.grid', null, list.map(s => adminSlot(ctx, s)))
      : el('p.empty', { text: t('Nothing on %s', niceDate(schedAnchor)) });
  } else {
    const weeks = schedMode === 'week' ? 1 : 4;
    grid = el('div.grid', { style: 'gap:10px' }, Array.from({ length: weeks }, (_, w) =>
      el('div.week', null, Array.from({ length: 7 }, (_, d) => {
        const date = iso(addDays(from, w * 7 + d));
        const list = state.classes.filter(s => s.date === date).sort((a, b) => a.start.localeCompare(b.start));
        const [wd, n] = shortDate(date).split(' ');
        const closed = (state.closures || []).some(c => c.date === date);
        return el('div', { class: 'week__day' + (date === todayIn(now) ? ' is-today' : '') + (closed ? ' is-closed' : '') }, [
          el('p.week__name', null, [wd, el('b', { text: n })]),
          el('div.week__list', null, list.length ? list.map(s => {
            const cap = spots(state, s);
            const i = state.instructors.find(x => x.id === s.instructorId);
            const fit = i ? instructorFit(state, i, s) : null;
            const warn = !s.cancelled && (!i || fit.status !== 'recommended');
            return el('button', {
              type: 'button',
              class: 'mini mini--' + s.typeId + (cap.full ? ' mini--full' : '') + (s.cancelled ? ' mini--off' : '') + (warn ? ' mini--warn' : ''),
              onclick: () => s.cancelled ? rosterDialog(ctx, s) : classEditor(ctx, s)
            }, [
              el('b', { text: s.start + ' · ' + typeShort(s.typeId) + (s.pinned && s.slotId == null ? ' ✦' : '') }),
              el('span', { text: (i ? i.name.split(' ')[0] : t('⚠ unassigned')) + ' · ' + cap.taken + '/' + cap.capacity + (cap.blocked ? ' +' + cap.blocked : '') })
            ]);
          }) : [el('span.week__none', { text: '—' })])
        ]);
      }))));
  }
  return frag([bar, grid]);
}

/* ---------- roster ---------- */
async function rosterDialog(ctx, s) {
  const rows = await store.roster(s.id).catch(() => []);
  const booked = rows.filter(r => r.status === 'booked');
  const waiting = rows.filter(r => r.status === 'waitlist');

  modal(typeName(s.typeId) + ' · ' + range(s), el('div', null, [
    el('p.muted', { text: niceDate(s.date) + ' · ' + t('%s of %s booked', booked.length, s.capacity) }),
    booked.length
      ? el('div.sheetnav', { style: 'margin-top:10px' }, booked.map(r => el('div', { style: 'display:flex;align-items:center;gap:12px;min-height:56px;border-top:1px solid var(--line-soft)' }, [
          el('div', { style: 'flex:1;min-width:0' }, [el('div', { text: r.name }), el('div.cell-sub', { text: r.phone || r.email || '' })]),
          chip('Booked', 'good')
        ])))
      : el('p.empty', { text: 'Nobody yet.' }),
    waiting.length ? el('div', { style: 'margin-top:16px' }, [
      el('p.eyebrow', { text: 'Waitlist' }),
      ...waiting.map(r => el('p', { style: 'font-size:15px;margin-top:8px', text: r.name }))
    ]) : null
  ]), [el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal })]);
}

/* ---------- who takes a class, with recommendations ---------- */
function assignDialog(ctx, s) {
  const { state } = ctx;
  const ranked = suggestInstructors(state, s).filter(r => r.instructor.active || r.instructor.id === s.instructorId);
  const tone = { recommended: 'good', clash: 'warn', unavailable: 'warn', unqualified: '', removed: 'bad' };
  const good = ranked.filter(r => r.status === 'recommended');
  const rest = ranked.filter(r => r.status !== 'recommended');

  const list = who => el('div.sugg', null, who.map(r =>
    el('button', { type: 'button', disabled: r.status !== 'recommended', onclick: async ev => {
      ev.currentTarget.disabled = true;
      try { await store.assignInstructor(s.id, r.instructor.id); closeModal(); toast(t('%s assigned', r.instructor.name)); }
      catch (ex) { closeModal(); toast(ex.message); }
    } }, [
      dot(s.typeId),
      el('span.sugg__who', null, [el('b', { text: r.instructor.name }), el('small', { text: jobLabel(r.instructor.job) + ' · ' + t(r.why) })]),
      chip(r.status, tone[r.status])
    ])));

  modal('Who leads this class?', el('div', null, [
    el('p.muted', { text: typeName(s.typeId) + ' · ' + niceDate(s.date) + ' · ' + range(s) }),
    el('p.eyebrow', { style: 'margin:18px 0 8px', text: 'Recommended' }),
    good.length ? list(good) : el('p.muted', { text: 'Nobody qualified is free at this time.' }),
    rest.length ? frag([el('p.eyebrow', { style: 'margin:18px 0 8px', text: 'Not available' }), list(rest)]) : null
  ]), s.instructorId ? [
    el('button.linkish', { type: 'button', text: 'Take them off this class',
      onclick: async () => { try { await store.assignInstructor(s.id, null); closeModal(); toast('Removed from the class'); }
                             catch (ex) { closeModal(); toast(ex.message); } } })
  ] : null, { wide: true });
}

/* ---------- class editor ---------- */
function classEditor(ctx, s) {
  const { state, now } = ctx;
  const editing = !!s;
  const st = settingsOf(state);
  const v = s || { typeId: (state.classTypes[0] || {}).id || 'reformer', date: todayIn(now) > st.openingDate ? todayIn(now) : st.openingDate,
                   start: '11:00', end: '12:00', capacity: st.defaultCapacity, instructorId: null, blocked: 0 };
  const booked = s ? spots(state, s).taken : 0;
  const err = el('p.notice.notice--bad', { hidden: true });
  const fail = msg => { err.textContent = t(msg); err.hidden = false; err.scrollIntoView({ block: 'nearest' }); };

  const submit = async (confirmed) => {
    err.hidden = true;
    const f = new FormData(form);
    const data = {
      id: s ? s.id : undefined,
      typeId: f.get('typeId'), date: f.get('date'),
      start: f.get('start'), end: f.get('end'),
      capacity: Number(f.get('capacity')),
      instructorId: f.get('instructorId') || null
    };
    const blocked = Number(f.get('blocked') || 0);
    if (!data.date || !data.start || !data.end) return fail('Fill in the date and both times');
    if (!Number.isInteger(data.capacity) || data.capacity < 1) return fail('Capacity is at least one place');
    if (!Number.isInteger(blocked) || blocked < 0) return fail('Blocked places is a whole number');
    /* Checked here so the answer is instant, and again on the server,
       which is the one that counts. */
    if (minutes(data.start) >= minutes(data.end)) return fail('The class must end after it starts');
    if (data.instructorId) {
      const i = state.instructors.find(x => x.id === data.instructorId);
      const fit = instructorFit(state, i, { ...data, id: s ? s.id : 'new', cancelled: false });
      if (fit.status !== 'recommended') return fail(t('%s — %s', i.name, t(fit.why)));
    }
    if (data.capacity < booked + blocked) return fail(t('%s people are already booked; capacity cannot go below that', booked));
    /* Moving a class people are booked into is never done quietly. */
    const moved = s && (data.date !== s.date || data.start !== s.start || data.end !== s.end);
    if (moved && booked && !confirmed) {
      warn.hidden = false;
      warn.textContent = t(booked === 1 ? '%s person is booked into this class. She will be told about the new time. Press save again to move it.'
                                        : '%s people are booked into this class. Each one will be told about the new time. Press save again to move it.', booked);
      warned = true;
      return;
    }
    save.disabled = true;
    try {
      const out = await store.saveClass(data);
      const id = (out && out.id) || (s && s.id);
      if (id && blocked !== ((s && s.blocked) || 0)) await store.blockPlaces(id, blocked);
      closeModal(); toast(editing ? 'Class updated for this date' : 'Class added');
    } catch (ex) { save.disabled = false; fail(ex.message); }
  };
  let warned = false;
  const warn = el('p.notice.notice--warn', { hidden: true });
  const form = el('form', { novalidate: true, onsubmit: e => { e.preventDefault(); submit(warned); } }, [
    el('p.notice', { style: 'margin-bottom:16px', text: editing
      ? (s.slotId != null ? 'This change applies to this date only. The weekly schedule stays as it is for every other week.' : 'A one-off class on this date.')
      : 'A one-off class on this date only. For a class every week, use the Weekly schedule.' }),
    field('Class', select('typeId', state.classTypes.map(c => ({ value: c.id, label: c.name })), v.typeId)),
    el('div.row.row--keep', null, [
      field('Date', input('date', { type: 'date', value: v.date, required: true })),
      field('Places', input('capacity', { type: 'number', inputmode: 'numeric', min: 1, max: 60, value: v.capacity, required: true }))
    ]),
    el('div.row.row--keep', null, [
      field('Starts', input('start', { type: 'time', value: v.start, required: true })),
      field('Ends', input('end', { type: 'time', value: v.end, required: true }))
    ]),
    field('Led by', select('instructorId',
      [{ value: '', label: 'Decide later' }].concat(
        state.instructors.filter(i => i.active).map(i => ({ value: i.id, label: i.name + ' · ' + jobLabel(i.job) }))), v.instructorId || ''),
      'Checked against qualifications, availability and clashes when you save.'),
    field('Blocked places', input('blocked', { type: 'number', inputmode: 'numeric', min: 0, value: v.blocked || 0 }),
      booked ? t('%s booked. Blocked places are held back from booking.', booked) : 'Held back from booking — a reformer out of use, a private guest.'),
    warn, err
  ]);

  const save = el('button.btn', { type: 'button', text: editing ? 'Save changes' : 'Add class', onclick: () => form.requestSubmit() });
  const foot = [
    editing ? el('button.linkish', { type: 'button', text: 'Cancel this class', onclick: () => cancelDialog(ctx, s) }) : null,
    el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }),
    save
  ];
  modal(editing ? 'Edit class' : 'Add a class', form, foot);
}

/* Cancelling tells every client on it, so it is asked twice. */
function cancelDialog(ctx, s) {
  const booked = spots(ctx.state, s).taken;
  modal('Cancel this class?', el('div', null, [
    el('p', { text: typeName(s.typeId) + ' · ' + niceDate(s.date) + ' · ' + range(s) }),
    el('div.notice.notice--warn', { style: 'margin-top:14px',
      text: booked ? t(booked > 1 ? '%s clients are booked. They are told, and the class goes back on their balance.'
                                  : '%s client is booked. She is told, and the class goes back on her balance.', booked)
                   : 'Nobody is booked yet.' })
  ]), [
    el('button.btn.btn--ghost', { type: 'button', text: 'Keep it', onclick: closeModal }),
    el('button.btn', { type: 'button', text: 'Cancel class', onclick: async ev => {
      ev.currentTarget.disabled = true;
      try {
        const r = await store.cancelClass(s.id);
        closeModal();
        toast(r.affected ? t(r.affected > 1 ? 'Class cancelled — %s clients notified and refunded' : 'Class cancelled — %s client notified and refunded', r.affected)
                         : 'Class cancelled');
      } catch (ex) { closeModal(); toast(ex.message); }
    } })
  ]);
}

/* ---------- employees ---------- */
function employeesView(ctx) {
  const { state, now } = ctx;
  const today = iso(now);
  const people = state.instructors.slice().sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
  return datatable([
    { label: 'Employee' }, { label: 'Role' }, { label: 'Takes' }, { label: 'Works' },
    { label: 'Upcoming', cls: 'right' }, { label: '', cls: 'right' }
  ], people.map(i => {
    const upcoming = state.classes.filter(s => s.instructorId === i.id && !s.cancelled && s.date >= today).length;
    const days = WEEK_ORDER.filter(d => (i.availability[d] || []).length);
    return [
      [el('div', { text: i.name }), el('div.cell-sub', { text: [i.email, i.phone].filter(Boolean).join(' · ') })],
      jobLabel(i.job),
      el('div.chips', null, i.qualifications.length ? i.qualifications.map(q => chip(typeShort(q))) : [el('span.muted', { text: '—' })]),
      el('span.small.muted', { text: days.length ? days.map(d => t(d)).join(', ') : t('none set') }),
      el('span.num', { text: String(upcoming) }),
      i.active
        ? el('div.rowend', null, [
            el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Reset password', onclick: () => resetFor(ctx, i) }),
            el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Remove', onclick: () => removeDialog(ctx, i, upcoming) })
          ])
        : chip('Removed', 'bad')
    ];
  }), 'No employees yet. Add the first one and they can sign in straight away.');
}

function removeDialog(ctx, i, upcoming) {
  modal(t('Remove %s?', i.name), el('div', null, [
    el('p', { text: 'They lose access to the staff dashboard straight away.' }),
    upcoming ? el('div', { class: 'notice notice--warn', style: 'margin-top:14px',
      text: t(upcoming > 1 ? '%s upcoming classes will be left unassigned. Bookings are kept, and those clients are told someone new will lead it.'
                           : '%s upcoming class will be left unassigned. Bookings are kept, and those clients are told someone new will lead it.', upcoming) }) : null
  ]), [
    el('button.btn.btn--ghost', { type: 'button', text: 'Keep', onclick: closeModal }),
    el('button.btn', { type: 'button', text: 'Remove employee', onclick: async ev => {
      ev.currentTarget.disabled = true;
      try {
        const r = await store.removeEmployee(i.id);
        closeModal();
        toast(r.orphaned ? t(r.orphaned > 1 ? 'Removed — %s classes now need someone' : 'Removed — %s class now needs someone', r.orphaned) : t('Removed'));
      } catch (ex) { closeModal(); toast(ex.message); }
    } })
  ]);
}

/* What they do decides what they are qualified for to begin with — an
   instructor the reformer, a therapist the treatments — and the boxes can
   be changed before saving. */
function employeeEditor(ctx) {
  const types = ctx.state.classTypes;
  const DEFAULTS = { instructor: ['reformer'], therapist: ['spa'] };
  const err = el('p.notice.notice--bad', { hidden: true });
  const fail = msg => { err.textContent = t(msg); err.hidden = false; err.scrollIntoView({ block: 'nearest' }); };

  const quals = el('div.boxes', null, types.map(c =>
    el('label', null, [el('input', { type: 'checkbox', name: 'q', value: c.id, checked: DEFAULTS.instructor.includes(c.id) }), el('span', { text: c.name })])));
  const pickJob = job => quals.querySelectorAll('input').forEach(b => { b.checked = (DEFAULTS[job] || []).includes(b.value); });
  const hours = bandsEditor([{ from: '09:00', to: '18:00' }]);

  const jobs = el('div.segments', { role: 'radiogroup', 'aria-label': 'Role' }, ['instructor', 'therapist'].map(job =>
    el('label', null, [
      el('input', { type: 'radio', name: 'job', value: job, checked: job === 'instructor', onchange: () => pickJob(job) }),
      el('span', { text: jobLabel(job) })
    ])));

  const form = el('form', { novalidate: true, onsubmit: async e => {
    e.preventDefault();
    err.hidden = true;
    const f = new FormData(form);
    const name = String(f.get('name') || '').trim(), email = String(f.get('email') || '').trim();
    const phone = String(f.get('phone') || '').trim(), password = String(f.get('password') || '');
    if (!name || !email || !phone) return fail('Fill in the name, email and phone');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('That email does not look right');
    if (password.length < 8) return fail('Password must be at least 8 characters');
    const qualifications = f.getAll('q');
    if (!qualifications.length) return fail('Pick at least one kind of class they can take');
    const bands = hours.read();
    if (!bands) return fail('Start must be before end');
    const availability = {};
    WEEK_ORDER.forEach(d => { availability[d] = f.getAll('day').includes(d) ? bands : []; });
    save.disabled = true;
    try {
      await store.addEmployee({ name, email, phone, password, job: f.get('job'), qualifications, availability });
      closeModal();
      toast('Employee added — they can sign in now');
    } catch (ex) { save.disabled = false; fail(ex.message); }
  } }, [
    el('label.field', null, [el('span', { text: 'Role' }), jobs]),
    field('Full name', input('name', { required: true, autocomplete: 'off', autocapitalize: 'words' })),
    el('div.row', null, [
      field('Email', input('email', { type: 'email', required: true, inputmode: 'email', autocapitalize: 'off' })),
      field('Phone', input('phone', { type: 'tel', required: true, inputmode: 'tel' }))
    ]),
    field('Temporary password', input('password', { required: true, minlength: 8, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
      'At least eight characters. Give it to them in person; they can change it later.'),
    el('div.field', null, [el('span', { text: 'Can take' }), quals]),
    el('div.field', null, [el('span', { text: 'Working days' }),
      el('div.boxes', null, WEEK_ORDER.map(d =>
        el('label', null, [el('input', { type: 'checkbox', name: 'day', value: d, checked: d !== 'sat' && d !== 'sun' }), el('span', { text: t(d) })])))]),
    hours.node,
    err
  ]);

  const save = el('button.btn', { type: 'button', text: 'Add employee', onclick: () => form.requestSubmit() });
  modal('Add an employee', form, [el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }), save]);
}

/* ---------- packages ---------- */
function packagesView(ctx) {
  const { state, now } = ctx;
  const plans = state.plans || [];

  /* The switch the website reads. Off is the safe side and the side it
     starts on, so prices stay in until someone here says otherwise. */
  const box = el('input', { type: 'checkbox', checked: !!state.showPrices, onchange: async e => {
    const want = e.target.checked;
    e.target.disabled = true;
    try {
      await store.setShowPrices(want);
      toast(want ? 'Prices are on the website now' : 'Prices are hidden on the website');
    } catch (ex) { e.target.checked = !want; e.target.disabled = false; toast(ex.message); }
  } });
  const toggle = el('div.pricesw', null, [
    el('label.check', null, [box, el('span', { text: 'Show prices to clients' })]),
    el('p.muted', { text: 'Off, the website and a client signed in here both list every package and what it includes, and say the price is coming soon. The price is not sent to them at all. You always see it.' })
  ]);

  const KIND = { single: 'Single class', membership: 'Monthly membership', package: 'Class package' };
  const line = a => a.limit == null
    ? t('Unlimited %s', a.types.map(typeShort).join(t(' or ')))
    : t('%s × %s', a.limit, a.types.map(typeShort).join(t(' or ')));

  return el('div', null, [toggle, datatable([
    { label: 'Package' }, { label: 'Price', cls: 'right' }, { label: 'What it allows' },
    { label: 'On it now', cls: 'right' }, { label: '', cls: 'right' }
  ], plans.map(p => {
    const on = (state.memberships || []).filter(m => m.planId === p.id && m.status === 'active' && !isExpired(m, now)).length;
    return [
      [el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [el('b', { text: p.name }), p.featured ? chip('Most popular', 'good') : null]),
       p.blurb ? el('div.cell-sub', { text: p.blurb }) : null],
      el('span.num', { text: money(p.price) }),
      el('span.small.muted', { text: t(KIND[p.kind] || 'Monthly membership') + ' · ' + p.allowances.map(line).join(' + ') + ' · ' +
        t('valid %s days', p.validityDays) + (p.bookable === false ? ' · ' + t('not online') : '') }),
      el('span.num', { text: String(on) }),
      el('div.rowend', null, [
        el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Edit', onclick: () => planEditor(ctx, p) }),
        el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Retire', onclick: () => retirePlan(ctx, p, on) })
      ])
    ];
  }), 'No packages yet. Add one and it appears to clients straight away.')]);
}

/* Add and edit are one form: the only difference is whether it starts with
   a package in it, and whether the id is already spoken for. */
function planEditor(ctx, plan) {
  const types = ctx.state.classTypes || [];
  const rows = el('div.allow');

  function addRow(a) {
    const picked = a ? a.types : (types[0] ? [types[0].id] : []);
    const row = el('div.allow__row', null, [
      el('div.allow__types', null, types.map(c => el('label.allow__type', null, [
        el('input', { type: 'checkbox', value: c.id, checked: picked.includes(c.id) }),
        el('span', { text: c.name })
      ]))),
      field('Classes', input('limit', {
        type: 'number', inputmode: 'numeric', min: '1', step: '1', placeholder: 'no limit',
        value: a && a.limit != null ? String(a.limit) : ''
      })),
      el('span'),
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Remove',
        onclick: () => { row.remove(); if (!rows.children.length) addRow(null); } })
    ]);
    rows.appendChild(row);
  }
  (plan && plan.allowances.length ? plan.allowances : [null]).forEach(addRow);

  const err = el('p.notice.notice--bad', { hidden: true });
  const fail = msg => { err.textContent = t(msg); err.hidden = false; err.scrollIntoView({ block: 'nearest' }); };
  const form = el('form', { novalidate: true, onsubmit: async e => {
    e.preventDefault();
    err.hidden = true;
    const f = new FormData(form);
    if (!String(f.get('name') || '').trim()) return fail('Give the package a name');
    const price = String(f.get('price') || '');
    if (!/^\d+$/.test(price)) return fail('Price must be a whole number of lek');
    const allowances = [...rows.children].map(row => ({
      types: [...row.querySelectorAll('.allow__types input:checked')].map(i => i.value),
      limit: row.querySelector('[name=limit]').value,
      per: 'month'
    }));
    if (allowances.some(a => !a.types.length)) return fail('Every line needs at least one class type');
    const validityDays = Number(f.get('validityDays'));
    if (!Number.isInteger(validityDays) || validityDays < 1) return fail('Valid for a whole number of days');
    save.disabled = true;
    try {
      await store.savePlan({
        id: plan ? plan.id : '',
        name: f.get('name'), price, blurb: f.get('blurb'),
        tagline: f.get('tagline'), rhythm: f.get('rhythm'),
        taglineEn: f.get('taglineEn'), rhythmEn: f.get('rhythmEn'), blurbEn: f.get('blurbEn'),
        sort: f.get('sort'), featured: form.querySelector('[name=featured]').checked,
        kind: f.get('kind'), validityDays, bookable: form.querySelector('[name=bookable]').checked,
        allowances
      });
      closeModal();
      toast(plan ? 'Package updated' : 'Package added — clients see it now');
    } catch (ex) { save.disabled = false; fail(ex.message); }
  } }, [
    field('Name', input('name', { value: plan ? plan.name : '', required: true, maxlength: '60', autocapitalize: 'characters' })),
    el('div.row.row--keep', null, [
      field('Price', input('price', { type: 'number', inputmode: 'numeric', min: '0', step: '1', required: true,
        value: plan ? String(plan.price) : '' }), 'In lek, whole numbers'),
      field('Order', input('sort', { type: 'number', inputmode: 'numeric', step: '1', value: plan && plan.sort ? String(plan.sort) : '', placeholder: '0' }),
        'Lowest first')
    ]),
    el('div.row.row--keep', null, [
      field('Kind', select('kind', [{ value: 'single', label: t('Single class') }, { value: 'membership', label: t('Monthly membership') },
                                    { value: 'package', label: t('Class package') }], plan ? plan.kind : 'membership')),
      field('Valid for (days)', input('validityDays', { type: 'number', inputmode: 'numeric', min: 1, value: plan ? plan.validityDays : 30 }),
        'Counted from the day it starts')
    ]),
    el('label.check', null, [
      el('input', { type: 'checkbox', name: 'featured', checked: !!(plan && plan.featured) }),
      el('span', { text: 'Show as the most popular package' })
    ]),
    el('label.check', null, [
      el('input', { type: 'checkbox', name: 'bookable', checked: !plan || plan.bookable !== false }),
      el('span', { text: 'Can be booked on the website' })
    ]),
    el('p.eyebrow.formsection', { text: 'Classes it includes' }),
    rows,
    el('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => addRow(null) }, [icon('plus'), el('span', { text: 'Add a line' })]),
    el('p.eyebrow.formsection', { text: 'How it reads on the website' }),
    field('Headline', input('tagline', { value: plan && plan.tagline ? plan.tagline : '', maxlength: '60' }),
      'The short line under the name — "The sweet spot"'),
    field('Rhythm', input('rhythm', { value: plan && plan.rhythm ? plan.rhythm : '', maxlength: '60' }),
      'How often it works out at — "Around 2x per week"'),
    field('Line underneath', input('blurb', { value: plan && plan.blurb ? plan.blurb : '', maxlength: '120' }),
      'The sentence at the foot of the card'),
    /* Optional, and the site falls back to what is above when one is left
       blank — so a studio that writes in Albanian only writes once. */
    el('details.en', null, [
      el('summary', { text: 'In English (optional)' }),
      el('div', { style: 'margin-top:8px' }, [
        field('Headline', input('taglineEn', { value: plan && plan.en && plan.en.tagline ? plan.en.tagline : '', maxlength: '60' })),
        field('Rhythm', input('rhythmEn', { value: plan && plan.en && plan.en.rhythm ? plan.en.rhythm : '', maxlength: '60' })),
        field('Line underneath', input('blurbEn', { value: plan && plan.en && plan.en.blurb ? plan.en.blurb : '', maxlength: '120' })),
        el('p.muted.small', { text: 'Left blank, the website shows the text above in both languages.' })
      ])
    ]),
    err
  ]);

  const save = el('button.btn', { type: 'button', text: 'Save', onclick: () => form.requestSubmit() });
  modal(plan ? t('Edit %s', plan.name) : t('New package'), form,
    [el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }), save], { wide: true });
}

function retirePlan(ctx, plan, on) {
  const body = el('div', null, [
    el('p', { text: on
      ? t(on === 1 ? '%s client is on %s right now. They keep it until it runs out — retiring only stops anyone new from buying it.'
                   : '%s clients are on %s right now. They keep it until it runs out — retiring only stops anyone new from buying it.', on, plan.name)
      : t('No one is on %s. It stops being offered.', plan.name) }),
    el('p.muted.small', { style: 'margin-top:10px', text: 'Nothing is deleted. The package stays on every membership that already names it.' })
  ]);
  modal(t('Retire %s', plan.name), body, [
    el('button.btn.btn--ghost', { type: 'button', text: 'Keep', onclick: closeModal }),
    el('button.btn', { type: 'button', text: 'Retire it', onclick: async ev => {
      ev.currentTarget.disabled = true;
      try { await store.archivePlan(plan.id); closeModal(); toast(t('%s retired', plan.name)); }
      catch (ex) { closeModal(); toast(ex.message); }
    } })
  ]);
}

/* ---------- clients ---------- */
/* A reset at the desk: a new password, shown once, read out, and gone
   from the screen when the dialog closes. Everything that account was
   signed in to is signed out. */
function resetFor(ctx, who) {
  const body = el('div', null, [
    el('p', { text: 'A new password is made now, shown once, and never shown again. Read it out, and ask them to change it after signing in.' }),
    el('p.muted.small', { style: 'margin-top:10px', text: 'Everywhere that account is signed in is signed out.' })
  ]);
  modal(t('Reset the password for %s', who.name), body, [
    el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }),
    el('button.btn', { type: 'button', text: 'Make a new password', onclick: async e => {
      e.currentTarget.disabled = true; e.currentTarget.textContent = t('One moment…');
      try {
        const r = await store.resetPassword(who.id);
        closeModal();
        modal(t('New password for %s', who.name), el('div', null, [
          el('p.fresh', { text: r.password }),
          el('p.muted.small', { style: 'margin-top:12px', text: 'Write it down before you close this. It is not kept anywhere you can read it back.' })
        ]), [el('button.btn', { type: 'button', text: 'Done', onclick: closeModal })]);
      } catch (ex) { closeModal(); toast(ex.message); }
    } })
  ]);
}

let clientQuery = '';
function clientsView(ctx) {
  const { state, now } = ctx;
  const today = todayIn(now);
  const table = el('div');

  const draw = () => {
    const q = clientQuery.trim().toLowerCase();
    const digits = q.replace(/\D+/g, '');
    const list = state.clients.filter(c => !q || [c.name, c.email].some(v => String(v || '').toLowerCase().includes(q)) ||
      (digits.length >= 3 && String(c.phone || '').replace(/\D+/g, '').includes(digits)));
    table.textContent = '';
    table.appendChild(datatable([
      { label: 'Client' }, { label: 'Packages' }, { label: 'Upcoming', cls: 'right' }, { label: 'Attended', cls: 'right' }, { label: '', cls: 'right' }
    ], list.map(c => {
      const pkgs = packagesOf(state, c.id, now);
      const bk = state.bookings.filter(b => b.clientId === c.id && b.status === 'booked');
      const dateOf = b => (state.classes.find(s => s.id === b.classId) || {}).date;
      const up = bk.filter(b => dateOf(b) >= today).length;
      const done = bk.filter(b => b.attendance === 'attended').length;
      return [
        [el('div', { text: c.name }), el('div.cell-sub', { text: [c.phone, c.email].filter(Boolean).join(' · ') })],
        pkgs.length ? el('div.chips', null, pkgs.map(m => {
          const s = creditSummary(state, m);
          return chip(m.title + ' · ' + (s.unlimited ? '∞' : t('%s left', s.left)), 'good');
        })) : chip('None', 'warn'),
        el('span.num', { text: String(up) }),
        el('span.num', { text: String(done) }),
        el('div.rowend', null, [
          el('button.btn.btn--sm' + (pkgs.length ? '.btn--ghost' : ''), { type: 'button', text: 'New reservation',
            onclick: () => newReservation(ctx, { client: c }) }),
          el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Reset password', onclick: () => resetFor(ctx, c) })
        ])
      ];
    }), state.clients.length ? 'No client matches that.' : 'No clients yet. They appear here when they reserve on the website or create an account.'));
  };

  const search = el('input.input', { type: 'search', value: clientQuery, placeholder: 'Search by name, email or phone',
    'aria-label': 'Search clients', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'search',
    oninput: e => { clientQuery = e.target.value; draw(); } });
  draw();
  return frag([el('div', { style: 'margin-bottom:16px;max-width:460px' }, search), table]);
}

/* ---------- attention ---------- */
/* rules.js hands over the pieces; the words are this screen's job. */
function problemText(p) {
  if (p.kind === 'unassigned') return t('Nobody assigned');
  if (p.kind === 'overfull') return t('%s booked, more than the places it has now', p.count);
  if (p.kind === 'outside-package') return t('Booked outside the dates of her package');
  return t('%s — %s', p.who, t(p.why));
}

function issuesView(ctx, problems) {
  if (!problems.length) return el('p.empty', { text: 'Nothing to fix. Every class has someone qualified and free.' });
  return el('div.grid', null, problems.map(p => {
    const c = p.booking && ctx.state.clients.find(x => x.id === p.booking.clientId);
    return el('div', { class: 'slot slot--' + p.klass.typeId }, [
      el('span.slot__time.num', { text: shortDate(p.klass.date) + ' · ' + range(p.klass) }),
      el('span.slot__name', null, [dot(p.klass.typeId), typeName(p.klass.typeId)]),
      el('span.slot__who', { style: 'white-space:normal', text: (c ? c.name + ' — ' : '') + problemText(p) }),
      el('span.slot__act', null, p.booking && p.booking.reservationId
        ? el('button.btn.btn--sm', { type: 'button', text: 'Open', onclick: () => reservationSheet(ctx, p.booking.reservationId) })
        : p.kind === 'overfull' ? el('button.btn.btn--sm', { type: 'button', text: 'Edit', onclick: () => classEditor(ctx, p.klass) })
        : el('button.btn.btn--sm', { type: 'button', text: 'Fix', onclick: () => assignDialog(ctx, p.klass) }))
    ]);
  }));
}
