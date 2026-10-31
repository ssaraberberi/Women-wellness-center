/* ============================================================
   DUA — small rendering helpers
   No framework: el() builds nodes, and the views compose them.
   ============================================================ */
import { at, iso, addDays, minutes, mergeBands } from '../../shared/domain.js';
import { t, tw } from './i18n.js';
export { t, tw, setLang, getLang, onLang } from './i18n.js';

/* The class types come from the server at boot; the helpers below read
   whatever was last handed over rather than a hard-coded list. */
let CATALOGUE = [];
export const setCatalogue = types => { CATALOGUE = types || []; };

export function el(tag, props, kids) {
  const parts = tag.split('.');
  const node = document.createElement(parts[0] || 'div');
  if (parts.length > 1) node.className = parts.slice(1).join(' ');
  if (props) Object.keys(props).forEach(k => {
    const v = props[k];
    if (v == null || v === false) return;
    if (k === 'class') node.className = (node.className ? node.className + ' ' : '') + v;
    /* The one place every visible word passes through. A view writes
       English; what lands in the DOM is the reader's language. */
    else if (k === 'text') node.textContent = t(v);
    else if (k === 'html') node.innerHTML = v;
    else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
    else if (k === 'disabled' || k === 'checked' || k === 'hidden' || k === 'selected') node[k] = !!v;
    else if (k === 'value') node.value = v;
    else if (k === 'aria-label' || k === 'placeholder' || k === 'title') node.setAttribute(k, t(v));
    else node.setAttribute(k, v);
  });
  (Array.isArray(kids) ? kids : kids != null ? [kids] : []).forEach(k => {
    if (k == null || k === false) return;
    node.appendChild(typeof k === 'string' ? document.createTextNode(t(k))
                   : typeof k === 'number' ? document.createTextNode(String(k)) : k);
  });
  return node;
}
export const frag = kids => { const f = document.createDocumentFragment(); kids.filter(Boolean).forEach(k => f.appendChild(k)); return f; };
export const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

/* ---------- formatting ---------- */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export const typeName = id => (CATALOGUE.find(t => t.id === id) || {}).name || id;
export const typeShort = id => (CATALOGUE.find(t => t.id === id) || {}).short || id;
export const range = s => s.start + '–' + s.end;

/* Dates are built from translated parts rather than from Intl, so the
   weekday and the month read the same here as everywhere else in the app. */
export function niceDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return t('%s, %s %s', t(WD[d.getDay()]), t(MONTHS[d.getMonth()]), d.getDate());
}
export function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return t(WD[d.getDay()].slice(0, 3)) + ' ' + d.getDate();
}
/* "30 Sep" — for a date that may be weeks away, where a weekday alone
   would not say which week. */
export function dayMonth(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDate() + ' ' + t(MONTHS[d.getMonth()].slice(0, 3));
}
export function relDay(dateStr, now) {
  if (dateStr === iso(now)) return t('Today');
  if (dateStr === iso(addDays(now, 1))) return t('Tomorrow');
  return niceDate(dateStr);
}
export const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
export const money = n => new Intl.NumberFormat('en-GB').format(n) + ' ALL';
export const dayShort = key => t(key.charAt(0).toUpperCase() + key.slice(1));

/* The server writes dates into the notices it composes as 2026-10-12;
   nobody should have to read that. Every ISO date in a sentence becomes
   the same "Monday, October 12" the rest of the app uses. */
export const dateText = s => String(s == null ? '' : s)
  .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (_, d) => niceDate(d));

/* What an employee does, in words. Everyone on the staff side signs in as
   role 'instructor'; `job` says which kind they are. */
export const jobLabel = job => t(job === 'therapist' ? 'Body therapist / Physiotherapist' : 'Instructor');

/* A phone or a tablet: no hover, a finger rather than a cursor. Used to
   decide things a stylesheet cannot, such as whether opening a dialog
   should raise the keyboard. */
export const touch = () => typeof matchMedia === 'function' && matchMedia('(hover: none), (pointer: coarse)').matches;

/* ---------- icons ----------
   Drawn here rather than loaded: a handful of strokes, in currentColor, so
   they follow whatever they sit in. Static strings, never data. */
const ICONS = {
  home: '<path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6h-5.6v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.8h17M8 3v4M16 3v4"/>',
  clients: '<circle cx="9" cy="8.2" r="3.4"/><path d="M3 19.8c.6-3.5 3-5.4 6-5.4s5.4 1.9 6 5.4"/><circle cx="17" cy="9" r="2.5"/><path d="M16.6 14.5c2.4.2 4 1.8 4.6 4.3"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M6.5 14.8h4.5"/>',
  staff: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20.2c.8-3.9 3.6-5.9 7-5.9s6.2 2 7 5.9"/>',
  tag: '<path d="M3.5 12.2V5A1.5 1.5 0 0 1 5 3.5h7.2l8.3 8.3-8.7 8.7z"/><circle cx="8" cy="8" r="1.4"/>',
  alert: '<path d="M12 4 3 19.5h18z"/><path d="M12 10v4.4M12 17v.2"/>',
  list: '<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/><path d="m4 6.5 1.1 1.1L7 5.6M4 12l1.1 1.1L7 11.1M4 17.5l1.1 1.1L7 16.6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  spark: '<path d="M12 3.5 13.9 9 19.5 11l-5.6 2-1.9 5.5-1.9-5.5L4.5 11 10.1 9z"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.9-3.8 3.8-5.8 7.5-5.8s6.6 2 7.5 5.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  right: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m19.5 19.5-3.8-3.8"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>'
};
export function icon(name) {
  const n = el('span.ico', { 'aria-hidden': 'true' });
  n.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    (ICONS[name] || '') + '</svg>';
  return n;
}

/* ---------- dialogs ----------
   A centred dialog on a desk, a sheet from the bottom on a phone or a
   tablet held in portrait — the stylesheet decides which. Focus goes in
   when it opens and back to whatever opened it when it closes; Tab stays
   inside it. On a touch screen nothing is focused on open, because
   focusing a field raises the keyboard over the very thing she opened. */
let openScrim = null, returnTo = null;
export function modal(title, body, foot, opts) {
  closeModal();
  const o = opts || {};
  const id = 'dlg' + Math.random().toString(36).slice(2, 8);
  const panel = el('div.modal' + (o.wide ? '.modal--wide' : ''), {
    role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id, tabindex: '-1'
  }, [
    el('span.modal__grab', { 'aria-hidden': 'true' }),
    el('div.modal__head', null, [
      el('h2', { id, text: t(title) }),
      el('button.x', { type: 'button', 'aria-label': 'Close', onclick: closeModal }, icon('close'))
    ]),
    el('div.modal__body', null, body),
    foot ? el('div.modal__foot', null, foot) : null
  ]);
  const scrim = el('div.scrim', { onclick: e => { if (e.target === scrim) closeModal(); } }, panel);
  returnTo = document.activeElement;
  document.body.appendChild(scrim);
  document.documentElement.classList.add('is-locked');
  openScrim = scrim;
  const first = !touch() && panel.querySelector('.modal__body input:not([type=checkbox]):not([type=radio]),.modal__body select,.modal__body textarea');
  (first || panel).focus({ preventScroll: true });
  return { close: closeModal, panel };
}
export function closeModal() {
  if (!openScrim) return;
  openScrim.remove(); openScrim = null;
  document.documentElement.classList.remove('is-locked');
  if (returnTo && document.contains(returnTo)) returnTo.focus({ preventScroll: true });
  returnTo = null;
}
document.addEventListener('keydown', e => {
  if (!openScrim) return;
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key !== 'Tab') return;
  const items = [...openScrim.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')]
    .filter(n => !n.disabled && n.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* ---------- tables ----------
   A table on a desk; on a phone each row becomes a card, every value under
   its own heading. The headings travel with the cells as data-label, so
   the stylesheet can do that without a second layout to keep in step.
   cols: [{ label, cls }]; rows: arrays of cells (node, string or null). */
export function datatable(cols, rows, empty) {
  if (!rows.length && empty) return el('p.empty', { text: empty });
  return el('div.tablewrap', null, el('table.rtable', null, [
    el('thead', null, el('tr', null, cols.map(c => el('th', { class: c.cls || null, text: c.label || '' })))),
    el('tbody', null, rows.map(cells => el('tr', null, cells.map((cell, i) => {
      const c = cols[i] || {};
      return el('td', { class: c.cls || null, 'data-label': c.label ? t(c.label) : null }, cell);
    }))))
  ]));
}

/* ---------- toast ---------- */
let toastNode = null, toastTimer = null;
export function toast(text) {
  if (!toastNode) { toastNode = el('div.toast', { role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastNode); }
  toastNode.textContent = t(text);
  toastNode.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('is-on'), 2600);
}

/* ---------- bits ---------- */
export const chip = (text, tone) => el('span.chip' + (tone ? '.chip--' + tone : ''), { text });
export const dot = typeId => el('i.dot.dot--' + typeId, { 'aria-hidden': 'true' });

export function field(label, input, hint) {
  return el('label.field', null, [el('span', { text: label }), input, hint ? el('small', { text: hint }) : null]);
}
export function input(name, attrs) {
  return el('input', Object.assign({ name, type: 'text', autocomplete: 'off' }, attrs || {}));
}
/* The stretches of a working day, 07:00–08:00 then 15:00–18:00. read()
   hands back the bands in order, or null if one of them makes no sense. */
export function bandsEditor(bands) {
  const list = el('div.bands');
  const sync = () => list.classList.toggle('bands--one', list.children.length < 2);
  const row = b => {
    const r = el('div.band', null, [
      field('Available from', el('input', { type: 'time', value: b.from, required: true })),
      field('Until', el('input', { type: 'time', value: b.to, required: true })),
      el('button.iconbtn', { type: 'button', 'aria-label': 'Remove', onclick: () => { r.remove(); sync(); } }, icon('close'))
    ]);
    return r;
  };
  bands.forEach(b => list.appendChild(row(b)));
  sync();
  const add = () => {
    const r = row({ from: '', to: '' });
    list.appendChild(r);
    sync();
    r.querySelector('input').focus();
  };
  const read = () => {
    const out = [...list.children].map(r => {
      const [from, to] = r.querySelectorAll('input');
      return { from: from.value, to: to.value };
    });
    if (out.some(b => !b.from || !b.to || minutes(b.from) >= minutes(b.to))) return null;
    return mergeBands(out);
  };
  return {
    node: el('div', null, [list, el('button.linkish', { type: 'button', style: 'margin-bottom:16px', text: 'Add a time', onclick: add })]),
    read
  };
}
export function select(name, options, value) {
  return el('select', { name }, options.map(o =>
    el('option', { value: o.value, selected: o.value === value, text: o.label })));
}
export function meter(used, total) {
  const n = Math.min(total, 24);
  return el('div.meter', { 'aria-hidden': 'true' },
    Array.from({ length: n }, (_, i) => el('i', { class: i < used ? 'is-used' : '' })));
}
export const startsAt = s => at(s.date, s.start);
