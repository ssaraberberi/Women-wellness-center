/* ============================================================
   DUA — the API
   Every verdict comes from shared/rules.js. The browser calls the
   same functions to keep the interface responsive, but nothing it
   says is trusted: each write re-reaches the decision here.
   ============================================================ */
import { q, one, many, tx } from './db.js';
import { hashPassword, verifyPassword, issueToken, revokeToken, adminCode,
         burnPasswordTime, signinBlocked, recordSigninFailure, clearSigninFailures,
         issueCode, claimCode, codeRequestBlocked, recordCodeRequest } from './auth.js';
import { sendAuthEmail, mailConfigured, mailFrom } from './mail.js';
import * as load from './load.js';
import * as booking from './booking.js';
import { ensureSynced } from './schedule.js';
import * as rules from '../../shared/rules.js';
import { iso, addDays, hhmm, todayIn, plusDays } from '../../shared/domain.js';

const bad = (status, message, code) => { const e = new Error(message); e.status = status; e.code = code; throw e; };
const need = (u, ...roles) => { if (!u) bad(401, 'Sign in first'); if (!roles.includes(u.role)) bad(403, 'Not allowed'); };
const trim = v => typeof v === 'string' ? v.trim() : v;
const slug = v => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function requireFields(body, fields) {
  for (const f of fields) if (!trim(body[f])) bad(400, 'Missing ' + f);
}

const notify = (client, userId, text, tone) =>
  client.query('insert into notices (user_id, text, tone) values ($1,$2,$3)', [userId, text, tone || 'info']);

/* ---------- auth ---------- */

export async function register(body, meta) {
  requireFields(body, ['name', 'email', 'phone', 'password']);
  if (String(body.password).length < 8) bad(400, 'Password must be at least 8 characters');
  const wantsAdmin = !!body.code;
  if (wantsAdmin) {
    const code = await adminCode();
    if (!code || body.code !== code) bad(403, 'That admin code is not valid', 'code');
  }
  const taken = await one('select 1 from users where lower(email) = lower($1)', [body.email]);
  if (taken) bad(409, 'That email already has an account', 'email');

  const hash = await hashPassword(body.password);
  const user = await one(
    `insert into users (role, name, email, phone, password_hash) values ($1,$2,$3,$4,$5)
     returning id, role, name, email, phone, email_verified as "emailVerified"`,
    [wantsAdmin ? 'admin' : 'client', trim(body.name), trim(body.email), trim(body.phone), hash]);

  /* The confirmation letter goes out now, and she is signed in either way.
     An address that is never confirmed costs her nothing today; it costs
     her the reset link on the day she forgets her password, which is why
     the app keeps asking. */
  await deliver('verify', user, meta);
  return { user, ...(await issueToken(user.id)) };
}

export async function login(body, meta) {
  requireFields(body, ['email', 'password']);
  const ip = meta && meta.ip;

  if (await signinBlocked(body.email, ip))
    bad(429, 'Too many attempts. Wait a few minutes and try again.', 'throttled');

  const row = await one(
    `select id, role, name, email, phone, password_hash, active,
            email_verified as "emailVerified" from users where lower(email) = lower($1)`,
    [body.email]);

  /* Same message either way, and the same work either way: whether an
     address has an account is not something an unauthenticated caller
     gets to probe for, by reading the answer or by timing it. */
  const ok = row ? await verifyPassword(body.password, row.password_hash)
                 : await burnPasswordTime(body.password);
  if (!row || !ok) {
    await recordSigninFailure(body.email, ip);
    bad(401, 'Email or password is wrong');
  }
  if (!row.active) bad(403, 'This account has been removed');

  await clearSigninFailures(body.email);
  const { password_hash, active, ...user } = row;
  return { user, ...(await issueToken(row.id)) };
}

export const logout = token => revokeToken(token);

/* ---------- the way back in ----------
   A forgotten password is the one thing a studio cannot fix at the desk
   out of hours, so it is fixed by email: a one-hour link, used once, and
   every other session on that account ended when the new password is set.

   Two rules run through all of it. The answer to "send me a link" never
   says whether the address has an account — same body, same status, for a
   member and for a stranger — because an endpoint that distinguishes them
   is a membership list anyone can read. And a letter that fails to send is
   logged, never raised: a registration must not fail because a letter could
   not be posted, and the desk reset is still there on the day Resend is.
*/

/* Sending is best effort, and the caller is told whether it worked —
   signed-in callers are shown it, the public one is not.

   Every attempt also leaves a record in the database, because the silence
   this is designed for cuts both ways: a letter that cannot be sent is not
   allowed to break a registration, and a studio must still be able to find
   out that none of them are arriving. A refused send leaves nothing at
   Resend to look at, and a log line nobody is tailing is not an answer, so
   the last attempt is written down and /healthz reads it out. */
async function deliver(kind, who, meta) {
  if (!mailConfigured()) {
    console.error('email not sent (' + kind + '): RESEND_API_KEY is not set');
    await noteMail(kind, 'RESEND_API_KEY is not set');
    return false;
  }
  try {
    const token = await issueCode(who.id, kind);
    await sendAuthEmail({ kind, to: who.email, name: firstName(who.name), token, lang: meta && meta.lang });
    await noteMail(kind, null);
    return true;
  } catch (e) {
    console.error('email not sent (' + kind + '): ' + e.message);
    await noteMail(kind, e.message);
    return false;
  }
}

/* One row, overwritten: the question is "are the letters going out", not
   "what happened in March". Addresses are taken out of the message — the
   row is read by an endpoint that answers without a session, and a
   provider's complaint can quote the recipient back at you. */
const noteMail = (kind, problem) => q(
  `insert into settings (key, value) values ('mail_last', $1)
   on conflict (key) do update set value = excluded.value`,
  [JSON.stringify({
    at: new Date().toISOString(),
    kind,
    ok: !problem,
    problem: problem ? String(problem).replace(/[\w.+-]+@[\w.-]+/g, '<address>').slice(0, 300) : undefined
  })]).catch(e => console.error('could not record the mail result: ' + e.message));

const firstName = full => String(full || '').trim().split(/\s+/)[0] || '';

export async function forgotPassword(body, meta) {
  requireFields(body, ['email']);
  const email = trim(body.email);
  const ip = meta && meta.ip;

  /* The same answer in every branch below, built once so no branch can
     drift into saying more than the others. */
  const quiet = { ok: true };

  if (await codeRequestBlocked(email, ip)) return quiet;
  await recordCodeRequest(email, ip);

  const who = await one('select id, name, email, active from users where lower(email) = lower($1)', [email]);
  if (who && who.active) await deliver('reset', who, meta);
  /* Not in the answer — in the log, where the studio can see that the
     letter nobody received was a letter nobody was owed. */
  else console.log('reset asked for an address with no account here');
  return quiet;
}

export async function resetWithToken(body) {
  requireFields(body, ['token', 'password']);
  if (String(body.password).length < 8) bad(400, 'Password must be at least 8 characters', 'password');

  const userId = await claimCode(body.token, 'reset');
  if (!userId) bad(400, 'That link has expired or has already been used', 'token');

  const row = await one('select id, role, name, email, phone, active from users where id = $1', [userId]);
  if (!row || !row.active) bad(403, 'This account has been removed');

  const hash = await hashPassword(body.password);
  await tx(async c => {
    /* Confirming the address is part of this: she just proved she reads
       that inbox, which is the whole thing the verify link asks for. */
    await c.query('update users set password_hash = $2, email_verified = true where id = $1', [userId, hash]);
    /* A reset exists because somebody may have had the old password.
       Everything signed in with it goes, and so does every other link. */
    await c.query('delete from auth_tokens where user_id = $1', [userId]);
    await c.query('delete from auth_codes where user_id = $1', [userId]);
  });
  await clearSigninFailures(row.email);

  const { active, ...user } = row;
  /* Signed in straight away: she has just proved the inbox and chosen the
     password, and a sign-in form at this point only invites a typo. */
  return { user: { ...user, emailVerified: true }, ...(await issueToken(userId)) };
}

export async function verifyEmail(body) {
  requireFields(body, ['token']);
  const userId = await claimCode(body.token, 'verify');
  if (!userId) bad(400, 'That link has expired or has already been used', 'token');
  await q('update users set email_verified = true where id = $1', [userId]);
  return { ok: true };
}

/* Asked for from inside the app, by somebody already signed in, so this
   one may say plainly what happened. */
export async function sendVerification(user, meta) {
  need(user, 'admin', 'instructor', 'client');
  const row = await one('select id, name, email, email_verified from users where id = $1', [user.id]);
  if (!row) bad(404, 'No such person');
  if (row.email_verified) return { ok: true, sent: false, verified: true };

  if (await codeRequestBlocked(row.email, meta && meta.ip))
    bad(429, 'A link was sent a moment ago. Check your inbox, then try again in a few minutes.', 'throttled');
  await recordCodeRequest(row.email, meta && meta.ip);

  const sent = await deliver('verify', row, meta);
  if (!sent) bad(502, 'The letter could not be sent. Tell the studio and they will confirm you by hand.', 'mail');
  return { ok: true, sent: true };
}

/* ---------- shared reads ---------- */

/* The catalogue everyone reads, priced or not. While the switch is off the
   figures are not merely hidden in the interface — they are left out of the
   answer, so a client reading the response sees what the page shows. The
   studio's own side always has them; it cannot price a package blind. */
export async function bootstrap(user) {
  const [classTypes, plans, { showPrices }] = await Promise.all([
    load.classTypes(), load.plans(), publicSettings()
  ]);
  const priced = showPrices || (user && user.role === 'admin');
  return {
    classTypes,
    plans: priced ? plans : plans.map(({ price, ...rest }) => ({ ...rest, price: null }))
  };
}

export async function notices(user) {
  need(user, 'admin', 'instructor', 'client');
  return many('select id, text, tone, read, created_at from notices where user_id=$1 order by created_at desc limit 20', [user.id]);
}
export async function readNotices(user) {
  need(user, 'admin', 'instructor', 'client');
  await q('update notices set read = true where user_id = $1', [user.id]);
  return { ok: true };
}

/* ---------- client ---------- */

export async function clientState(user) {
  need(user, 'client');
  const now = new Date();
  await ensureSynced(now);
  const state = await load.clientState(user.id, now);
  return {
    ...state,
    /* This answer carries the catalogue as well as the client's own things,
       so it has to hold the prices back on the same terms as /bootstrap —
       otherwise the figures come back by the side door. */
    plans: state.settings.showPrices ? state.plans : state.plans.map(({ price, ...rest }) => ({ ...rest, price: null })),
    instructors: state.instructors.map(i => ({ id: i.id, name: i.name })),   // clients need the name, nothing else
    membership: rules.membershipOf(state, user.id, now)
  };
}

/* Booking and cancelling from the app go through the same engine as the
   booking page: the same locks, the same credits, the same 30-minute rule. */
export const book = (user, body) => booking.appBook(user, body.classId);
export const cancelBooking = (user, body) => booking.appCancel(user, body.bookingId);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- instructor ---------- */

export async function instructorState(user) {
  need(user, 'instructor');
  const now = new Date();
  const from = iso(addDays(now, -14)), to = iso(addDays(now, 60));
  const classes = (await load.classesBetween(from, to)).filter(c => c.instructorId === user.id);
  const me = (await load.instructors()).find(i => i.id === user.id);
  const bookings = await load.bookingsForClasses(classes.map(c => c.id), null);
  return { classTypes: await load.classTypes(), classes, bookings, me };
}

export async function setQualifications(user, body) {
  need(user, 'instructor');
  const types = Array.isArray(body.types) ? body.types : [];
  return tx(async c => {
    await c.query('delete from instructor_qualifications where instructor_id=$1', [user.id]);
    for (const t of types)
      await c.query('insert into instructor_qualifications values ($1,$2) on conflict do nothing', [user.id, t]);
    return { ok: true };
  });
}

export async function setAvailability(user, body) {
  need(user, 'instructor');
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const avail = body.availability || {};
  return tx(async c => {
    await c.query('delete from instructor_availability where instructor_id=$1', [user.id]);
    for (const key of Object.keys(avail)) {
      const day = DAY_KEYS.indexOf(key);
      if (day < 0) continue;
      for (const b of avail[key] || []) {
        if (!b || !b.from || !b.to || b.from >= b.to) continue;
        await c.query(`insert into instructor_availability (instructor_id, weekday, starts, ends)
                       values ($1,$2,$3,$4)`, [user.id, day, b.from, b.to]);
      }
    }
    return { ok: true };
  });
}

/* ---------- admin ---------- */

export async function adminState(user) {
  need(user, 'admin');
  const now = new Date();
  await ensureSynced(now);
  const state = await load.adminState(now);
  return { ...state, issues: rules.issues(state, now), showPrices: state.settings.showPrices, mail: await mailState() };
}

/* Whether the letters are going out, for the one person who can do
   something about it. A reset link that is refused is refused silently by
   design — the woman asking for it must not be told whether her address
   has an account, and a registration must not fail because a letter could
   not be posted — so if this is not on the studio's own screen there is
   nowhere the silence breaks. */
async function mailState() {
  const row = await one(`select value from settings where key = 'mail_last'`).catch(() => null);
  let last = null;
  try { last = row ? JSON.parse(row.value) : null; } catch (_) {}
  return { configured: mailConfigured(), from: mailFrom(), last };
}

export async function roster(user, classId) {
  need(user, 'admin');
  return many(
    `select b.id, b.status, u.name, u.email, u.phone
       from bookings b join users u on u.id = b.client_id
      where b.class_id = $1 and b.status in ('booked','waitlist')
      order by case b.status when 'booked' then 0 else 1 end, b.created_at`, [classId]);
}

/* ---------- a way back in ----------
   There is no email from this app, so there is no link to send. What
   there is, is an administrator at a desk: she issues a new password,
   reads it out once, and the account is reachable again.

   Signing everyone out of that account is part of it. A reset exists
   because somebody may have lost control of the password; leaving the
   old sessions alive would make it ceremony. */
export async function resetPassword(user, id) {
  need(user, 'admin');
  const who = await one('select id, name, email, role, active from users where id = $1', [id]);
  if (!who) bad(404, 'No such person');
  if (!who.active) bad(409, 'That account has been removed');

  const password = freshPassword();
  await tx(async c => {
    await c.query('update users set password_hash = $2 where id = $1', [id, await hashPassword(password)]);
    await c.query('delete from auth_tokens where user_id = $1', [id]);
    if (who.id !== user.id)
      await notify(c, who.id, 'Your password was reset at the studio. Ask for the new one at the desk.', 'warn');
  });
  /* Returned once and never stored in the clear — the only copy after
     this response is whatever the administrator writes down. */
  return { password, name: who.name, email: who.email };
}

/* Readable aloud: no l/1, no O/0, and grouped so it survives being said
   across a desk. */
function freshPassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const pick = n => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join('');
  return pick(4) + '-' + pick(4) + '-' + pick(4);
}

/* ---------- what the public site is allowed to know ---------- */

/* The only endpoint that answers without a session. It says one thing, and
   says it in the safe direction: anything other than 'on' is off, so a
   missing row, a typo or an unreachable database all keep the prices in. */
export async function publicSettings() {
  const row = await one(`select value from settings where key = 'show_prices'`);
  return { showPrices: !!row && row.value === 'on' };
}

/* ---------- what the website asks for ----------
   The packages as the public page draws them: no session, no names, no
   anything but what is on a card. Prices are held back on exactly the
   same terms as everywhere else — while the switch is off they are not
   in the answer at all, rather than hidden once they have arrived. */
export async function publicPackages() {
  const [plans, { showPrices }] = await Promise.all([load.plans(), publicSettings()]);
  return {
    showPrices,
    packages: plans
      .slice()
      .sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name))
      .map(p => ({
        id: p.id,
        name: p.name,
        price: showPrices ? p.price : null,
        featured: p.featured,
        tagline: p.tagline,
        rhythm: p.rhythm,
        blurb: p.blurb,
        en: p.en,
        /* The card's number and the tab it belongs in are both read off
           this, so a package that allows eight reformer classes says so
           without the studio writing "8" anywhere. */
        allowances: p.allowances.map(a => ({ types: a.types, limit: a.limit, per: a.per }))
      }))
  };
}

export async function setSettings(user, body) {
  need(user, 'admin');
  if (typeof body.showPrices !== 'boolean') bad(400, 'showPrices is true or false');
  await q(`insert into settings (key, value) values ('show_prices', $1)
           on conflict (key) do update set value = excluded.value`,
          [body.showPrices ? 'on' : 'off']);
  return { showPrices: body.showPrices };
}

/* ---------- packages ---------- */

/* One call saves a plan and the whole of what it allows. The allowances are
   replaced rather than patched: the form shows every row, so what comes back
   is the complete answer, and a row the studio deleted has to disappear. */
export async function savePlan(user, body) {
  need(user, 'admin');
  requireFields(body, ['name']);

  const price = Number(body.price);
  if (!Number.isInteger(price) || price < 0) bad(400, 'Price must be a whole number of lek', 'price');

  const allowances = Array.isArray(body.allowances) ? body.allowances : [];
  if (!allowances.length) bad(400, 'A package has to allow something', 'allowances');

  const types = (await many('select id from class_types')).map(r => r.id);
  for (const a of allowances) {
    if (!Array.isArray(a.types) || !a.types.length) bad(400, 'Every line needs at least one class type', 'allowances');
    for (const t of a.types) if (!types.includes(t)) bad(400, 'No such class type: ' + t, 'allowances');
    /* A line is now a number of credits for the life of the package; the
       period is kept only so older readers of the table still parse it. */
    if (!['week', 'month'].includes(a.per)) a.per = 'month';
    if (a.limit !== null && a.limit !== undefined && a.limit !== '') {
      const n = Number(a.limit);
      if (!Number.isInteger(n) || n < 1) bad(400, 'A limit is a whole number of classes, or blank for no limit', 'allowances');
    }
  }
  const kind = ['single', 'membership', 'package'].includes(body.kind) ? body.kind : 'membership';
  const validityDays = Number(body.validityDays || 30);
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650) bad(400, 'Valid for a whole number of days', 'validityDays');

  /* An id the studio never sees: made from the name the first time, kept
     afterwards, so a rename cannot orphan the memberships pointing at it. */
  const id = trim(body.id) || slug(body.name);
  if (!id) bad(400, 'That name has no letters or digits in it', 'name');

  return tx(async c => {
    if (!trim(body.id)) {
      const clash = await c.query('select 1 from plans where id = $1', [id]);
      if (clash.rowCount) bad(409, 'A package with that name already exists', 'name');
    }
    await c.query(
      `insert into plans (id, name, price_all, blurb, featured, sort, archived,
                          tagline, rhythm, tagline_en, rhythm_en, blurb_en, kind, validity_days, bookable)
       values ($1,$2,$3,$4,$5,$6,false,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (id) do update set name = excluded.name, price_all = excluded.price_all,
         blurb = excluded.blurb, featured = excluded.featured, sort = excluded.sort,
         archived = false, tagline = excluded.tagline, rhythm = excluded.rhythm,
         tagline_en = excluded.tagline_en, rhythm_en = excluded.rhythm_en,
         blurb_en = excluded.blurb_en, kind = excluded.kind, validity_days = excluded.validity_days,
         bookable = excluded.bookable`,
      [id, trim(body.name), price, trim(body.blurb) || null, !!body.featured, Number(body.sort) || 0,
       trim(body.tagline) || null, trim(body.rhythm) || null,
       trim(body.taglineEn) || null, trim(body.rhythmEn) || null, trim(body.blurbEn) || null,
       kind, validityDays, body.bookable !== false]);

    /* Only one package can be the one we point at. */
    if (body.featured) await c.query('update plans set featured = false where id <> $1', [id]);

    await c.query('delete from plan_allowances where plan_id = $1', [id]);
    let n = 0;
    for (const a of allowances)
      await c.query(
        `insert into plan_allowances (plan_id, class_type_ids, limit_count, period, sort)
         values ($1,$2,$3,$4,$5)`,
        [id, a.types, a.limit === '' || a.limit === null || a.limit === undefined ? null : Number(a.limit), a.per, n++]);

    return { id };
  });
}

/* Archived, never deleted: a membership someone already bought points at it,
   and the history has to keep saying what they bought. */
export async function archivePlan(user, id) {
  need(user, 'admin');
  const plan = await one('select id, name from plans where id = $1 and not archived', [id]);
  if (!plan) bad(404, 'No such package');
  const live = await one(
    `select count(*)::int as n from memberships
      where plan_id = $1 and status = 'active' and ends_on >= current_date`, [id]);
  await q('update plans set archived = true, featured = false where id = $1', [id]);
  return { ok: true, stillOn: live.n };
}

/* Everyone on the staff side signs in as role 'instructor' — that is what
   opens the staff dashboard — and `job` says which kind of employee they
   are. Both kinds are placed on classes the same way: by what they are
   qualified for, when they are free. */
const JOBS = ['instructor', 'therapist'];

export async function addEmployee(user, body) {
  need(user, 'admin');
  requireFields(body, ['name', 'email', 'phone', 'password']);
  const job = JOBS.includes(body.job) ? body.job : bad(400, 'Pick what they do', 'job');
  if (String(body.password).length < 8) bad(400, 'Password must be at least 8 characters', 'password');
  const quals = Array.isArray(body.qualifications) ? body.qualifications : [];
  if (!quals.length) bad(400, 'Pick at least one kind of class they can take', 'qualifications');
  const types = (await many('select id from class_types')).map(r => r.id);
  for (const t of quals) if (!types.includes(t)) bad(400, 'No such class type: ' + t, 'qualifications');

  const taken = await one('select 1 from users where lower(email)=lower($1)', [body.email]);
  if (taken) bad(409, 'That email already has an account', 'email');
  const hash = await hashPassword(body.password);
  return tx(async c => {
    const id = (await c.query(
      `insert into users (role, job, name, email, phone, password_hash) values ('instructor',$1,$2,$3,$4,$5) returning id`,
      [job, trim(body.name), trim(body.email), trim(body.phone), hash])).rows[0].id;
    for (const t of quals)
      await c.query('insert into instructor_qualifications values ($1,$2) on conflict do nothing', [id, t]);
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const avail = body.availability || {};
    for (const key of Object.keys(avail)) {
      if (!DAY_KEYS.includes(key)) continue;
      for (const b of avail[key] || []) {
        if (!b || !b.from || !b.to || b.from >= b.to) continue;
        await c.query(`insert into instructor_availability (instructor_id, weekday, starts, ends) values ($1,$2,$3,$4)`,
                      [id, DAY_KEYS.indexOf(key), b.from, b.to]);
      }
    }
    return { ok: true, id };
  });
}

/* Removing an employee ends their access now and leaves their future
   classes visibly unassigned rather than quietly wrong. */
export async function removeEmployee(user, id) {
  need(user, 'admin');
  return tx(async c => {
    const who = (await c.query(`update users set active=false where id=$1 and role='instructor' returning name`, [id])).rows[0];
    if (!who) bad(404, 'No such employee');
    await c.query('delete from auth_tokens where user_id=$1', [id]);
    const orphaned = (await c.query(
      `update classes set instructor_id = null
        where instructor_id = $1 and on_date >= current_date and not cancelled
        returning id, on_date, starts`, [id])).rows;
    for (const k of orphaned) {
      const rows = (await c.query(`select client_id from bookings where class_id=$1 and status='booked'`, [k.id])).rows;
      for (const r of rows)
        await notify(c, r.client_id,
          'Your class on ' + k.on_date + ' at ' + hhmm(k.starts) + ' will be led by someone new. Your place is safe.', 'warn');
    }
    return { ok: true, orphaned: orphaned.length };
  });
}

export async function saveClass(user, body) {
  need(user, 'admin');
  requireFields(body, ['typeId', 'date', 'start', 'end', 'capacity']);
  if (body.start >= body.end) bad(400, 'The class must end after it starts');
  const now = new Date();
  const state = await load.adminState(now);
  const draft = {
    id: body.id || 'new', typeId: body.typeId, date: body.date,
    start: body.start, end: body.end, capacity: Number(body.capacity),
    instructorId: body.instructorId || null, cancelled: false
  };
  if (draft.instructorId) {
    const i = state.instructors.find(x => x.id === draft.instructorId);
    const fit = rules.instructorFit(state, i, draft);
    if (fit.status !== 'recommended') bad(409, (i ? i.name : 'That employee') + ' — ' + fit.why, fit.status);
  }

  return tx(async c => {
    if (body.id) {
      const before = (await c.query('select * from classes where id=$1 for update', [body.id])).rows[0];
      if (!before) bad(404, 'No such class');
      const booked = (await c.query(`select count(*)::int n from bookings where class_id=$1 and status='booked'`, [body.id])).rows[0].n;
      if (draft.capacity < booked + (before.blocked || 0))
        bad(409, booked + ' people are already booked; capacity cannot go below that', 'capacity');

      /* Edited for this date, so it is pinned: the weekly template will
         never change it back, and every other week stays as it was. */
      await c.query(`update classes set class_type_id=$1, on_date=$2, starts=$3, ends=$4, capacity=$5, instructor_id=$6,
                            pinned = true where id=$7`,
        [draft.typeId, draft.date, draft.start, draft.end, draft.capacity, draft.instructorId, body.id]);

      const moved = before.on_date !== draft.date || hhmm(before.starts) !== draft.start || hhmm(before.ends) !== draft.end;
      const swapped = before.instructor_id !== draft.instructorId;
      if (moved || swapped) {
        const rows = (await c.query(`select client_id from bookings where class_id=$1 and status='booked'`, [body.id])).rows;
        const who = draft.instructorId
          ? (await c.query('select name from users where id=$1', [draft.instructorId])).rows[0] : null;
        for (const r of rows) {
          if (moved) await notify(c, r.client_id,
            'Your class moved to ' + draft.date + ', ' + draft.start + '–' + draft.end + '.', 'warn');
          if (swapped) await notify(c, r.client_id,
            'Your class on ' + draft.date + ' at ' + draft.start + ' will now be led by ' + (who ? who.name : 'someone new') + '.', 'info');
        }
      }
      return { ok: true, id: body.id };
    }
    const id = (await c.query(
      `insert into classes (class_type_id, on_date, starts, ends, capacity, instructor_id, pinned)
       values ($1,$2,$3,$4,$5,$6,true) returning id`,
      [draft.typeId, draft.date, draft.start, draft.end, draft.capacity, draft.instructorId])).rows[0].id;
    return { ok: true, id };
  });
}

export async function assignInstructor(user, classId, body) {
  need(user, 'admin');
  const now = new Date();
  const state = await load.adminState(now);
  const klass = state.classes.find(c => c.id === classId);
  if (!klass) bad(404, 'No such class');
  if (body.instructorId) {
    const i = state.instructors.find(x => x.id === body.instructorId);
    const fit = rules.instructorFit(state, i, klass);
    if (fit.status !== 'recommended') bad(409, (i ? i.name : 'That employee') + ' — ' + fit.why, fit.status);
  }
  return saveClass(user, {
    id: classId, typeId: klass.typeId, date: klass.date, start: klass.start,
    end: klass.end, capacity: klass.capacity, instructorId: body.instructorId || null
  });
}

/* The studio cancelling is not the client's doing: places are released,
   not spent. */
export async function cancelClass(user, classId) {
  need(user, 'admin');
  return tx(async c => {
    const k = (await c.query(`update classes set cancelled=true, cancel_reason='studio', pinned=true
                               where id=$1 returning on_date, starts`, [classId])).rows[0];
    if (!k) bad(404, 'No such class');
    const rows = (await c.query(
      `update bookings set status='released' where class_id=$1 and status in ('booked','waitlist') returning client_id`,
      [classId])).rows;
    for (const r of rows)
      await notify(c, r.client_id,
        'The ' + hhmm(k.starts) + ' class on ' + k.on_date + ' was cancelled. Your session has been returned.', 'warn');
    return { ok: true, affected: rows.length };
  });
}

export async function deleteClass(user, classId) {
  need(user, 'admin');
  await cancelClass(user, classId);
  await q('delete from classes where id=$1', [classId]);
  return { ok: true };
}

export async function updateMembership(user, id, body) {
  need(user, 'admin');
  const m = await one('select * from memberships where id=$1', [id]);
  if (!m) bad(404, 'No such membership');
  if (body.status && !['active', 'cancelled'].includes(body.status)) bad(400, 'A membership is active or cancelled', 'status');
  if (body.start && !ISO_DATE.test(String(body.start))) bad(400, 'Pick a start and an end date', 'dates');
  if (body.end && !ISO_DATE.test(String(body.end))) bad(400, 'Pick a start and an end date', 'dates');
  const start = body.start || m.starts_on, end = body.end || m.ends_on;
  if (String(end) < String(start)) bad(400, 'The membership has to end after it starts', 'dates');
  return tx(async c => {
    /* A package can hold several at once now; changing one leaves the
       others alone. Its credits are its own snapshot and do not change. */
    await c.query('update memberships set starts_on=$1, ends_on=$2, status=$3 where id=$4',
                  [start, end, body.status || m.status, id]);
    await notify(c, m.client_id, 'Your membership was updated by the studio.', 'info');
    return { ok: true };
  });
}
