/* Thin wrapper over fetch. The session lives in an httpOnly cookie, so
   there is no token for this code to hold or leak. */
const BASE = '/api';

/* A session lasts thirty days, so one will end while somebody is looking
   at a screen. Whoever is holding the state says what to do about it;
   this only notices. */
let onLost = null;
export const whenSignedOut = fn => { onLost = fn; };

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    /* 401 on anything but the sign-in calls means the session has gone:
       the screen is showing a studio the server no longer knows us in. */
    if (res.status === 401 && !/^\/(me|auth\/)/.test(path) && onLost) onLost();
    const e = new Error((data && data.error) || 'Something went wrong');
    e.status = res.status;
    e.code = data && data.code;
    throw e;
  }
  return data;
}

export const get = p => call('GET', p);
export const post = (p, b) => call('POST', p, b || {});
export const put = (p, b) => call('PUT', p, b || {});
export const del = p => call('DELETE', p);
