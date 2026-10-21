/* ============================================================
   DUA — notices, pushed to the phone app
   ------------------------------------------------------------
   The app already writes a `notices` row wherever something happens to
   somebody: a class moved, a reservation confirmed, a password reset at
   the desk. The website shows them in its list; the phone app shows the
   same list, and this file also sends each one as a push notification
   through Expo's push service, once.

   Nothing here is on the path of a booking. Notices are written inside
   the transactions that cause them; sending happens afterwards, from
   whatever request comes next, and a failure is logged and forgotten —
   the notice is still in the list, which is where it always was.
   ============================================================ */
import { q, many } from './db.js';
import { noticeIn } from '../../shared/notices.js';

const EXPO = 'https://exp.host/--/api/v2/push/send';
const TOKEN = /^(Exponent|Expo)PushToken\[[\w-]+\]$/;

export async function registerDevice(user, body) {
  if (!user) throw Object.assign(new Error('Sign in first'), { status: 401 });
  const token = String((body && body.token) || '').trim();
  if (!TOKEN.test(token)) throw Object.assign(new Error('That is not a push token'), { status: 400 });
  const platform = ['ios', 'android'].includes(body.platform) ? body.platform : 'unknown';
  const lang = body.lang === 'en' ? 'en' : 'sq';
  /* A phone handed to somebody else signs in as her: the token moves. */
  await q(`insert into push_devices (token, user_id, platform, lang) values ($1,$2,$3,$4)
           on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform,
             lang = excluded.lang, seen_at = now()`, [token, user.id, platform, lang]);
  return { ok: true };
}

export async function forgetDevice(user, body) {
  const token = String((body && body.token) || '').trim();
  if (token) await q('delete from push_devices where token = $1', [token]);
  return { ok: true };
}

/* Claims the notices nobody has pushed yet — skip locked, so two requests
   finishing at once never send the same one twice — and sends them. Only
   the last day's: a notice older than that is news to nobody. */
export async function flushPush() {
  if (process.env.PUSH_DISABLED === '1') return;
  const rows = await many(
    `with due as (
       select id from notices where pushed_at is null and created_at > now() - interval '1 day'
        order by created_at limit 100 for update skip locked)
     update notices n set pushed_at = now() from due where n.id = due.id
     returning n.id, n.user_id, n.text, n.tone`);
  if (!rows.length) return;
  const devices = await many('select token, user_id, lang from push_devices where user_id = any($1)',
    [[...new Set(rows.map(r => r.user_id))]]);
  if (!devices.length) return;

  const messages = [];
  for (const r of rows)
    for (const d of devices.filter(x => x.user_id === r.user_id))
      messages.push({ to: d.token, title: 'DUA', body: noticeIn(r.text, d.lang), sound: 'default', data: { noticeId: r.id, tone: r.tone } });

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch(EXPO, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(batch)
    });
    const out = await res.json().catch(() => null);
    /* A phone that uninstalled the app answers DeviceNotRegistered; its
       row goes, so the next notice does not try it again. */
    const gone = ((out && out.data) || [])
      .map((t, j) => t && t.status === 'error' && t.details && t.details.error === 'DeviceNotRegistered' ? batch[j].to : null)
      .filter(Boolean);
    if (gone.length) await q('delete from push_devices where token = any($1)', [gone]);
  }
}
