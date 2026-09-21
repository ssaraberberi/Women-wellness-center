/* ============================================================
   DUA — boot and routing
   One hash route per screen, re-rendered from the store on
   every change so no view can drift out of date.
   ============================================================ */
import * as store from './store.js';
import { clear, el, closeModal } from './ui.js';
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
  const user = store.currentUser();
  const route = (location.hash || '').replace(/^#\/?/, '') || '';
  clear(root);

  if (!user) { root.appendChild(renderAuth({ go })); return; }

  const ctx = { user, state: store.get(), now: new Date(), go, route };
  if (user.role === 'admin') root.appendChild(renderAdmin(ctx));
  else if (user.role === 'instructor') root.appendChild(renderInstructor(ctx));
  else root.appendChild(renderClient(ctx));
}

window.addEventListener('hashchange', () => { closeModal(); render(); });
store.subscribe(() => render());
render();

/* A way back to a clean demo without clearing site data by hand. */
window.duaReset = () => { store.reset(); location.hash = ''; };
