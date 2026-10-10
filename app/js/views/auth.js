/* Sign in, client registration, the gated administrator route, and the
   two screens that exist for the day a password is forgotten.
   The admin code is checked by the server; this form only carries it. */
import { el, field, input, toast, t } from '../ui.js';
import * as store from '../store.js';
import { langToggle } from './shell.js';

/* Which of the three screens is showing lives in the address, not in a
   variable: switching language re-renders the whole app, and a form that
   jumped back to sign-in every time she changed language would be the
   bilingual app losing her place. The Back button works for free. */
const HASH = { in: '', up: '#/join', forgot: '#/forgot' };
const tabFromHash = () => {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return h === 'forgot' ? 'forgot' : h === 'join' ? 'up' : 'in';
};

export function renderAuth({ go, start }) {
  let tab = start === 'forgot' ? 'forgot' : tabFromHash();
  let asAdmin = false;

  const formHost = el('div');
  /* The click moves the address; the address decides what is drawn. */
  const show = next => go(HASH[next]);
  const tabs = el('div.tabs', { role: 'tablist' }, [
    el('button', { type: 'button', role: 'tab', text: 'Sign in', onclick: () => show('in') }),
    el('button', { type: 'button', role: 'tab', text: 'Create account', onclick: () => show('up') })
  ]);

  function set(next) {
    tab = next;
    /* On the forgot screen neither tab is lit: it belongs to sign-in but
       it is not sign-in, and a lit tab over a different form is a lie. */
    Array.from(tabs.children).forEach((b, i) =>
      b.classList.toggle('is-on', tab === 'in' ? i === 0 : tab === 'up' ? i === 1 : false));
    formHost.textContent = '';
    formHost.appendChild(tab === 'in' ? signInForm() : tab === 'up' ? signUpForm() : forgotForm());
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
      } catch (ex) { err.textContent = t(ex.message); err.hidden = false; busy(submit, false, 'Sign in'); }
    } }, [
      field('Email', input('email', { type: 'email', required: true, autocomplete: 'email' })),
      field('Password', input('password', { type: 'password', required: true, autocomplete: 'current-password' })),
      err, submit,
      el('p', { style: 'margin-top:14px;text-align:center' },
        el('button.linkish', { type: 'button', text: 'Forgot your password?', onclick: () => show('forgot') }))
    ]);
    return form;
  }

  /* ---------- forgot ----------
     The answer is the same whether or not the address has an account, so
     this screen says the same thing either way. It reads as reassurance
     rather than as a refusal to tell, which is both kinder and true. */
  function forgotForm() {
    const err = el('p.notice.notice--bad', { hidden: true });
    const submit = el('button.btn.btn--block', { type: 'submit', text: 'Send me a link' });
    const back = el('p', { style: 'margin-top:14px;text-align:center' },
      el('button.linkish', { type: 'button', text: 'Back to sign in', onclick: () => show('in') }));

    const form = el('form', { onsubmit: async e => {
      e.preventDefault();
      err.hidden = true; busy(submit, true, 'Send me a link');
      try {
        await store.forgotPassword(new FormData(form).get('email'));
        formHost.textContent = '';
        formHost.appendChild(el('div', null, [
          el('p.notice.notice--good', { text: 'If that address has an account, a link is on its way. It is good for one hour.' }),
          el('p.muted', { style: 'margin-top:12px;font-size:.9rem',
            text: 'Nothing in your inbox? Look in spam, or ask the studio — they can confirm you by hand.' }),
          back
        ]));
      } catch (ex) { err.textContent = t(ex.message); err.hidden = false; busy(submit, false, 'Send me a link'); }
    } }, [
      el('p.muted', { style: 'margin-bottom:14px;font-size:.95rem',
        text: 'Give us the address you signed up with and we will send you a link to set a new password.' }),
      field('Email', input('email', { type: 'email', required: true, autocomplete: 'email' })),
      err, submit, back
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
      } catch (ex) { err.textContent = t(ex.message); err.hidden = false; busy(submit, false, 'Create account'); }
    } }, [
      field('Full name', input('name', { required: true, autocomplete: 'name' })),
      field('Email', input('email', { type: 'email', required: true, autocomplete: 'email' })),
      field('Phone', input('phone', { type: 'tel', required: true, autocomplete: 'tel' })),
      field('Password', input('password', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password' })),
      toggle, codeField, err, submit
    ]);
    return form;
  }

  set(tab);

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

/* ---------- the screen the link opens ----------
   Reached as /app?reset=TOKEN. Shown over everything, signed in or not:
   whoever is holding this link is the one the account should answer to,
   and the first thing she should see is the field she came for. */
export function renderReset({ token, done }) {
  const err = el('p.notice.notice--bad', { hidden: true });
  const submit = el('button.btn.btn--block', { type: 'submit', text: 'Save the new password' });
  const busy = on => { submit.disabled = on; submit.textContent = on ? t('One moment…') : t('Save the new password'); };

  const form = el('form', { onsubmit: async e => {
    e.preventDefault();
    err.hidden = true;
    const f = new FormData(form);
    const password = String(f.get('password') || '');
    /* Checked here only to save a round trip; the server checks it too. */
    if (password.length < 8) { err.textContent = t('Password must be at least 8 characters'); err.hidden = false; return; }
    if (password !== String(f.get('again') || '')) { err.textContent = t('The two passwords are not the same'); err.hidden = false; return; }

    busy(true);
    try {
      await store.resetWithToken(token, password);
      location.hash = '';
      done();
      toast('Password changed. You are signed in.');
    } catch (ex) {
      busy(false);
      err.textContent = t(ex.message);
      err.hidden = false;
      /* An expired or spent link is not something she can fix in this
         form, so the way out of it is on the screen. */
      if (ex.code === 'token') err.appendChild(el('span', null, [
        el('br'),
        el('button.linkish', { type: 'button', text: 'Ask for a new link', onclick: () => done({ forgot: true }) })
      ]));
    }
  } }, [
    field('New password', input('password', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password' }),
      'At least eight characters.'),
    field('Repeat the password', input('again', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password' })),
    err, submit,
    el('p', { style: 'margin-top:14px;text-align:center' },
      el('button.linkish', { type: 'button', text: 'Back to sign in', onclick: () => done() }))
  ]);

  return el('div.auth', null, [
    el('div.auth__art', null, [
      el('span.auth__logo', { role: 'img', 'aria-label': 'DUA Pilates and Spa', text: 'dua' }),
      el('h2', { html: 'Because <em>I want to.</em>' }),
      langToggle()
    ]),
    el('div.auth__form', null, [
      el('p.eyebrow', { text: 'Studio account' }),
      el('h1.display', { style: 'font-size:1.9rem;margin:8px 0 20px', text: 'Set a new password' }),
      form
    ])
  ]);
}
