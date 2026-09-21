/* The instructor side: what am I teaching, and when can I teach. */
import { el, frag, chip, dot, toast, typeName, typeShort, range, relDay, shortDate, startsAt } from '../ui.js';
import * as store from '../store.js';
import { CLASS_TYPES, DAYS, iso, addDays, startOfWeek, minutes } from '../data.js';
import { spots, availabilityCovers } from '../rules.js';
import { shell } from './shell.js';

const DAY_LABEL = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
                    fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function renderInstructor(ctx) {
  const { user, route } = ctx;
  const nav = [['#/', 'My schedule'], ['#/teaching', 'What I teach'], ['#/availability', 'My availability']];

  let title = 'My schedule', sub = '', body;
  if (route === 'teaching') { title = 'What I teach'; sub = 'The classes you are qualified and willing to take'; body = teaching(ctx); }
  else if (route === 'availability') { title = 'My availability'; sub = 'The studio only offers you classes inside these hours'; body = availability(ctx); }
  else { sub = 'Your assigned classes'; body = schedule(ctx); }

  return shell({ user, route, nav, title, sub, body, notices: store.noticesFor(user.id) });
}

/* ---------- schedule ---------- */
function schedule(ctx) {
  const { state, user, now } = ctx;
  const today = iso(now);
  const mine = state.sessions.filter(s => s.instructorId === user.id && !s.cancelled && s.date >= today)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  const thisWeek = mine.filter(s => s.date <= iso(addDays(startOfWeek(now), 6)));
  const byDay = {};
  mine.slice(0, 40).forEach(s => (byDay[s.date] = byDay[s.date] || []).push(s));

  return frag([
    el('div.tiles', { style: 'margin-bottom:22px' }, [
      tile(String(thisWeek.length), 'Classes this week'),
      tile(String(mine.filter(s => s.date === today).length), 'Today'),
      tile(user.qualifications.map(typeShort).join(', ') || '—', 'Qualified for'),
      tile(WEEK.filter(d => (user.availability[d] || []).length).length + ' days', 'Available')
    ]),
    Object.keys(byDay).length
      ? el('div.grid', { style: 'gap:20px' }, Object.keys(byDay).map(d => el('section', null, [
          el('h2.display', { style: 'font-size:1.1rem;margin-bottom:10px', text: relDay(d, now) }),
          el('div.grid', null, byDay[d].map(s => {
            const cap = spots(state, s);
            const off = !availabilityCovers(user, s);
            return el('div', { class: 'slot slot--' + s.typeId }, [
              el('span.slot__time.num', { text: range(s) }),
              el('span.slot__name', null, [dot(s.typeId), ' ', typeName(s.typeId)]),
              el('span.slot__cap.num', { text: cap.taken + ' / ' + cap.capacity + ' booked' }),
              el('span.slot__act', null, off ? chip('Outside your hours', 'warn') : chip(cap.full ? 'Full' : cap.left + ' free',
                cap.full ? 'wine' : 'good'))
            ]);
          }))
        ])))
      : el('p.muted', { text: 'No classes assigned yet. The studio will place you once your availability is set.' })
  ]);
}

const tile = (big, label, note) => el('div.tile', null, [
  el('b', { text: big }), el('span', { text: label }), note ? el('i', { text: note }) : null
]);

/* ---------- qualifications ---------- */
function teaching(ctx) {
  const { user } = ctx;
  return el('div.card', { style: 'max-width:560px' }, [
    el('p.muted', { style: 'margin-bottom:16px',
      text: 'Tick what you are happy to teach. The studio can only place you in these classes.' }),
    el('div.grid', null, CLASS_TYPES.map(t => {
      const on = user.qualifications.includes(t.id);
      return el('label', { style: 'display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line-soft);border-radius:var(--r-sm);background:var(--blush-lift);cursor:pointer' }, [
        el('input', { type: 'checkbox', checked: on, style: 'width:auto', onchange: e => {
          const next = e.target.checked
            ? user.qualifications.concat(t.id)
            : user.qualifications.filter(x => x !== t.id);
          store.updateInstructor(user.id, { qualifications: next });
          toast(e.target.checked ? 'Added ' + t.short : 'Removed ' + t.short);
        } }),
        dot(t.id),
        el('span', { style: 'flex:1', text: t.name })
      ]);
    }))
  ]);
}

/* ---------- availability ---------- */
function availability(ctx) {
  const { user } = ctx;

  function setBand(day, which, value) {
    const bands = (user.availability[day] || []).slice();
    if (!bands.length) bands.push({ from: '09:00', to: '17:00' });
    bands[0] = { ...bands[0], [which]: value };
    if (minutes(bands[0].from) >= minutes(bands[0].to)) { toast('Start must be before end'); return; }
    store.updateInstructor(user.id, { availability: { ...user.availability, [day]: bands } });
  }

  function toggleDay(day, on) {
    const next = { ...user.availability, [day]: on ? [{ from: '09:00', to: '17:00' }] : [] };
    store.updateInstructor(user.id, { availability: next });
  }

  return el('div.card', { style: 'max-width:640px' }, [
    el('p.muted', { style: 'margin-bottom:16px',
      text: 'A class is only offered to you if it fits entirely inside one of these windows.' }),
    el('div.grid', null, WEEK.map(day => {
      const bands = user.availability[day] || [];
      const on = bands.length > 0;
      const b = bands[0] || { from: '09:00', to: '17:00' };
      return el('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 0;border-top:1px solid var(--line-soft)' }, [
        el('label', { style: 'display:flex;align-items:center;gap:10px;width:140px;cursor:pointer' }, [
          el('input', { type: 'checkbox', checked: on, style: 'width:auto',
            onchange: e => toggleDay(day, e.target.checked) }),
          el('span', { text: DAY_LABEL[day] })
        ]),
        on ? el('div', { style: 'display:flex;align-items:center;gap:8px' }, [
          el('input', { type: 'time', value: b.from, style: 'width:120px',
            onchange: e => setBand(day, 'from', e.target.value) }),
          el('span.muted', { text: '–' }),
          el('input', { type: 'time', value: b.to, style: 'width:120px',
            onchange: e => setBand(day, 'to', e.target.value) })
        ]) : el('span.muted', { style: 'font-size:13px', text: 'Not available' })
      ]);
    }))
  ]);
}
