/* The studio's own side: dense, and built to answer "who is in the
   16:00 and who can teach it" without leaving the page. */
import { el, frag, chip, dot, modal, closeModal, toast, field, input, select, money, typeName, typeShort, range, niceDate, relDay, shortDate, startsAt, t, tw } from '../ui.js';
import * as store from '../store.js';
import { iso, addDays, startOfWeek, minutes } from '../../../shared/domain.js';
import { spots, suggestInstructors, instructorFit,
         membershipOf, isExpired, planOf, balances } from '../../../shared/rules.js';
import { shell } from './shell.js';

export function renderAdmin(ctx) {
  const { user, state, now, route } = ctx;
  const problems = state.issues || [];
  const nav = [
    ['#/', 'Dashboard'],
    ['#/schedule', 'Schedule'],
    ['#/instructors', 'Instructors'],
    ['#/packages', 'Packages'],
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
  } else if (route === 'packages') {
    title = 'Packages'; sub = 'What the studio sells, and what each one lets you book';
    actions = [el('button.btn.btn--sm', { type: 'button', text: 'Add package', onclick: () => planEditor(ctx, null) })];
    body = packagesView(ctx);
  } else if (route === 'memberships') { title = 'Memberships'; body = membershipsView(ctx); }
  else if (route === 'clients') { title = 'Clients'; body = clientsView(ctx); }
  else if (route === 'issues') { title = 'Needs attention'; sub = 'Things that were valid when they were set, and are not now'; body = issuesView(ctx, problems); }
  else { sub = relDay(iso(now), now); body = dashboard(ctx, problems); }

  return shell({ user, route, nav, title, sub, actions, body, notices: state.notices });
}

const tile = (big, label, note) => el('div.tile', null, [
  el('b', { class: 'num', text: big }), el('span', { text: label }), note ? el('i', { text: note }) : null
]);

/* ---------- dashboard ---------- */
function dashboard(ctx, problems) {
  const { state, now } = ctx;
  const today = iso(now);
  const live = state.classes.filter(s => !s.cancelled);
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
      tile(String(todays.length), "Today's classes", t('%s of %s seats booked', seatsToday, capToday)),
      tile(String(upcoming.length), 'Next 7 days'),
      tile(String(cancelled), 'Cancelled bookings')
    ]),
    problems.length ? el('div', { class: 'notice notice--warn', style: 'margin-top:18px' }, [
      el('span', { text: t(problems.length > 1 ? '%s classes need attention' : '%s class needs attention', problems.length) }),
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
    const list = state.classes.filter(s => s.date === schedAnchor).sort((a, b) => a.start.localeCompare(b.start));
    grid = el('div.grid', null, list.length ? list.map(s => adminSlot(ctx, s))
      : [el('p.muted', { text: t('Nothing on %s', niceDate(schedAnchor)) })]);
  } else {
    const weeks = schedMode === 'week' ? 1 : 4;
    const from = startOfWeek(anchor);
    grid = el('div.grid', { style: 'gap:10px' }, Array.from({ length: weeks }, (_, w) =>
      el('div.week', null, Array.from({ length: 7 }, (_, d) => {
        const date = iso(addDays(from, w * 7 + d));
        const list = state.classes.filter(s => s.date === date).sort((a, b) => a.start.localeCompare(b.start));
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
              el('span', { text: (i ? i.name.split(' ')[0] : t('⚠ unassigned')) + ' · ' + cap.taken + '/' + cap.capacity })
            ]);
          })
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
    el('div.tablewrap', { style: 'margin-top:14px' }, el('table', null, [
      el('thead', null, el('tr', null, [el('th', { text: 'Client' }), el('th.right', { text: 'Status' })])),
      el('tbody', null, booked.length
        ? booked.map(r => el('tr', null, [
            el('td', null, [el('div', { text: r.name }), el('div.muted', { style: 'font-size:12.5px', text: r.email })]),
            el('td.right', null, chip('Booked', 'good'))]))
        : [el('tr', null, el('td', { colspan: 2, class: 'muted', text: 'Nobody yet.' }))])
    ])),
    waiting.length ? el('div', { style: 'margin-top:16px' }, [
      el('p.eyebrow', { text: 'Waitlist' }),
      ...waiting.map(r => el('p', { style: 'font-size:14px', text: r.name }))
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
    el('button', { type: 'button', disabled: r.status !== 'recommended', onclick: async ev => {
      ev.currentTarget.disabled = true;
      try { await store.assignInstructor(s.id, r.instructor.id); closeModal(); toast(t('%s assigned', r.instructor.name)); }
      catch (ex) { closeModal(); toast(ex.message); }
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
      onclick: async () => { try { await store.assignInstructor(s.id, null); closeModal(); toast('Instructor removed'); }
                             catch (ex) { closeModal(); toast(ex.message); } } }) : null
  ]), null, { wide: true });
}

/* ---------- class editor ---------- */
function classEditor(ctx, s) {
  const { state, now } = ctx;
  const CLASS_TYPES = state.classTypes;
  const editing = !!s;
  const v = s || { typeId: 'reformer', date: iso(now), start: '18:00', end: '19:00', capacity: 10, instructorId: null };
  const err = el('p.notice.notice--bad', { hidden: true });

  const form = el('form', { onsubmit: async e => {
    e.preventDefault();
    err.hidden = true;
    const f = new FormData(form);
    const data = {
      id: s ? s.id : undefined,
      typeId: f.get('typeId'), date: f.get('date'),
      start: f.get('start'), end: f.get('end'),
      capacity: Number(f.get('capacity')),
      instructorId: f.get('instructorId') || null
    };
    /* Checked here so the answer is instant, and again on the server,
       which is the one that counts. */
    if (minutes(data.start) >= minutes(data.end)) { err.textContent = 'The class must end after it starts'; err.hidden = false; return; }
    if (data.instructorId) {
      const i = state.instructors.find(x => x.id === data.instructorId);
      const fit = instructorFit(state, i, { ...data, id: s ? s.id : 'new', cancelled: false });
      if (fit.status !== 'recommended') { err.textContent = t('%s — %s', i.name, t(fit.why).toLowerCase()); err.hidden = false; return; }
    }
    const booked = s ? spots(state, s).taken : 0;
    if (data.capacity < booked) { err.textContent = t('%s people are already booked; capacity cannot go below that', booked); err.hidden = false; return; }
    try { await store.saveClass(data); closeModal(); toast(editing ? 'Class updated' : 'Class added'); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
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
      onclick: async () => {
        try {
          const r = await store.cancelClass(s.id);
          closeModal();
          toast(r.affected ? t(r.affected > 1 ? 'Class cancelled — %s clients notified and refunded' : 'Class cancelled — %s client notified and refunded', r.affected)
                           : 'Class cancelled');
        } catch (ex) { closeModal(); toast(ex.message); }
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
      const upcoming = state.classes.filter(s => s.instructorId === i.id && !s.cancelled && s.date >= today).length;
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
  modal(t('Remove %s?', i.name), el('div', null, [
    el('p', { text: 'They lose access to the instructor dashboard straight away.' }),
    upcoming ? el('div', { class: 'notice notice--warn', style: 'margin-top:14px',
      text: t(upcoming > 1 ? '%s upcoming classes will be left unassigned. Bookings are kept, and those clients are told a new instructor is coming.' : '%s upcoming class will be left unassigned. Bookings are kept, and those clients are told a new instructor is coming.', upcoming) }) : null
  ]), [
    el('button.btn.btn--ghost', { type: 'button', text: 'Keep', onclick: closeModal }),
    el('button.btn', { type: 'button', text: 'Remove instructor', onclick: async ev => {
      ev.currentTarget.disabled = true;
      try {
        const r = await store.removeInstructor(i.id);
        closeModal();
        toast(r.orphaned ? t(r.orphaned > 1 ? 'Removed — %s classes now need an instructor' : 'Removed — %s class now needs an instructor', r.orphaned) : t('Removed'));
      } catch (ex) { closeModal(); toast(ex.message); }
    } })
  ]);
}

function instructorEditor(ctx) {
  const CLASS_TYPES = ctx.state.classTypes;
  const err = el('p.notice.notice--bad', { hidden: true });
  const quals = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, CLASS_TYPES.map(t =>
    el('label', { style: 'display:flex;align-items:center;gap:7px;font-size:14px' }, [
      el('input', { type: 'checkbox', name: 'q', value: t.id, style: 'width:auto' }), t.short ])));

  const form = el('form', { onsubmit: async e => {
    e.preventDefault();
    err.hidden = true;
    const f = new FormData(form);
    const qualifications = f.getAll('q');
    if (!qualifications.length) { err.textContent = 'Pick at least one class they can teach'; err.hidden = false; return; }
    const from = f.get('from'), to = f.get('to');
    const availability = {};
    ['mon','tue','wed','thu','fri','sat','sun'].forEach(d => { availability[d] = f.getAll('day').includes(d) ? [{ from, to }] : []; });
    try {
      await store.addInstructor({
        name: f.get('name'), email: f.get('email'), phone: f.get('phone'),
        password: f.get('password'), qualifications, availability
      });
      closeModal();
      toast('Instructor added — they can sign in now');
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
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

/* ---------- packages ---------- */
function packagesView(ctx) {
  const { state } = ctx;
  const plans = state.plans || [];

  /* The switch the website reads. Off is the safe side and the side it
     starts on, so prices stay in until someone here says otherwise. */
  const on = !!state.showPrices;
  const box = el('input', { type: 'checkbox', checked: on, onchange: async e => {
    const want = e.target.checked;
    try {
      await store.setShowPrices(want);
      toast(want ? 'Prices are on the website now' : 'Prices are hidden on the website');
    } catch (ex) { e.target.checked = !want; toast(ex.message); }
  } });
  const toggle = el('div.pricesw', null, [
    el('label.check', null, [box, el('span', { text: 'Show prices to clients' })]),
    el('p.muted', { style: 'font-size:13px;margin-top:4px',
      text: 'Off, the website and a client signed in here both list every package and what it includes, and say the price is coming soon. The price is not sent to them at all. You always see it.' })
  ]);

  if (!plans.length)
    return el('div', null, [toggle, el('p.muted', { text: 'No packages yet. Add one and it appears to clients straight away.' })]);

  const line = a => a.limit == null
    ? t('Unlimited %s per %s', a.types.map(typeName).join(t(' or ')), tw(a.per))
    : t('%s × %s per %s', a.limit, a.types.map(typeName).join(t(' or ')), tw(a.per));

  return el('div', null, [toggle, el('div.tablewrap', null, el('table', null, [
    el('thead', null, el('tr', null, [
      el('th', { text: 'Package' }), el('th.num', { text: 'Price' }),
      el('th', { text: 'What it allows' }), el('th', { text: 'On it now' }),
      el('th.right', { text: '' })
    ])),
    el('tbody', null, plans.map(p => {
      const on = (state.memberships || []).filter(m => m.planId === p.id && m.status === 'active').length;
      return el('tr', null, [
        el('td', null, [
          el('b', { text: p.name }),
          p.featured ? chip('Most popular', 'good') : null,
          p.blurb ? el('div.muted', { style: 'font-size:13px;margin-top:3px', text: p.blurb }) : null
        ]),
        el('td.num', { text: money(p.price) }),
        el('td.muted', { style: 'font-size:13px', text: p.allowances.map(line).join(' · ') }),
        el('td.num', { text: String(on) }),
        el('td.right', null, el('div.rowend', null, [
          el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Edit', onclick: () => planEditor(ctx, p) }),
          el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Retire',
            onclick: () => retirePlan(ctx, p, on) })
        ]))
      ]);
    }))
  ]))]);
}

/* Add and edit are one form: the only difference is whether it starts with
   a package in it, and whether the id is already spoken for. */
function planEditor(ctx, plan) {
  const types = ctx.state.classTypes || [];
  const rows = el('div.allow');

  function addRow(a) {
    const picked = a ? a.types : (types[0] ? [types[0].id] : []);
    const row = el('div.allow__row', null, [
      el('div.allow__types', null, types.map(t => {
        const id = 'ty' + Math.random().toString(36).slice(2);
        return el('label.allow__type', { for: id }, [
          el('input', { type: 'checkbox', id, value: t.id, checked: picked.includes(t.id) }),
          el('span', { text: t.name })
        ]);
      })),
      field('Classes', input('limit', {
        type: 'number', min: '1', step: '1', placeholder: 'no limit',
        value: a && a.limit != null ? String(a.limit) : ''
      })),
      field('Per', select('per', [
        { value: 'month', label: 'month' }, { value: 'week', label: 'week' }
      ], a ? a.per : 'month')),
      el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Remove',
        onclick: () => { row.remove(); if (!rows.children.length) addRow(null); } })
    ]);
    rows.appendChild(row);
  }
  (plan && plan.allowances.length ? plan.allowances : [null]).forEach(addRow);

  const err = el('p.err', { hidden: true });
  const form = el('form', { onsubmit: async e => {
    e.preventDefault();
    const f = new FormData(form);
    const allowances = [...rows.children].map(row => ({
      types: [...row.querySelectorAll('.allow__types input:checked')].map(i => i.value),
      limit: row.querySelector('[name=limit]').value,
      per: row.querySelector('[name=per]').value
    }));
    try {
      await store.savePlan({
        id: plan ? plan.id : '',
        name: f.get('name'), price: f.get('price'), blurb: f.get('blurb'),
        sort: f.get('sort'), featured: form.querySelector('[name=featured]').checked,
        allowances
      });
      closeModal();
      toast(plan ? 'Package updated' : 'Package added — clients see it now');
    } catch (ex) { err.hidden = false; err.textContent = ex.message; }
  } }, [
    field('Name', input('name', { value: plan ? plan.name : '', required: true, maxlength: '60' })),
    el('div.row', null, [
      field('Price', input('price', { type: 'number', min: '0', step: '1', required: true,
        value: plan ? String(plan.price) : '' }), 'In lek, whole numbers'),
      field('Order', input('sort', { type: 'number', step: '1', value: plan ? '' : '', placeholder: '0' }),
        'Lowest first')
    ]),
    field('Line underneath', input('blurb', { value: plan && plan.blurb ? plan.blurb : '', maxlength: '120' })),
    el('label.check', null, [
      el('input', { type: 'checkbox', name: 'featured', checked: !!(plan && plan.featured) }),
      el('span', { text: 'Show as the most popular package' })
    ]),
    el('p.eyebrow', { style: 'margin-top:22px', text: 'What it allows' }),
    rows,
    el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Add a line', onclick: () => addRow(null) }),
    err
  ]);

  modal(plan ? t('Edit %s', plan.name) : t('New package'), form,
    el('button.btn', { type: 'button', text: 'Save', onclick: () => form.requestSubmit() }));
}

function retirePlan(ctx, plan, on) {
  const body = el('div', null, [
    el('p', { text: on
      ? t(on === 1 ? '%s client is on %s right now. They keep it until it runs out — retiring only stops anyone new from buying it.'
                   : '%s clients are on %s right now. They keep it until it runs out — retiring only stops anyone new from buying it.', on, plan.name)
      : t('No one is on %s. It stops being offered.', plan.name) }),
    el('p.muted', { style: 'font-size:13px;margin-top:10px',
      text: 'Nothing is deleted. The package stays on every membership that already names it.' })
  ]);
  modal('Retire ' + plan.name, body, el('button.btn', { type: 'button', text: 'Retire it', onclick: async () => {
    try { await store.archivePlan(plan.id); closeModal(); toast(t('%s retired', plan.name)); }
    catch (ex) { closeModal(); toast(ex.message); }
  } }));
}

/* ---------- memberships ---------- */
function membershipsView(ctx) {
  const { state, now } = ctx;
  const waiting = state.memberships.filter(m => m.status === 'requested');

  /* The queue first, because it is the only part with something to do in it,
     and because the one rule that matters is easy to get wrong in a hurry. */
  const queue = el('div.queue', null, [
    el('p.queue__title', { text: waiting.length
      ? waiting.length + (waiting.length === 1 ? ' client is waiting' : ' clients are waiting')
      : 'Nobody is waiting' }),
    el('p.muted', { style: 'font-size:13px',
      text: 'A client applies in the app and pays here at the studio. Confirm it only once she has paid — '
          + 'confirming is what makes it active, for thirty days from that day. Until then she cannot book.' }),
    waiting.length ? el('div.queue__list', null, waiting.map(m => {
      const c = state.clients.find(x => x.id === m.clientId);
      const plan = planOf(state, m.planId);
      return el('div.queue__row', null, [
        el('div', null, [
          el('b', { text: c ? c.name : 'Unknown client' }),
          el('div.muted', { style: 'font-size:13px',
            text: (plan ? plan.name : m.planId) + ' · ' + t('asked %s', shortDate(m.start)) })
        ]),
        el('div.rowend', null, [
          el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Not paid',
            onclick: () => decideMembership(ctx, m, c, plan, false) }),
          el('button.btn.btn--sm', { type: 'button', text: 'Paid — confirm',
            onclick: () => decideMembership(ctx, m, c, plan, true) })
        ])
      ]);
    })) : null
  ]);

  return el('div', null, [queue, el('div.tablewrap', null, el('table', null, [
    el('thead', null, el('tr', null, [
      el('th', { text: 'Client' }), el('th', { text: 'Plan' }), el('th', { text: 'Usage this month' }),
      el('th', { text: 'Expires' }), el('th.right', { text: 'Status' }), el('th.right', { text: '' })
    ])),
    el('tbody', null, state.memberships.map(m => {
      const c = state.clients.find(x => x.id === m.clientId);
      const plan = planOf(state, m.planId);
      const rows = c ? balances(state, c.id, now) : [];
      const expired = isExpired(m, now);
      return el('tr', null, [
        el('td', { text: c ? c.name : '—' }),
        el('td', { text: plan ? plan.name : m.planId }),
        el('td.muted', { style: 'font-size:13px', text: rows.map(b =>
          b.label + ': ' + (b.unlimited ? '∞' : b.used + '/' + b.allowance.limit)).join(' · ') || '—' }),
        el('td.num', { text: shortDate(m.end) }),
        el('td.right', null, m.status === 'requested'
          ? chip('Waiting to be paid', 'warn')
          : chip(m.status === 'active' && !expired ? 'Active' : m.status === 'active' ? 'Expired' : m.status,
                 m.status === 'active' && !expired ? 'good' : 'warn')),
        el('td.right', null, el('button.btn.btn--ghost.btn--sm', { type: 'button', text: 'Adjust',
          onclick: () => membershipEditor(ctx, m, c) }))
      ]);
    }))
  ]))]);
}

function decideMembership(ctx, m, c, plan, paid) {
  const who = c ? c.name : 'this client';
  const what = plan ? plan.name : 'the package';
  const body = el('div', null, [
    el('p', { text: paid
      ? t('%s has paid for %s at the studio. Confirming makes it active for thirty days from today, and opens her calendar straight away.', who, what)
      : t('%s has not paid for %s. The application is closed and she is told to ask at the studio. She can apply again afterwards.', who, what) }),
    paid ? el('p.muted', { style: 'font-size:13px;margin-top:10px',
      text: 'Do not confirm before the money is in. This is the only step that checks it.' }) : null
  ]);
  modal(paid ? t('Confirm %s', what) : t('Close the application'), body,
    el('button.btn', { type: 'button', text: paid ? 'She has paid — confirm' : 'Close it', onclick: async () => {
      try {
        await (paid ? store.confirmMembership(m.id) : store.declineMembership(m.id));
        closeModal();
        toast(paid ? t('%s is active for %s', what, who) : t('Application closed'));
      } catch (ex) { closeModal(); toast(ex.message); }
    } }));
}

function membershipEditor(ctx, m, c) {
  const PLANS = ctx.state.plans;
  const form = el('form', { onsubmit: async e => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await store.updateMembership(m.id, { planId: f.get('planId'), end: f.get('end'), status: f.get('status') });
      closeModal();
      toast('Membership updated — the client sees it now');
    } catch (ex) { closeModal(); toast(ex.message); }
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

  modal(t('Adjust %s', c ? c.name : t('membership')), form, [
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
      const plan = m ? planOf(state, m.planId) : null;
      const bk = state.bookings.filter(b => b.clientId === c.id);
      const up = bk.filter(b => b.status === 'booked' &&
        (state.classes.find(s => s.id === b.classId) || {}).date >= today).length;
      const done = bk.filter(b => b.status === 'booked' &&
        (state.classes.find(s => s.id === b.classId) || {}).date < today).length;
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
    if (p.klass) return el('div', { class: 'slot slot--' + p.klass.typeId }, [
      el('span.slot__time.num', { text: shortDate(p.klass.date) + ' · ' + range(p.klass) }),
      el('span.slot__name', { text: typeName(p.klass.typeId) }),
      el('span.muted', { style: 'flex:1;font-size:13px', text: p.text }),
      el('span.slot__act', null, el('button.btn.btn--sm', { type: 'button', text: 'Fix',
        onclick: () => assignDialog(ctx, p.klass) }))
    ]);
    return el('div.notice.notice--warn', { text: p.text });
  }));
}
