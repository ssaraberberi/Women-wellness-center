/* ============================================================
   DUA — boot and routing
   The store holds the server's last word; every change re-renders,
   so no screen can drift from what was actually recorded.
   ============================================================ */
import * as store from './store.js';
import { clear, el, closeModal, onLang, toast } from './ui.js';
import { renderAuth, renderReset } from './views/auth.js';
import { renderClient } from './views/client.js';
import { renderInstructor } from './views/instructor.js';
import { renderAdmin } from './views/admin.js';

const root = document.getElementById('root');

/* ---------- what an emailed link arrives as ----------
   /app?reset=TOKEN and /app?verify=TOKEN. Both are read once, at boot,
   and then wiped out of the address bar: a token should not sit in
   history, in a bookmark, or in whatever the next screenshot catches. */
const entry = new URLSearchParams(location.search);
let resetToken = entry.get('reset') || null;
const verifyToken = entry.get('verify') || null;
let authStart = null;

const stripQuery = () => {
  if (location.search) history.replaceState({}, '', location.pathname + location.hash);
};

/* Leaving the reset screen, either because it worked or because the link
   was spent. 'forgot' carries her straight to the form that sends a new
   one, so a dead link is one tap from a live one. */
async function leaveReset(opts) {
  resetToken = null;
  stripQuery();
  /* Asking for a new link means she cannot get in. If this browser is
     still signed in as somebody — she reset the password a minute ago, or
     the link is simply stale — the form she is asking for is behind that
     session, so it ends here rather than leaving her staring at a screen
     that answers a different question. */
  if (opts && opts.forgot && store.get().user) await store.signOut().catch(() => {});
  authStart = opts && opts.forgot ? 'forgot' : null;
  render();
}

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

/* The colour the phone paints its status bar and browser chrome: the wine
   of the sign-in panel, the plum of the app's top bar, the cream of the
   page while it loads — so the top of the screen never looks pasted on. */
const themeMeta = document.querySelector('meta[name="theme-color"]');
const paint = colour => { if (themeMeta && themeMeta.content !== colour) themeMeta.content = colour; };

function render() {
  const state = store.get();
  clear(root);

  if (!state.ready) {
    paint('#FFFBEA');
    root.appendChild(el('div.splash', { role: 'status', 'aria-label': 'Loading…' },
      el('span.splash__mark', { 'aria-hidden': 'true' })));
    return;
  }
  if (state.error && !state.user) {
    paint('#FFFBEA');
    root.appendChild(el('div.splash', null,
      el('div.card', { style: 'max-width:420px;text-align:left' }, [
        el('p.eyebrow', { text: 'Cannot reach the studio' }),
        el('p', { style: 'margin-top:8px', text: 'Check your connection and try again. If it keeps happening, call or message the studio.' }),
        el('button.btn.btn--sm', { type: 'button', style: 'margin-top:16px', text: 'Try again',
          onclick: () => { store.retry(); } })
      ])));
    return;
  }

  /* Before the role screens and before sign-in: whoever opened this link
     came to set a password, and that is the only thing this screen does. */
  if (resetToken) { paint('#7D2F49'); root.appendChild(renderReset({ token: resetToken, done: leaveReset })); return; }

  const user = state.user;
  if (!user) {
    paint('#7D2F49');
    const start = authStart; authStart = null;
    root.appendChild(renderAuth({ go, start }));
    return;
  }
  paint(matchMedia('(max-width: 899px)').matches ? '#2A0E18' : '#FFFBEA');

  const route = (location.hash || '').replace(/^#\/?/, '') || '';
  const ctx = { user, state, now: new Date(), go, route };
  if (user.role === 'admin') root.appendChild(renderAdmin(ctx));
  else if (user.role === 'instructor') root.appendChild(renderInstructor(ctx));
  else root.appendChild(renderClient(ctx));
}

/* A new section starts at its top, the way a new page would. */
window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });
store.subscribe(render);
/* Switching language rebuilds every screen from the same state: nothing is
   translated in place, so there is no half-English screen to get stuck in. */
onLang(() => { closeModal(); render(); });
render();

/* The confirmation link is settled before /me is read, so the first
   screen already knows the address is confirmed. */
(async () => {
  if (verifyToken) {
    stripQuery();
    try { await store.verifyEmail(verifyToken); toast('Your email is confirmed. Thank you.'); }
    catch (e) { toast(e.message); }
  }
  await store.boot();
})();
