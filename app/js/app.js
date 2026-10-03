/* ============================================================
   DUA — boot and routing
   The store holds the server's last word; every change re-renders,
   so no screen can drift from what was actually recorded.
   ============================================================ */
import * as store from './store.js';
import { clear, el, closeModal, onLang } from './ui.js';
import { renderAuth } from './views/auth.js';
import { renderClient } from './views/client.js';
import { renderInstructor } from './views/instructor.js';
import { renderAdmin } from './views/admin.js';

const root = document.getElementById('root');

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function render() {
  const state = store.get();
  clear(root);

  if (!state.ready) {
    root.appendChild(el('div', { style: 'display:grid;place-items:center;min-height:100vh' },
      el('p.muted', { text: 'Loading…' })));
    return;
  }
  if (state.error && !state.user) {
    root.appendChild(el('div', { style: 'display:grid;place-items:center;min-height:100vh;padding:24px' },
      el('div.card', null, [
        el('p.eyebrow', { text: 'Cannot reach the studio' }),
        el('p', { style: 'margin-top:8px', text: state.error }),
        el('button.btn.btn--sm', { type: 'button', style: 'margin-top:14px', text: 'Try again',
          onclick: () => store.boot() })
      ])));
    return;
  }

  const user = state.user;
  if (!user) { root.appendChild(renderAuth({ go })); return; }

  const route = (location.hash || '').replace(/^#\/?/, '') || '';
  const ctx = { user, state, now: new Date(), go, route };
  if (user.role === 'admin') root.appendChild(renderAdmin(ctx));
  else if (user.role === 'instructor') root.appendChild(renderInstructor(ctx));
  else root.appendChild(renderClient(ctx));
}

window.addEventListener('hashchange', () => { closeModal(); render(); });
store.subscribe(render);
/* Switching language rebuilds every screen from the same state: nothing is
   translated in place, so there is no half-English screen to get stuck in. */
onLang(() => { closeModal(); render(); });
render();
store.boot();
