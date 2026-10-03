/* Thin wrapper over fetch. The session lives in an httpOnly cookie, so
   there is no token for this code to hold or leak. */
const BASE = '/api';

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
