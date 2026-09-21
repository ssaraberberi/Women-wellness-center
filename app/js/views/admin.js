/* The studio's own side: dense, and built to answer "who is in the
   16:00 and who can teach it" without leaving the page. */
import { el, frag, chip, dot, modal, closeModal, toast, field, input, select, money,
         typeName, typeShort, range, niceDate, relDay, shortDate, startsAt } from '../ui.js';
import * as store from '../store.js';
import { CLASS_TYPES, PLANS, iso, addDays, startOfWeek, minutes } from '../data.js';
import { spots, bookingsFor, waitlistFor, suggestInstructors, instructorFit, issues,
         membershipOf, isExpired, planOf, balances, allowanceFor } from '../rules.js';
import { shell } from './shell.js';

export function renderAdmin(ctx) {
  const { user, state, now, route } = ctx;
  const problems = issues(state, now);
  const nav = [
    ['#/', 'Dashboard'],
    ['#/schedule', 'Schedule'],
    ['#/instructors', 'Instructors'],
    ['#/memberships', 'Memberships'],
    ['#/clients', 'Clients'],
    ['#/issues', 'Attention', problems.length || null]
  ];

  let title = 'Dashboard', sub = '', body, actions = null;
  if (route === 'schedule') {
    title = 'Schedule'; sub = 'Create, move and staff the timetable';
    actions = [el('button.btn.btn--sm', { type: 'button', text: 'Add class', onclick: () => classEditor(ctx, null) })];
    body = scheduleView(ctx);
  } else if (route === 'instructors') {
    title = 'Instructors';
    actions = [el('button.btn.btn--sm', { type: 'button', text: 'Add instructor', onclick: () => instructorEditor(ctx) })];
    body = instructorsView(ctx);
  } else if (route === 'memberships') { title = 'Memberships'; body = membershipsView(ctx); }
  else if (route === 'clients') { title = 'Clients'; body = clientsView(ctx); }
  else if (route === 'issues') { title = 'Needs attention'; sub = 'Things that were valid when they were set, and are not now'; body = issuesView(ctx, problems); }
  else { sub = relDay(iso(now), now); body = dashboard(ctx, problems); }

  return shell({ user, route, nav, title, sub, actions, body, notices: store.noticesFor(user.id) });
}

const tile = (big, label, note) => el('div.tile', null, [
  el('b', { class: 'num', text: big }), el('span', { text: label }), note ? el('i', { text: note }) : null
]);

/* ---------- dashboard ---------- */
function dashboard(ctx, problems) {
  const { state, now } = ctx;
  const today = iso(now);
  const live = state.sessions.filter(s => !s.cancelled);
  const todays = live.filter(s => s.date === today).sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = live.filter(s => s.date > today && s.date <= iso(addDays(now, 7)));
  const activeMems = state.memberships.filter(m => m.status === 'active' && !isExpired(m, now));
  const cancelled = state.bookings.filter(b => b.status === 'cancelled' || b.status === 'late').length;
  const seatsToday = todays.reduce((a, s) => a + spots(state, s).taken, 0);
  const capToday = todays.reduce((a, s) => a + s.capacity, 0);

  return frag([
    el('div.tiles', null, [
      tile(String(state.clients.length), 'Clients'),
      tile(String(activeMems.length), 'Active memberships'),
      tile(String(state.instructors.filter(i => i.active).length), 'Instructors'),
      tile(String(todays.length), "Today's classes", seatsToday + ' of ' + capToday + ' seats booked'),
      tile(String(upcoming.length), 'Next 7 days'),
      tile(String(cancelled), 'Cancelled bookings')
    ]),
    problems.length ? el('div', { class: 'notice notice--warn', style: 'margin-top:18px' }, [
      el('span', { text: problems.length + ' class' + (problems.length > 1 ? 'es need' : ' needs') + ' attention' }),
      el('a.linkish', { href: '#/issues', style: 'margin-left:auto', text: 'Review' })
    ]) : null,
    el('h2.display', { style: 'font-size:1.25rem;margin:26px 0 12px', text: "Today's classes" }),
    todays.length
      ? el('div.grid', null, todays.map(s => adminSlot(ctx, s)))
      : el('p.muted', { text: 'Nothing scheduled today.' })
  ]);
}

/* ---------- one admin class row ---------- */
function adminSlot(ctx, s) {
  const { state, now } = ctx;
  const cap = spots(state, s);
  const i = state.instructors.find(x => x.id === s.instructorId);
  const fit = i ? instructorFit(state, i, s) : null;
  const bad = !i || (fit && fit.status !== 'recommended');

  return el('div', { class: 'slot slot--' + s.typeId + (s.cancelled ? ' slot--off' : '') }, [
    el('span.slot__time.num', { text: range(s) }),
    el('span.slot__name', null, [dot(s.typeId), ' ', typeName(s.typeId)]),
    el('button.slot__who.linkish', { type: 'button', style: 'text-align:left',
      text: i ? i.name : 'Assign instructor', onclick: () => assignDialog(ctx, s) }),
    bad ? chip(i ? fit.why : 'Unassigned', 'warn') : null,
    el('span.slot__cap.num', { text: cap.taken + ' / ' + cap.capacity }),
    el('span.slot__act', null, el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Who booked', onclick: () => rosterDialog(ctx, s) }),
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Edit', onclick: () => classEditor(ctx, s) })
    ]))
  ]);
}

/* ---------- schedule: day / week / month ---------- */
let schedMode = 'week';
let schedAnchor = null;

function scheduleView(ctx) {
  const { state, now } = ctx;
  if (!schedAnchor) schedAnchor = iso(now);
  const anchor = new Date(schedAnchor + 'T00:00:00');

  const bar = el('div', { style: 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:18px' }, [
    el('div.switchbar', null, ['day', 'week', 'month'].map(mode =>
      el('button', { type: 'button', class: schedMode === mode ? 'is-on' : '', text: mode,
        onclick: () => { schedMode = mode; ctx.go(location.hash); } }))),
    el('div', { style: 'display:flex;gap:6px;margin-left:auto' }, [
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: '←', 'aria-label': 'Previous',
        onclick: () => { schedAnchor = iso(addDays(anchor, schedMode === 'day' ? -1 : schedMode === 'week' ? -7 : -28)); ctx.go(location.hash); } }),
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Today',
        onclick: () => { schedAnchor = iso(now); ctx.go(location.hash); } }),
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: '→', 'aria-label': 'Next',
        onclick: () => { schedAnchor = iso(addDays(anchor, schedMode === 'day' ? 1 : schedMode === 'week' ? 7 : 28)); ctx.go(location.hash); } })
    ])
  ]);

  let grid;
  if (schedMode === 'day') {
    const list = state.sessions.filter(s => s.date === schedAnchor).sort((a, b) => a.start.localeCompare(b.start));
    grid = el('div.grid', null, list.length ? list.map(s => adminSlot(ctx, s))
      : [el('p.muted', { text: 'Nothing on ' + niceDate(schedAnchor) })]);
  } else {
    const weeks = schedMode === 'week' ? 1 : 4;
    const from = startOfWeek(anchor);
    grid = el('div.grid', { style: 'gap:10px' }, Array.from({ length: weeks }, (_, w) =>
      el('div.week', null, Array.from({ length: 7 }, (_, d) => {
        const date = iso(addDays(from, w * 7 + d));
        const list = state.sessions.filter(s => s.date === date).sort((a, b) => a.start.localeCompare(b.start));
        return el('div', { class: 'week__day' + (date === iso(now) ? ' is-today' : '') }, [
          el('p.week__name', null, [shortDate(date).split(' ')[0], el('b', { text: shortDate(date).split(' ')[1] })]),
          ...list.map(s => {
            const cap = spots(state, s);
            const i = state.instructors.find(x => x.id === s.instructorId);
            return el('button', {
              type: 'button',
              class: 'mini mini--' + s.typeId + (cap.full ? ' mini--full' : ''),
              onclick: () => classEditor(ctx, s)
            }, [
              el('b', { text: s.start + ' ' + typeShort(s.typeId) }),
              el('span', { text: (i ? i.name.split(' ')[0] : '⚠ unassigned') + ' · ' + cap.taken + '/' + cap.capacity })
            ]);
          })
        ]);
      }))));
  }
  return frag([bar, grid]);
}

/* ---------- roster ---------- */
function rosterDialog(ctx, s) {
  const { state } = ctx;
  const booked = bookingsFor(state, s.id);
  const waiting = waitlistFor(state, s.id);
  const nameOf = id => (state.clients.find(c => c.id === id) || {}).name || 'Guest';

  modal(typeName(s.typeId) + ' · ' + range(s), el('div', null, [
    el('p.muted', { text: niceDate(s.date) + ' · ' + booked.length + ' of ' + s.capacity + ' booked' }),
    el('div.tablewrap', { style: 'margin-top:14px' }, el('table', null, [
      el('thead', null, el('tr', null, [el('th', { text: 'Client' }), el('th.right', { text: 'Status' })])),
      el('tbody', null, booked.length
        ? booked.map(b => el('tr', null, [
            el('td', { text: nameOf(b.clientId) }), el('td.right', null, chip('Booked', 'good'))]))
        : [el('tr', null, el('td', { colspan: 2, class: 'muted', text: 'Nobody yet.' }))])
    ])),
    waiting.length ? el('div', { style: 'margin-top:16px' }, [
      el('p.eyebrow', { text: 'Waitlist' }),
      ...waiting.map(b => el('p', { style: 'font-size:14px', text: nameOf(b.clientId) }))
    ]) : null
  ]), [el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal })], { wide: true });
}

/* ---------- instructor assignment, with recommendations ---------- */
function assignDialog(ctx, s) {
  const { state } = ctx;
  const ranked = suggestInstructors(state, s);
  const tone = { recommended: 'good', clash: 'warn', unavailable: 'warn', unqualified: '', removed: 'bad' };
  const good = ranked.filter(r => r.status === 'recommended');
  const rest = ranked.filter(r => r.status !== 'recommended');

  const list = who => el('div.sugg', null, who.map(r =>
    el('button', { type: 'button', disabled: r.status !== 'recommended', onclick: () => {
      const res = store.assignInstructor(s.id, r.instructor.id);
      closeModal();
      toast(res.ok ? r.instructor.name + ' assigned' : res.message);
    } }, [
      dot(s.typeId),
      el('b', { text: r.instructor.name }),
      el('small', { text: r.why }),
      chip(r.status, tone[r.status])
    ])));

  modal('Who teaches this class?', el('div', null, [
    el('p.muted', { text: typeName(s.typeId) + ' · ' + niceDate(s.date) + ' · ' + range(s) }),
    el('p.eyebrow', { style: 'margin:18px 0 8px', text: 'Recommended' }),
    good.length ? list(good) : el('p.muted', { text: 'Nobody qualified is free at this time.' }),
    rest.length ? frag([
      el('p.eyebrow', { style: 'margin:18px 0 8px', text: 'Not available' }),
      list(rest)
    ]) : null,
    s.instructorId ? el('button.linkish', { type: 'button', style: 'margin-top:16px', text: 'Remove instructor from this class',
      onclick: () => { store.assignInstructor(s.id, null); closeModal(); toast('Instructor removed'); } }) : null
  ]), null, { wide: true });
}

/* ---------- class editor ---------- */
function classEditor(ctx, s) {
  const { state, now } = ctx;
  const editing = !!s;
  const v = s || { typeId: 'reformer', date: iso(now), start: '18:00', end: '19:00', capacity: 10, instructorId: null };
  const err = el('p.notice.notice--bad', { hidden: true });

  const form = el('form', { onsubmit: e => {
    e.preventDefault();
    const f = new FormData(form);
    const data = {
      id: s ? s.id : undefined,
      typeId: f.get('typeId'), date: f.get('date'),
      start: f.get('start'), end: f.get('end'),
      capacity: Number(f.get('capacity')),
      instructorId: f.get('instructorId') || null,
      cancelled: s ? s.cancelled : false
    };
    if (minutes(data.start) >= minutes(data.end)) { err.textContent = 'The class must end after it starts'; err.hidden = false; return; }
    if (data.instructorId) {
      const i = state.instructors.find(x => x.id === data.instructorId);
      const fit = instructorFit(state, i, { ...data, id: s ? s.id : 'new' });
      if (fit.status !== 'recommended') { err.textContent = i.name + ' — ' + fit.why.toLowerCase(); err.hidden = false; return; }
    }
    const booked = s ? spots(state, s).taken : 0;
    if (data.capacity < booked) { err.textContent = booked + ' people are already booked; capacity cannot go below that'; err.hidden = false; return; }
    store.saveSession(data);
    closeModal();
    toast(editing ? 'Class updated' : 'Class added');
  } }, [
    field('Class', select('typeId', CLASS_TYPES.map(t => ({ value: t.id, label: t.name })), v.typeId)),
    el('div.row', null, [
      field('Date', input('date', { type: 'date', value: v.date, required: true })),
      field('Capacity', input('capacity', { type: 'number', min: 1, max: 40, value: v.capacity, required: true }))
    ]),
    el('div.row', null, [
      field('Starts', input('start', { type: 'time', value: v.start, required: true })),
      field('Ends', input('end', { type: 'time', value: v.end, required: true }))
    ]),
    field('Instructor', select('instructorId',
      [{ value: '', label: 'Decide later' }].concat(
        state.instructors.filter(i => i.active).map(i => ({ value: i.id, label: i.name }))), v.instructorId || ''),
      'Checked against qualifications, availability and clashes when you save.'),
    err
  ]);

  const foot = [
    editing ? el('button.linkish', { type: 'button', style: 'margin-right:auto', text: 'Cancel this class',
      onclick: () => {
        const n = spots(state, s).taken;
        store.cancelSession(s.id);
        closeModal();
        toast(n ? 'Class cancelled — ' + n + ' client' + (n > 1 ? 's' : '') + ' notified and refunded' : 'Class cancelled');
      } }) : null,
    el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }),
    el('button.btn', { type: 'button', text: editing ? 'Save changes' : 'Add class',
      onclick: () => form.requestSubmit() })
  ];

  modal(editing ? 'Edit class' : 'Add a class', form, foot);
}

/* ---------- instructors ---------- */
function instructorsView(ctx) {
  const { state, now } = ctx;
  const today = iso(now);
  return el('div.tablewrap', null, el('table', null, [
    el('thead', null, el('tr', null, [
      el('th', { text: 'Instructor' }), el('th', { text: 'Teaches' }), el('th', { text: 'Available' }),
      el('th.right', { text: 'Upcoming' }), el('th.right', { text: '' })
    ])),
    el('tbody', null, state.instructors.map(i => {
      const upcoming = state.sessions.filter(s => s.instructorId === i.id && !s.cancelled && s.date >= today).length;
      const days = ['mon','tue','wed','thu','fri','sat','sun'].filter(d => (i.availability[d] || []).length);
      return el('tr', null, [
        el('td', null, [
          el('div', { text: i.name }),
          el('div.muted', { style: 'font-size:12.5px', text: i.email + ' · ' + i.phone })
        ]),
        el('td', null, el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' },
          i.qualifications.map(q => chip(typeShort(q))))),
        el('td.muted', { style: 'font-size:13px', text: days.length ? days.join(', ') : 'none set' }),
        el('td.right.num', { text: String(upcoming) }),
        el('td.right', null, i.active
          ? el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Remove', onclick: () => removeDialog(ctx, i, upcoming) })
          : chip('Removed', 'bad'))
      ]);
    }))
  ]));
}

function removeDialog(ctx, i, upcoming) {
  modal('Remove ' + i.name + '?', el('div', null, [
    el('p', { text: 'They lose access to the instructor dashboard straight away.' }),
    upcoming ? el('div', { class: 'notice notice--warn', style: 'margin-top:14px',
      text: upcoming + ' upcoming class' + (upcoming > 1 ? 'es' : '') + ' will be left unassigned. Bookings are kept, and those clients are told a new instructor is coming.' }) : null
  ]), [
    el('button.btn.btn--ghost', { type: 'button', text: 'Keep', onclick: closeModal }),
    el('button.btn', { type: 'button', text: 'Remove instructor', onclick: () => {
      const r = store.removeInstructor(i.id);
      closeModal();
      toast(r.orphaned ? 'Removed — ' + r.orphaned + ' class' + (r.orphaned > 1 ? 'es' : '') + ' now need an instructor' : 'Removed');
    } })
  ]);
}

function instructorEditor(ctx) {
  const err = el('p.notice.notice--bad', { hidden: true });
  const quals = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, CLASS_TYPES.map(t =>
    el('label', { style: 'display:flex;align-items:center;gap:7px;font-size:14px' }, [
      el('input', { type: 'checkbox', name: 'q', value: t.id, style: 'width:auto' }), t.short ])));

  const form = el('form', { onsubmit: e => {
    e.preventDefault();
    const f = new FormData(form);
    const qualifications = f.getAll('q');
    if (!qualifications.length) { err.textContent = 'Pick at least one class they can teach'; err.hidden = false; return; }
    const from = f.get('from'), to = f.get('to');
    const availability = {};
    ['mon','tue','wed','thu','fri','sat','sun'].forEach(d => { availability[d] = f.getAll('day').includes(d) ? [{ from, to }] : []; });
    const r = store.addInstructor({
      name: f.get('name'), email: f.get('email'), phone: f.get('phone'),
      password: f.get('password'), qualifications, availability
    });
    if (!r.ok) { err.textContent = r.message; err.hidden = false; return; }
    closeModal();
    toast('Instructor added — they can sign in now');
  } }, [
    field('Full name', input('name', { required: true })),
    el('div.row', null, [
      field('Email', input('email', { type: 'email', required: true })),
      field('Phone', input('phone', { type: 'tel', required: true }))
    ]),
    field('Temporary password', input('password', { value: 'dua1234', required: true }), 'They can change it later.'),
    el('label.field', null, [el('span', { text: 'Qualified to teach' }), quals]),
    el('label.field', null, [el('span', { text: 'Working days' }),
      el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, ['mon','tue','wed','thu','fri','sat','sun'].map(d =>
        el('label', { style: 'display:flex;align-items:center;gap:6px;font-size:14px' }, [
          el('input', { type: 'checkbox', name: 'day', value: d, checked: d !== 'sat' && d !== 'sun', style: 'width:auto' }),
          d ])))]),
    el('div.row', null, [
      field('Available from', input('from', { type: 'time', value: '09:00', required: true })),
      field('Until', input('to', { type: 'time', value: '18:00', required: true }))
    ]),
    err
  ]);

  modal('Add an instructor', form, [
    el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }),
    el('button.btn', { type: 'button', text: 'Add instructor', onclick: () => form.requestSubmit() })
  ]);
}

/* ---------- memberships ---------- */
function membershipsView(ctx) {
  const { state, now } = ctx;
  return el('div.tablewrap', null, el('table', null, [
    el('thead', null, el('tr', null, [
      el('th', { text: 'Client' }), el('th', { text: 'Plan' }), el('th', { text: 'Usage this month' }),
      el('th', { text: 'Expires' }), el('th.right', { text: 'Status' }), el('th.right', { text: '' })
    ])),
    el('tbody', null, state.memberships.map(m => {
      const c = state.clients.find(x => x.id === m.clientId);
      const plan = planOf(m.planId);
      const rows = c ? balances(state, c.id, now) : [];
      const expired = isExpired(m, now);
      return el('tr', null, [
        el('td', { text: c ? c.name : '—' }),
        el('td', { text: plan ? plan.name : m.planId }),
        el('td.muted', { style: 'font-size:13px', text: rows.map(b =>
          b.label + ': ' + (b.unlimited ? '∞' : b.used + '/' + b.allowance.limit)).join(' · ') || '—' }),
        el('td.num', { text: shortDate(m.end) }),
        el('td.right', null, chip(m.status === 'active' && !expired ? 'Active' : m.status === 'active' ? 'Expired' : m.status,
          m.status === 'active' && !expired ? 'good' : 'warn')),
        el('td.right', null, el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Adjust',
          onclick: () => membershipEditor(ctx, m, c) }))
      ]);
    }))
  ]));
}

function membershipEditor(ctx, m, c) {
  const form = el('form', { onsubmit: e => {
    e.preventDefault();
    const f = new FormData(form);
    store.updateMembership(m.id, { planId: f.get('planId'), end: f.get('end'), status: f.get('status') });
    closeModal();
    toast('Membership updated — the client sees it now');
  } }, [
    field('Plan', select('planId', PLANS.map(p => ({ value: p.id, label: p.name })), m.planId)),
    el('div.row', null, [
      field('Expires', input('end', { type: 'date', value: m.end, required: true })),
      field('Status', select('status', [
        { value: 'active', label: 'Active' }, { value: 'cancelled', label: 'Cancelled' }
      ], m.status))
    ]),
    el('p.muted', { style: 'font-size:13px', text: 'Extending the date or changing the plan takes effect immediately, including for classes already booked.' })
  ]);

  modal('Adjust ' + (c ? c.name : 'membership'), form, [
    el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }),
    el('button.btn', { type: 'button', text: 'Save', onclick: () => form.requestSubmit() })
  ]);
}

/* ---------- clients ---------- */
function clientsView(ctx) {
  const { state, now } = ctx;
  const today = iso(now);
  return el('div.tablewrap', null, el('table', null, [
    el('thead', null, el('tr', null, [
      el('th', { text: 'Client' }), el('th', { text: 'Membership' }),
      el('th.right', { text: 'Upcoming' }), el('th.right', { text: 'Attended' })
    ])),
    el('tbody', null, state.clients.map(c => {
      const m = membershipOf(state, c.id);
      const plan = m ? planOf(m.planId) : null;
      const bk = state.bookings.filter(b => b.clientId === c.id);
      const up = bk.filter(b => b.status === 'booked' &&
        (state.sessions.find(s => s.id === b.sessionId) || {}).date >= today).length;
      const done = bk.filter(b => b.status === 'booked' &&
        (state.sessions.find(s => s.id === b.sessionId) || {}).date < today).length;
      return el('tr', null, [
        el('td', null, [el('div', { text: c.name }), el('div.muted', { style: 'font-size:12.5px', text: c.email })]),
        el('td', null, plan && !isExpired(m, now) ? chip(plan.name, 'good') : chip('None', 'warn')),
        el('td.right.num', { text: String(up) }),
        el('td.right.num', { text: String(done) })
      ]);
    }))
  ]));
}

/* ---------- attention ---------- */
function issuesView(ctx, problems) {
  if (!problems.length) return el('p.muted', { text: 'Nothing to fix. Every class has an instructor who is qualified and free.' });
  return el('div.grid', null, problems.map(p => {
    if (p.session) return el('div', { class: 'slot slot--' + p.session.typeId }, [
      el('span.slot__time.num', { text: shortDate(p.session.date) + ' · ' + range(p.session) }),
      el('span.slot__name', { text: typeName(p.session.typeId) }),
      el('span.muted', { style: 'flex:1;font-size:13px', text: p.text }),
      el('span.slot__act', null, el('button.btn.btn--sm', { type: 'button', text: 'Fix',
        onclick: () => assignDialog(ctx, p.session) }))
    ]);
    return el('div.notice.notice--warn', { text: p.text });
  }));
}
