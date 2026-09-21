/* Sign in, client registration, and the gated administrator route. */
import { el, field, input, toast } from '../ui.js';
import * as store from '../store.js';
import { ADMIN_CODE } from '../data.js';

const DEMO = [
  ['Administrator', 'admin@dua-pilates.com'],
  ['Instructor', 'elira@dua-pilates.com'],
  ['Client · Signature', 'sara@example.com'],
  ['Client · no membership left', 'enke@example.com']
];

export function renderAuth({ go }) {
  let tab = 'in';
  let asAdmin = false;

  const formHost = el('div');
  const tabs = el('div.tabs', { role: 'tablist' }, [
    el('button', { type: 'button', role: 'tab', text: 'Sign in', onclick: () => set('in') }),
    el('button', { type: 'button', role: 'tab', text: 'Create account', onclick: () => set('up') })
  ]);

  function set(next) {
    tab = next;
    Array.from(tabs.children).forEach((b, i) => b.classList.toggle('is-on', (i === 0) === (tab === 'in')));
    draw();
  }

  function draw() {
    formHost.textContent = '';
    formHost.appendChild(tab === 'in' ? signInForm() : signUpForm());
  }

  function signInForm() {
    const err = el('p.notice.notice--bad', { hidden: true });
    const form = el('form', {
      onsubmit: e => {
        e.preventDefault();
        const f = new FormData(form);
        const r = store.signIn(f.get('email'), f.get('password'));
        if (!r.ok) { err.textContent = r.message; err.hidden = false; return; }
        location.hash = '';
        toast('Welcome back');
      }
    }, [
      field('Email', input('email', { type: 'email', required: true, autocomplete: 'email' })),
      field('Password', input('password', { type: 'password', required: true, autocomplete: 'current-password' })),
      err,
      el('button.btn.btn--block', { type: 'submit', text: 'Sign in' })
    ]);
    return form;
  }

  function signUpForm() {
    const err = el('p.notice.notice--bad', { hidden: true });
    const codeField = field('Admin registration code',
      input('code', { type: 'password', autocomplete: 'off' }),
      'Issued by the studio. Without it the account cannot be created.');
    codeField.hidden = true;

    const toggle = el('label.field', { style: 'flex-direction:row;align-items:center;gap:10px' }, [
      el('input', { type: 'checkbox', name: 'isadmin', style: 'width:auto', onchange: e => {
        asAdmin = e.target.checked;
        codeField.hidden = !asAdmin;
        if (asAdmin) codeField.querySelector('input').focus();
      } }),
      el('span', { style: 'letter-spacing:.06em', text: 'Register as administrator' })
    ]);

    const form = el('form', {
      onsubmit: e => {
        e.preventDefault();
        const f = new FormData(form);
        const data = {
          name: f.get('name'), email: f.get('email'),
          phone: f.get('phone'), password: f.get('password')
        };
        const r = asAdmin
          ? store.registerAdmin({ ...data, code: f.get('code') }, ADMIN_CODE)
          : store.registerClient(data);
        if (!r.ok) { err.textContent = r.message; err.hidden = false; return; }
        location.hash = asAdmin ? '' : '#/memberships';
        toast(asAdmin ? 'Administrator account created' : 'Welcome to DUA');
      }
    }, [
      field('Full name', input('name', { required: true, autocomplete: 'name' })),
      field('Email', input('email', { type: 'email', required: true, autocomplete: 'email' })),
      field('Phone', input('phone', { type: 'tel', required: true, autocomplete: 'tel' })),
      field('Password', input('password', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password' })),
      toggle,
      codeField,
      err,
      el('button.btn.btn--block', { type: 'submit', text: 'Create account' })
    ]);
    return form;
  }

  set('in');

  return el('div.auth', null, [
    el('div.auth__art', null, [
      el('span.auth__logo', { role: 'img', 'aria-label': 'DUA Pilates and Spa', text: 'dua' }),
      el('h2', { html: 'Because <em>I want to.</em>' }),
      el('div.auth__demo', null, [
        el('p', { text: 'Demo accounts — password demo1234' }),
        ...DEMO.map(([label, email]) =>
          el('p', null, [el('b', { text: label }), ' · ', email]))
      ])
    ]),
    el('div.auth__form', null, [
      el('p.eyebrow', { text: 'Studio account' }),
      el('h1.display', { style: 'font-size:1.9rem;margin:8px 0 20px', text: 'Sign in to DUA' }),
      tabs, formHost
    ])
  ]);
}
