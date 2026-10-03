/* Sign in, client registration, and the gated administrator route.
   The admin code is checked by the server; this form only carries it. */
import { el, field, input, toast, t } from '../ui.js';
import * as store from '../store.js';
import { langToggle } from './shell.js';

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
    formHost.textContent = '';
    formHost.appendChild(tab === 'in' ? signInForm() : signUpForm());
  }

  const busy = (btn, on, label) => { btn.disabled = on; btn.textContent = on ? 'One moment…' : label; };

  function signInForm() {
    const err = el('p.notice.notice--bad', { hidden: true });
    const submit = el('button.btn.btn--block', { type: 'submit', text: 'Sign in' });
    const form = el('form', { onsubmit: async e => {
      e.preventDefault();
      err.hidden = true; busy(submit, true, 'Sign in');
      const f = new FormData(form);
      try {
        await store.signIn(f.get('email'), f.get('password'));
        location.hash = '';
        toast('Welcome back');
      } catch (ex) { err.textContent = ex.message; err.hidden = false; busy(submit, false, 'Sign in'); }
    } }, [
      field('Email', input('email', { type: 'email', required: true, autocomplete: 'email' })),
      field('Password', input('password', { type: 'password', required: true, autocomplete: 'current-password' })),
      err, submit
    ]);
    return form;
  }

  function signUpForm() {
    const err = el('p.notice.notice--bad', { hidden: true });
    const codeField = field('Admin registration code',
      input('code', { type: 'password', autocomplete: 'off' }),
      'Issued by the studio, and checked on the server.');
    codeField.hidden = true;

    const toggle = el('label.field', { style: 'flex-direction:row;align-items:center;gap:10px' }, [
      el('input', { type: 'checkbox', name: 'isadmin', style: 'width:auto', onchange: e => {
        asAdmin = e.target.checked;
        codeField.hidden = !asAdmin;
        if (asAdmin) codeField.querySelector('input').focus();
      } }),
      el('span', { style: 'letter-spacing:.06em', text: 'Register as administrator' })
    ]);

    const submit = el('button.btn.btn--block', { type: 'submit', text: 'Create account' });
    const form = el('form', { onsubmit: async e => {
      e.preventDefault();
      err.hidden = true; busy(submit, true, 'Create account');
      const f = new FormData(form);
      const data = { name: f.get('name'), email: f.get('email'), phone: f.get('phone'), password: f.get('password') };
      if (asAdmin) data.code = f.get('code');
      try {
        const user = await store.register(data);
        location.hash = user.role === 'admin' ? '' : '#/memberships';
        toast(user.role === 'admin' ? 'Administrator account created' : 'Welcome to DUA');
      } catch (ex) { err.textContent = ex.message; err.hidden = false; busy(submit, false, 'Create account'); }
    } }, [
      field('Full name', input('name', { required: true, autocomplete: 'name' })),
      field('Email', input('email', { type: 'email', required: true, autocomplete: 'email' })),
      field('Phone', input('phone', { type: 'tel', required: true, autocomplete: 'tel' })),
      field('Password', input('password', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password' })),
      toggle, codeField, err, submit
    ]);
    return form;
  }

  set('in');

  return el('div.auth', null, [
    el('div.auth__art', null, [
      el('span.auth__logo', { role: 'img', 'aria-label': 'DUA Pilates and Spa', text: 'dua' }),
      el('h2', { html: 'Because <em>I want to.</em>' }),
      langToggle()
    ]),
    el('div.auth__form', null, [
      el('p.eyebrow', { text: 'Studio account' }),
      el('h1.display', { style: 'font-size:1.9rem;margin:8px 0 20px', text: 'Sign in to DUA' }),
      tabs, formHost
    ])
  ]);
}
