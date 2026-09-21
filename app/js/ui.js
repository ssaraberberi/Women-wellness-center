/* ============================================================
   DUA — small rendering helpers
   No framework: el() builds nodes, and the views compose them.
   ============================================================ */
import { CLASS_TYPES, at, iso, addDays } from './data.js';

export function el(tag, props, kids) {
  const parts = tag.split('.');
  const node = document.createElement(parts[0] || 'div');
  if (parts.length > 1) node.className = parts.slice(1).join(' ');
  if (props) Object.keys(props).forEach(k => {
    const v = props[k];
    if (v == null || v === false) return;
    if (k === 'class') node.className = (node.className ? node.className + ' ' : '') + v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
    else if (k === 'disabled' || k === 'checked' || k === 'hidden' || k === 'selected') node[k] = !!v;
    else if (k === 'value') node.value = v;
    else node.setAttribute(k, v);
  });
  (Array.isArray(kids) ? kids : kids != null ? [kids] : []).forEach(k => {
    if (k == null || k === false) return;
    node.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  });
  return node;
}
export const frag = kids => { const f = document.createDocumentFragment(); kids.filter(Boolean).forEach(k => f.appendChild(k)); return f; };
export const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

/* ---------- formatting ---------- */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export const typeName = id => (CLASS_TYPES.find(t => t.id === id) || {}).name || id;
export const typeShort = id => (CLASS_TYPES.find(t => t.id === id) || {}).short || id;
export const range = s => s.start + '–' + s.end;

export function niceDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return WD[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
}
export function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return WD[d.getDay()].slice(0, 3) + ' ' + d.getDate();
}
export function relDay(dateStr, now) {
  const t = iso(now);
  if (dateStr === t) return 'Today';
  if (dateStr === iso(addDays(now, 1))) return 'Tomorrow';
  return niceDate(dateStr);
}
export const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
export const money = n => new Intl.NumberFormat('en-GB').format(n) + ' ALL';

/* ---------- modal ---------- */
let openScrim = null;
export function modal(title, body, foot, opts) {
  closeModal();
  const panel = el('div.modal' + ((opts && opts.wide) ? '.modal--wide' : ''), { role: 'dialog', 'aria-modal': 'true' }, [
    el('div.modal__head', null, [
      el('h2', { text: title }),
      el('button.x', { type: 'button', 'aria-label': 'Close', onclick: closeModal, text: '✕' })
    ]),
    body,
    foot ? el('div.modal__foot', null, foot) : null
  ]);
  const scrim = el('div.scrim', { onclick: e => { if (e.target === scrim) closeModal(); } }, panel);
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  openScrim = scrim;
  const focusable = panel.querySelector('input,select,button:not(.x),textarea');
  if (focusable) focusable.focus();
  return { close: closeModal, panel };
}
export function closeModal() {
  if (!openScrim) return;
  openScrim.remove(); openScrim = null; document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- toast ---------- */
let toastNode = null, toastTimer = null;
export function toast(text) {
  if (!toastNode) { toastNode = el('div.toast', { role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastNode); }
  toastNode.textContent = text;
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
