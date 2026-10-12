/* The employee side — instructors and body therapists alike: what am I on,
   what do I take, and when can I work. */
import { el, frag, chip, dot, toast, modal, closeModal, typeName, typeShort, range, relDay, niceDate, t } from '../ui.js';
import * as store from '../store.js';
import { iso, addDays, startOfWeek, minutes, WEEK_ORDER } from '../../../shared/domain.js';
import { spots, availabilityCovers } from '../../../shared/rules.js';
import { shell } from './shell.js';

const DAY_LABEL = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
                    fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export function renderInstructor(ctx) {
  const { state, route } = ctx;
  /* `me` carries the role, qualifications and hours; the session user does not. */
  const user = { ...ctx.user, ...(state.me || {}) };
  ctx = { ...ctx, user };
  const therapist = user.job === 'therapist';
  const nav = [
    ['#/', 'My schedule', null, 'calendar'],
    ['#/teaching', therapist ? 'What I do' : 'What I teach', null, 'spark'],
    ['#/availability', 'My hours', null, 'clock']
  ];

  let title = 'My schedule', sub = '', body;
  if (route === 'teaching') { title = therapist ? 'What I do' : 'What I teach'; sub = 'The studio only places you on these'; body = teaching(ctx); }
  else if (route === 'availability') { title = 'My hours'; sub = 'The studio only places you inside these hours'; body = availability(ctx); }
  else { sub = niceDate(iso(ctx.now)); body = schedule(ctx); }

  return shell({ user, route, nav, title, sub, body, notices: state.notices });
}

const tile = (big, label, cls) => el('div', { class: 'tile' + (cls ? ' ' + cls : '') }, [el('b', { text: big }), el('span', { text: label })]);

/* ---------- schedule ---------- */
function schedule(ctx) {
  const { state, user, now } = ctx;
  const today = iso(now);
  const mine = state.classes.filter(s => s.instructorId === user.id && !s.cancelled && s.date >= today)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  const thisWeek = mine.filter(s => s.date <= iso(addDays(startOfWeek(now), 6)));
  const byDay = {};
  mine.slice(0, 60).forEach(s => (byDay[s.date] = byDay[s.date] || []).push(s));
  const workDays = WEEK_ORDER.filter(d => ((user.availability || {})[d] || []).length).length;

  return frag([
    el('div.tiles', { style: 'margin-bottom:24px' }, [
      tile(String(mine.filter(s => s.date === today).length), 'Today'),
      tile(String(thisWeek.length), 'This week'),
      tile((user.qualifications || []).map(typeShort).join(', ') || '—', 'I take', 'tile--text'),
      tile(t(workDays === 1 ? '%s day' : '%s days', workDays), 'Available', 'tile--text')
    ]),
    Object.keys(byDay).length
      ? el('div.grid', { style: 'gap:24px' }, Object.keys(byDay).map(d => el('section.day', null, [
          el('h2', { text: relDay(d, now) }),
          el('div.grid', null, byDay[d].map(s => {
            const cap = spots(state, s);
            const off = !availabilityCovers(user, s);
            return el('div', { class: 'slot slot--' + s.typeId }, [
              el('span.slot__time.num', { text: range(s) }),
              el('span.slot__name', null, [dot(s.typeId), typeName(s.typeId)]),
              el('span.slot__cap.num', { text: t('%s / %s booked', cap.taken, cap.capacity) }),
              el('span.slot__act', null, off ? chip('Outside your hours', 'warn')
                : chip(cap.full ? t('Full') : t(cap.left === 1 ? '%s place left' : '%s places left', cap.left), cap.full ? 'wine' : 'good'))
            ]);
          }))
        ])))
      : el('div.card', null, [
          el('p', { text: 'Nothing assigned to you yet.' }),
          el('p.muted.small', { style: 'margin-top:6px', text: 'The studio places you once your hours are set. Check that they are right.' }),
          el('a.btn.btn--sm.btn--ghost', { href: '#/availability', style: 'margin-top:14px', text: 'My hours' })
        ])
  ]);
}

/* ---------- what they take ---------- */
function teaching(ctx) {
  const { state, user } = ctx;
  const types = state.classTypes;
  return el('div.card', { style: 'max-width:600px' }, [
    el('p.muted', { style: 'margin-bottom:14px', text: 'Tick what you are happy to take on. The studio can only place you on these.' }),
    el('div.boxes', { style: 'flex-direction:column;align-items:stretch' }, types.map(c => {
      const on = user.qualifications.includes(c.id);
      return el('label', { style: 'border-radius:var(--r-sm);min-height:54px' }, [
        el('input', { type: 'checkbox', checked: on, onchange: e => {
          const box = e.target;
          const next = box.checked ? user.qualifications.concat(c.id) : user.qualifications.filter(x => x !== c.id);
          if (!next.length) { box.checked = true; toast('Keep at least one'); return; }
          box.disabled = true;
          store.setQualifications(next)
            .then(() => toast(t(box.checked ? 'Added %s' : 'Removed %s', c.short)))
            .catch(ex => { box.checked = !box.checked; box.disabled = false; toast(ex.message); });
        } }),
        dot(c.id),
        el('span', { style: 'flex:1', text: c.name })
      ]);
    }))
  ]);
}

/* ---------- hours ----------
   One window per day. A day is switched on or off with its box, and its
   window opens in a sheet where the two times sit side by side. */
function availability(ctx) {
  const { user } = ctx;
  const avail = user.availability || {};
  const save = next => store.setAvailability(next);

  function editDay(day) {
    const b = (avail[day] || [])[0] || { from: '09:00', to: '17:00' };
    const err = el('p.notice.notice--bad', { hidden: true });
    const from = el('input', { type: 'time', name: 'from', value: b.from, required: true });
    const to = el('input', { type: 'time', name: 'to', value: b.to, required: true });
    const form = el('form', { novalidate: true, onsubmit: async e => {
      e.preventDefault();
      if (!from.value || !to.value || minutes(from.value) >= minutes(to.value)) { err.textContent = t('Start must be before end'); err.hidden = false; return; }
      try {
        await save({ ...avail, [day]: [{ from: from.value, to: to.value }] });
        closeModal();
        toast('Saved');
      } catch (ex) { err.textContent = t(ex.message); err.hidden = false; }
    } }, [
      el('div.row.row--keep', null, [
        el('label.field', null, [el('span', { text: 'From' }), from]),
        el('label.field', null, [el('span', { text: 'Until' }), to])
      ]),
      err
    ]);
    modal(DAY_LABEL[day], form, [
      el('button.btn.btn--ghost', { type: 'button', text: 'Close', onclick: closeModal }),
      el('button.btn', { type: 'button', text: 'Save', onclick: () => form.requestSubmit() })
    ]);
  }

  return el('div.card', { style: 'max-width:640px;padding:6px 20px' }, [
    ...WEEK_ORDER.map((day, i) => {
      const bands = avail[day] || [];
      const on = bands.length > 0;
      const b = bands[0];
      return el('div', { style: 'display:flex;align-items:center;gap:12px;min-height:60px;' + (i ? 'border-top:1px solid var(--line-soft)' : '') }, [
        el('label.check', { style: 'flex:1;min-width:0' }, [
          el('input', { type: 'checkbox', checked: on,
            onchange: e => {
              const box = e.target;
              box.disabled = true;
              save({ ...avail, [day]: box.checked ? [{ from: '09:00', to: '17:00' }] : [] })
                .catch(ex => { box.checked = !box.checked; box.disabled = false; toast(ex.message); });
            } }),
          el('span', { text: DAY_LABEL[day] })
        ]),
        on ? el('button.btn.btn--ghost.btn--sm.num', { type: 'button', text: b.from + ' – ' + b.to, onclick: () => editDay(day) })
           : el('span.muted.small', { text: 'Not working' })
      ]);
    }),
    el('p.muted.small', { style: 'padding:12px 0 14px;border-top:1px solid var(--line-soft)',
      text: 'A class is only offered to you if it fits entirely inside your hours for that day.' })
  ]);
}
