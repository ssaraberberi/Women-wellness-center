/* ============================================================
   DUA — reservations, credits and offers
   ------------------------------------------------------------
   A customer reserves without an account: a name and a phone number,
   an email if she likes. She is recognised by her phone the next time,
   so an offer cannot be claimed twice by booking again. What she gets
   back is a reference and a private link — the link is the key to her
   reservation, and only its digest is stored.

   A reservation is what she asked for, with the price and the terms as
   they were at that moment. Each person on it holds a package: a credit
   balance, valid between two dates. Every class she books spends a
   credit from it; cancelled in time, or cancelled by the studio, it gives
   the credit back; cancelled late, or missed, it stays spent.

   Nothing here trusts the page. Every limit — places in a class, credits
   in a package, the opening date, the 30-minute rule, an offer's cap — is
   checked again inside one transaction, with the class rows and the
   package rows locked, so two people pressing at once cannot both get the
   last place.
   ============================================================ */
import { randomBytes, createHash } from 'node:crypto';
import { q, one, many, tx } from './db.js';
import * as load from './load.js';
import * as rules from '../../shared/rules.js';
import { todayIn, plusDays, at, hhmm, phoneKey } from '../../shared/domain.js';
import { ensureSynced } from './schedule.js';
import { sendBookingEmail, mailConfigured } from './mail.js';

const bad = (status, message, code) => { const e = new Error(message); e.status = status; e.code = code; throw e; };
const need = (u, ...roles) => { if (!u) bad(401, 'Sign in first'); if (!roles.includes(u.role)) bad(403, 'Not allowed'); };
const trim = v => typeof v === 'string' ? v.trim() : v;
const digest = t => createHash('sha256').update(String(t)).digest('hex');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REF_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const notify = (c, userId, text, tone) =>
  c.query('insert into notices (user_id, text, tone) values ($1,$2,$3)', [userId, text, tone || 'info']);

/* ---------- a little protection for the public page ---------- */
async function throttle(kind, key, max, windowMin) {
  if (!key) return;
  try {
    const r = await one(`select count(*)::int as n from rate_events
                          where kind = $1 and key = $2 and at > now() - ($3 || ' minutes')::interval`, [kind, key, windowMin]);
    if (r && r.n >= max) bad(429, 'Too many requests. Try again in a little while.', 'throttled');
    await q('insert into rate_events (kind, key) values ($1,$2)', [kind, key]);
    if (Math.random() < 0.05) await q(`delete from rate_events where at < now() - interval '2 days'`);
  } catch (e) {
    if (e.status) throw e;
    console.error('booking throttle unavailable: ' + e.message);   // counting is best effort; booking is not
  }
}

/* ---------- people ---------- */
function person(p, which) {
  p = p || {};
  const name = String(trim(p.name) || '').replace(/\s+/g, ' ');
  const phone = String(trim(p.phone) || '');
  const key = phoneKey(phone);
  const email = trim(p.email) ? String(trim(p.email)).toLowerCase() : null;
  if (name.length < 2) bad(400, 'Write the full name', which + '-name');
  if (!key || key.length < 8) bad(400, 'Write a phone number we can call', which + '-phone');
  if (email && !EMAIL.test(email)) bad(400, 'That email does not look right', which + '-email');
  return { name: name.slice(0, 80), phone: phone.slice(0, 30), key, email: email ? email.slice(0, 120) : null };
}

/* The same person is the same phone number. If she has an account by
   email, that account is hers. Otherwise a client is made with no
   password: she can set one later with "Forgot your password?" if she
   gave an email, and she never needs one to reserve. */
async function clientFor(c, p) {
  let row = (await c.query(
    `select id, email, phone from users where role = 'client' and active and phone_key = $1
      order by created_at limit 1`, [p.key])).rows[0];
  if (!row && p.email) {
    const byMail = (await c.query('select id, role, email, phone, active from users where lower(email) = lower($1)', [p.email])).rows[0];
    if (byMail && byMail.role === 'client' && byMail.active) row = byMail;
  }
  if (row) {
    if (!row.phone) await c.query('update users set phone = $2, phone_key = $3 where id = $1', [row.id, p.phone, p.key]);
    if (!row.email && p.email) {
      const taken = (await c.query('select 1 from users where lower(email) = lower($1)', [p.email])).rowCount;
      if (!taken) await c.query('update users set email = $2 where id = $1', [row.id, p.email]);
    }
    return row.id;
  }
  const taken = p.email ? (await c.query('select 1 from users where lower(email) = lower($1)', [p.email])).rowCount : 0;
  return (await c.query(
    `insert into users (role, name, email, phone, phone_key, password_hash)
     values ('client', $1, $2, $3, $4, 'nologin') returning id`,
    [p.name, taken ? null : p.email, p.phone, p.key])).rows[0].id;
}

/* New to DUA: has never held a package that was not cancelled. */
async function hasHistory(c, clientId, exceptReservation) {
  return (await c.query(
    `select 1 from memberships where client_id = $1 and status in ('active','replaced')
        and (reservation_id is distinct from $2) limit 1`, [clientId, exceptReservation || null])).rowCount > 0;
}

/* ---------- the catalogue the booking page reads ---------- */
function eligiblePlansFor(o, plans) {
  const pool = plans.filter(p => p.bookable && p.allowances.length);
  if (o.eligiblePlans && o.eligiblePlans.length) return pool.filter(p => o.eligiblePlans.includes(p.id));
  return o.kind === 'discount' ? pool.filter(p => p.kind !== 'single') : pool;
}

export async function publicCatalogue() {
  const today = todayIn(new Date());
  const [st, types, plans, offers] = await Promise.all([load.settings(), load.classTypes(), load.plans(), load.offers(false)]);
  const priced = st.showPrices;
  return {
    settings: { openingDate: st.openingDate, cancelMinutes: st.cancelMinutes, horizonDays: st.horizonDays, today, showPrices: priced },
    classTypes: types,
    plans: plans.filter(p => p.bookable && p.allowances.length).map(p => ({
      id: p.id, name: p.name, kind: p.kind, featured: p.featured, validityDays: p.validityDays,
      price: priced ? p.price : null, lines: load.linesOfPlan(p),
      tagline: p.tagline, blurb: p.blurb, en: p.en
    })),
    offers: offers.filter(o => load.offerIsLive(o, today)).map(o => ({
      id: o.id, title: o.title, description: o.description, kind: o.kind,
      price: priced ? o.price : null, original: priced ? o.original : null, discountPct: o.discountPct,
      lines: o.lines, validityDays: o.validityDays, endsOn: o.endsOn,
      persons: o.persons, together: o.together, friendRequired: o.friendRequired,
      bonusClasses: o.bonusClasses, eligibility: o.eligibility, en: o.en,
      eligiblePlans: eligiblePlansFor(o, plans).map(p => p.id),
      remaining: o.maxRedemptions == null ? null : Math.max(0, o.maxRedemptions - o.claimed)
    }))
  };
}

/* The ordinary week, for the website's timetable: the template that
   applies from opening (or today), as times and kinds — no names, no
   places, nothing that changes by the hour. */
export async function publicTimetable() {
  const [st, types] = await Promise.all([load.settings(), load.classTypes()]);
  const today = todayIn(new Date());
  const ref = today > st.openingDate ? today : st.openingDate;
  const t = await one(`select id from schedule_templates where effective_from <= $1 order by effective_from desc limit 1`, [ref])
         || await one(`select id from schedule_templates order by effective_from limit 1`);
  const slots = t ? await many(
    `select weekday, starts, ends, class_type_id from template_slots where template_id = $1
      order by weekday, starts, class_type_id`, [t.id]) : [];
  return {
    openingDate: st.openingDate, today,
    classTypes: types,
    slots: slots.map(s => ({ weekday: s.weekday, start: hhmm(s.starts), end: hhmm(s.ends), typeId: s.class_type_id }))
  };
}

/* The classes that can be booked: from opening (or today) to the horizon,
   open, not started, and with the places left. Counts only — never who. */
export async function publicClasses() {
  const now = new Date();
  await ensureSynced(now);
  const st = await load.settings();
  const today = todayIn(now);
  const first = today > st.openingDate ? today : st.openingDate;
  const last = plusDays(first, st.horizonDays);
  const rows = await many(
    `select k.id, k.class_type_id, k.on_date, k.starts, k.ends, k.capacity, k.blocked, u.name as who,
            coalesce(b.n, 0)::int as taken
       from classes k left join users u on u.id = k.instructor_id
       left join (select b.class_id, count(*) as n from bookings b join classes c on c.id = b.class_id
                   where b.status = 'booked' and c.on_date between $1 and $2 group by b.class_id) b on b.class_id = k.id
      where k.on_date between $1 and $2 and not k.cancelled
        and not exists (select 1 from closures x where x.on_date = k.on_date)
      order by k.on_date, k.starts`, [first, last]);
  return {
    from: first, to: last, openingDate: st.openingDate, cancelMinutes: st.cancelMinutes,
    classes: rows.map(r => ({
      id: r.id, typeId: r.class_type_id, date: r.on_date, start: hhmm(r.starts), end: hhmm(r.ends),
      capacity: r.capacity, left: Math.max(0, r.capacity - r.taken - (r.blocked || 0)),
      instructor: r.who ? String(r.who).split(' ')[0] : null
    })).filter(k => at(k.date, k.start) > now)
  };
}

/* ---------- placing bookings ----------
   holders: the packages each class is booked against — one, or both
   people of a Duo that attends together. Every class is locked, counted
   and checked; every package is locked and its credits counted after. */
async function bookInto(c, st, now, classIds, holders, reservationId, opts) {
  const admin = !!(opts && opts.admin);
  const ids = [...new Set((classIds || []).map(String))];
  if (!ids.length) return [];
  if (ids.some(id => !UUID.test(id))) bad(400, 'One of those classes is not on the timetable', 'missing');

  for (const h of holders) await c.query('select id from memberships where id = $1 for update', [h.membershipId]);
  const pkgs = new Map((await c.query('select id, client_id, lines, starts_on, ends_on, status from memberships where id = any($1)',
    [holders.map(h => h.membershipId)])).rows.map(r => [r.id, r]));

  const locked = (await c.query(
    `select id, class_type_id, on_date, starts, ends, capacity, instructor_id, cancelled, cancel_reason, blocked, pinned, slot_id
       from classes where id = any($1) order by id for update`, [ids])).rows.map(load.classRow);
  if (locked.length !== ids.length) bad(404, 'One of those classes is no longer on the timetable', 'missing');
  const closed = new Set((await c.query('select on_date from closures where on_date = any($1)',
    [[...new Set(locked.map(k => k.date))]])).rows.map(r => r.on_date));

  const made = [];
  for (const k of locked.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))) {
    const when = k.date + ' ' + k.start;
    if (k.cancelled || closed.has(k.date)) bad(409, 'The ' + when + ' class is cancelled', 'cancelled');
    const taken = (await c.query(`select count(*)::int as n from bookings where class_id = $1 and status = 'booked'`, [k.id])).rows[0].n;
    const state = { settings: st, bookings: Array.from({ length: taken }, () => ({ classId: k.id, status: 'booked' })) };
    if (admin) {
      if (k.capacity - taken - (k.blocked || 0) < holders.length) bad(409, 'The ' + when + ' class has no room for that', 'full');
    } else {
      const open = rules.bookable(state, k, now, holders.length);
      if (!open.ok) bad(409, open.code === 'full' ? 'The ' + when + ' class is full' : open.message, open.code);
    }
    for (const h of holders) {
      const m = pkgs.get(h.membershipId);
      if (!m || m.status !== 'active') bad(409, 'That package is not active', 'package');
      if (k.date < m.starts_on || k.date > m.ends_on) bad(409, 'The ' + when + ' class is outside the dates of the package', 'outside');
      if (!(m.lines || []).some(l => l.types.includes(k.typeId))) bad(409, 'That class is not included in the package', 'not-included');
      try {
        const b = (await c.query(
          `insert into bookings (class_id, client_id, status, membership_id, reservation_id)
           values ($1,$2,'booked',$3,$4) returning id`, [k.id, m.client_id, m.id, reservationId || null])).rows[0];
        made.push(b.id);
      } catch (e) {
        if (e.code === '23505') bad(409, 'Already booked into the ' + when + ' class', 'already');
        throw e;
      }
    }
  }
  for (const h of holders) await checkCredits(c, h.membershipId);
  return made;
}

/* Bookings never outrun the credits: counted after writing, inside the
   same transaction, with the package locked. */
async function checkCredits(c, membershipId) {
  const m = (await c.query('select lines from memberships where id = $1', [membershipId])).rows[0];
  const adj = (await c.query('select line, coalesce(sum(delta),0)::int as d from credit_events where membership_id = $1 group by line', [membershipId])).rows;
  const used = (await c.query(
    `select k.class_type_id as t from bookings b join classes k on k.id = b.class_id
      where b.membership_id = $1 and b.status in ('booked','late')`, [membershipId])).rows;
  (m.lines || []).forEach((l, i) => {
    if (l.total == null) return;
    const total = l.total + ((adj.find(a => a.line === i) || {}).d || 0);
    const n = used.filter(u => l.types.includes(u.t)).length;
    if (n > total) bad(409, 'That is more classes than the package has left', 'credits');
  });
}

/* ---------- bonuses ----------
   Pending claims of a bonus offer are granted when their condition is met:
   on booking, on payment, when the friend pays for a package of her own,
   or when the friend comes to a class. Checked after anything that could
   make one true. */
async function grantPending(c) {
  const rows = (await c.query(
    `select cl.id, cl.offer_id, cl.client_id, cl.reservation_id, cl.role,
            o.bonus_classes, o.bonus_to, o.bonus_when, o.title, r.payment, r.status as rstatus
       from offer_claims cl join offers o on o.id = cl.offer_id
       left join reservations r on r.id = cl.reservation_id
      where cl.status = 'pending' and o.kind = 'bonus'`)).rows;
  const byRes = new Map();
  rows.forEach(r => (byRes.get(r.reservation_id) || byRes.set(r.reservation_id, []).get(r.reservation_id)).push(r));
  for (const [resId, claims] of byRes) {
    const buyer = claims.find(x => x.role === 'buyer'), friend = claims.find(x => x.role === 'friend');
    const o = claims[0];
    if (o.rstatus === 'cancelled') { await c.query(`update offer_claims set status = 'void' where reservation_id = $1 and status = 'pending'`, [resId]); continue; }
    let met = false;
    if (o.bonus_when === 'booked') met = true;
    else if (o.bonus_when === 'paid') met = o.payment === 'paid';
    else if (o.bonus_when === 'friend_paid') met = !!friend && (await c.query(
      `select 1 from memberships m join reservations r on r.id = m.reservation_id
        where m.client_id = $1 and r.payment = 'paid' and r.status <> 'cancelled' limit 1`, [friend.client_id])).rowCount > 0;
    else if (o.bonus_when === 'visit') met = !!friend && (await c.query(
      `select 1 from bookings where client_id = $1 and attendance = 'attended' limit 1`, [friend.client_id])).rowCount > 0;
    if (!met) continue;

    const to = [];
    if (buyer && (o.bonus_to === 'referrer' || o.bonus_to === 'both')) to.push(buyer);
    if (friend && (o.bonus_to === 'friend' || o.bonus_to === 'both')) to.push(friend);
    for (const who of to) {
      const mId = await bonusTarget(c, who, resId, o);
      const lines = (await c.query('select lines from memberships where id = $1', [mId])).rows[0].lines || [];
      const line = Math.max(0, lines.findIndex(l => l.types.includes('reformer')));
      await c.query(`insert into credit_events (membership_id, line, delta, reason) values ($1,$2,$3,$4)`,
        [mId, line, o.bonus_classes, 'bonus:' + o.offer_id]);
      await notify(c, who.client_id, 'A bonus class from ' + o.title + ' has been added to your package.', 'good');
    }
    await c.query(`update offer_claims set status = 'granted', granted_at = now() where reservation_id = $1 and status = 'pending' and offer_id = $2`, [resId, o.offer_id]);
  }
}

/* Where a bonus lands: the package she bought with the offer, or her
   newest running package, or — if she has none — a package of its own. */
async function bonusTarget(c, who, resId, o) {
  const own = (await c.query(`select id from memberships where reservation_id = $1 and client_id = $2 and status = 'active' limit 1`,
    [resId, who.client_id])).rows[0];
  if (own) return own.id;
  const today = todayIn(new Date());
  const running = (await c.query(`select id from memberships where client_id = $1 and status = 'active' and ends_on >= $2
                                   order by ends_on desc limit 1`, [who.client_id, today])).rows[0];
  if (running) return running.id;
  const st = await load.settings();
  const from = today > st.openingDate ? today : st.openingDate;
  return (await c.query(
    `insert into memberships (client_id, offer_id, reservation_id, title, lines, starts_on, ends_on, status)
     values ($1,$2,$3,$4,$5,$6,$7,'active') returning id`,
    [who.client_id, o.offer_id, resId, o.title, JSON.stringify([{ types: ['reformer'], total: 0 }]), from, plusDays(from, 59)])).rows[0].id;
}

/* ---------- making a reservation ---------- */
async function newRef(c) {
  for (let i = 0; i < 20; i++) {
    const ref = 'DUA-' + Array.from(randomBytes(4), b => REF_ALPHA[b % REF_ALPHA.length]).join('');
    if (!(await c.query('select 1 from reservations where ref = $1', [ref])).rowCount) return ref;
  }
  bad(500, 'Could not make a reference');
}

export async function createReservation(body, meta, actor) {
  const admin = !!actor && actor.role === 'admin';
  const now = new Date();
  const today = todayIn(now);
  await ensureSynced(now);
  const st = await load.settings();
  if (!admin) await throttle('reserve', meta && meta.ip, 12, 60);

  const plans = await load.plans(true);
  const offerId = trim(body.offerId) || null;
  const offer = offerId ? await load.offer(offerId) : null;
  if (offerId && !offer) bad(404, 'No such offer', 'offer');
  if (offer && offer.archived) bad(409, 'This offer is no longer available', 'offer');
  if (offer && !admin && !load.offerIsLive(offer, today)) {
    if (offer.maxRedemptions != null && offer.claimed >= offer.maxRedemptions) bad(409, 'This offer has reached its limit', 'offer-limit');
    bad(409, 'This offer is no longer available', 'offer');
  }

  let plan = null;
  if (!offer || offer.kind !== 'bundle') {
    plan = plans.find(p => p.id === trim(body.planId) && !p.archived);
    if (!plan) bad(400, 'Choose a package', 'plan');
    if (!plan.allowances.length) bad(409, 'That package has no classes in it', 'plan');
    if (!admin && !plan.bookable) bad(409, 'That package cannot be booked online', 'plan');
    if (offer && !eligiblePlansFor(offer, plans).some(p => p.id === plan.id)) bad(409, 'This offer does not apply to that package', 'plan');
  }

  /* Who. The admin may name an existing client for the first person. */
  const want = offer && offer.kind === 'bundle' ? offer.persons : 1;
  const raw = Array.isArray(body.people) ? body.people : [];
  let adminClient = null;
  /* A client signed in to the phone app reserves as herself. */
  const appClient = !!actor && actor.role === 'client';
  if (appClient) {
    adminClient = await one(`select id, name, phone from users where id = $1 and role = 'client' and active`, [actor.id]);
    if (!adminClient) bad(403, 'This account has been removed');
  }
  if (admin && body.clientId) {
    adminClient = await one(`select id, name, phone from users where id = $1 and role = 'client' and active`, [body.clientId]);
    if (!adminClient) bad(404, 'No such client', 'client');
  }
  const people = [];
  for (let i = 0; i < want; i++) {
    if (i === 0 && adminClient) people.push({ clientId: adminClient.id, key: phoneKey(adminClient.phone) || 'id:' + adminClient.id, name: adminClient.name });
    else people.push(person(raw[i], i === 0 ? 'p1' : 'p2'));
  }
  if (want === 2 && people[0].key === people[1].key) bad(400, 'The two people need different phone numbers', 'p2-phone');
  const friendIn = offer && offer.kind === 'bonus' && (offer.friendRequired || (body.friend && trim(body.friend.name)));
  const friend = friendIn ? person(body.friend, 'friend') : null;
  if (friend && friend.key === people[0].key) bad(400, 'Your friend needs her own phone number', 'friend-phone');

  /* What, and for how much — written down now, and never recomputed. */
  const lines = offer && offer.kind === 'bundle' ? offer.lines : load.linesOfPlan(plan);
  if (!lines.length) bad(409, 'That package has no classes in it', 'plan');
  const validityDays = offer && offer.kind === 'bundle' ? offer.validityDays : plan.validityDays;
  const base = offer && offer.kind === 'bundle' ? offer.price : plan.price;
  const pct = offer && offer.kind === 'discount' ? (offer.discountPct || 0) : 0;
  const unit = base == null ? null : Math.round(base * (100 - pct) / 100);
  const original = offer && offer.kind === 'bundle' ? offer.original : (pct ? base : null);
  const total = unit == null ? null : unit * want;
  const title = !offer ? plan.name : offer.kind === 'bundle' ? offer.title : plan.name + ' · ' + offer.title;
  const together = !offer || offer.persons === 1 || offer.together;
  let start = today > st.openingDate ? today : st.openingDate;
  if (admin && DATE.test(String(body.start || ''))) start = body.start;
  let end = plusDays(start, validityDays - 1);
  if (admin && DATE.test(String(body.end || '')) && body.end >= start) end = body.end;

  const status = admin && ['pending', 'confirmed'].includes(body.status) ? body.status : (admin ? 'confirmed' : 'pending');
  const payment = admin && body.payment === 'paid' ? 'paid' : 'unpaid';
  const notes = String(trim(body.notes) || '').slice(0, 500) || null;
  const byPerson = Array.isArray(body.classIdsByPerson) ? body.classIdsByPerson : null;
  const classIds = Array.isArray(body.classIds) ? body.classIds : [];
  const token = randomBytes(24).toString('base64url');

  const out = await tx(async c => {
    if (offer) {
      /* The offer is locked while it is counted, so the thirtieth and the
         thirty-first claim cannot both get in. */
      await c.query('select id from offers where id = $1 for update', [offer.id]);
      const claimed = (await c.query(`select count(*)::int as n from offer_claims
                                       where offer_id = $1 and status <> 'void' and role = 'buyer'`, [offer.id])).rows[0].n;
      if (offer.maxRedemptions != null && claimed >= offer.maxRedemptions) bad(409, 'This offer has reached its limit', 'offer-limit');
    }

    for (const p of people) if (!p.clientId) p.clientId = await clientFor(c, p);
    const friendId = friend ? await clientFor(c, friend) : null;
    if (friendId && people.some(p => p.clientId === friendId)) bad(400, 'Your friend needs her own phone number', 'friend-phone');

    if (offer) {
      if (offer.newCustomersOnly)
        for (const p of people) if (await hasHistory(c, p.clientId)) bad(409, 'This offer is for new clients', 'offer-new');
      for (const p of people) {
        const dup = (await c.query(`select 1 from offer_claims where offer_id = $1 and client_id = $2 and status <> 'void'`,
          [offer.id, p.clientId])).rowCount;
        if (dup) bad(409, 'This offer has already been used with this phone number', 'offer-used');
      }
      if (friendId) {
        if (offer.friendNew && await hasHistory(c, friendId)) bad(409, 'Your friend has already been to DUA, so this offer does not apply', 'friend-new');
        const dup = (await c.query(`select 1 from offer_claims where offer_id = $1 and client_id = $2 and status <> 'void'`,
          [offer.id, friendId])).rowCount;
        if (dup) bad(409, 'Your friend has already been part of this offer', 'friend-used');
      }
    }

    const ref = await newRef(c);
    const terms = {
      lines, validityDays, together, persons: want, cancelMinutes: st.cancelMinutes,
      offer: offer ? { id: offer.id, kind: offer.kind, title: offer.title, discountPct: offer.discountPct,
                       bonusClasses: offer.bonusClasses, bonusTo: offer.bonusTo, bonusWhen: offer.bonusWhen } : null,
      plan: plan ? { id: plan.id, name: plan.name, price: plan.price } : null,
      friend: friend ? { name: friend.name, phone: friend.phone } : null,
      priceShown: st.showPrices
    };
    const r = (await c.query(
      `insert into reservations (ref, manage_hash, status, payment, source, plan_id, offer_id, title,
                                 unit_price, original_price, discount_pct, persons, total_price, terms, notes, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id`,
      [ref, digest(token), status, payment, admin ? 'admin' : appClient ? 'app' : 'web', plan ? plan.id : null, offer ? offer.id : null, title,
       unit, original, pct || null, want, total, JSON.stringify(terms), notes, actor ? actor.id : null])).rows[0];

    const holders = [];
    for (const p of people) {
      const m = (await c.query(
        `insert into memberships (client_id, plan_id, offer_id, reservation_id, title, lines, starts_on, ends_on, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'active') returning id`,
        [p.clientId, plan ? plan.id : null, offer ? offer.id : null, r.id, title, JSON.stringify(lines), start, end])).rows[0];
      holders.push({ membershipId: m.id, clientId: p.clientId });
    }

    if (offer) {
      const st0 = offer.kind === 'bonus' ? 'pending' : 'claimed';
      await c.query(`insert into offer_claims (offer_id, client_id, reservation_id, role, status) values ($1,$2,$3,'buyer',$4)`,
        [offer.id, people[0].clientId, r.id, st0]);
      if (people[1]) await c.query(`insert into offer_claims (offer_id, client_id, reservation_id, role, status) values ($1,$2,$3,'friend',$4)`,
        [offer.id, people[1].clientId, r.id, st0]);
      if (friendId) await c.query(`insert into offer_claims (offer_id, client_id, reservation_id, role, status) values ($1,$2,$3,'friend','pending')`,
        [offer.id, friendId, r.id]);
    }

    if (together) await bookInto(c, st, now, classIds, holders, r.id, { admin });
    else for (let i = 0; i < holders.length; i++)
      await bookInto(c, st, now, (byPerson && byPerson[i]) || (i === 0 ? classIds : []), [holders[i]], r.id, { admin });

    await grantPending(c);
    return { id: r.id, ref };
  });

  const view = await reservationView(out.id, { admin });
  const email = (people[0] && people[0].email) || null;
  if (email && mailConfigured()) {
    sendBookingEmail({ to: email, name: String(people[0].name || '').split(' ')[0], lang: meta && meta.lang,
                       ref: out.ref, token, view }).catch(e => console.error('booking email not sent: ' + e.message));
  }
  return { ref: out.ref, token, reservation: view };
}

/* ---------- reading one back ---------- */
export async function reservationView(id, opts) {
  const admin = !!(opts && opts.admin);
  const now = new Date();
  const r = await one('select * from reservations where id = $1', [id]);
  if (!r) bad(404, 'No such reservation', 'reservation');
  const st = await load.settings();
  const memberships = (await many('select * from memberships where reservation_id = $1 order by created_at', [id])).map(load.membershipRow);
  const ids = memberships.map(m => m.id);
  const [bookings, events, types] = await Promise.all([load.bookingsForMemberships(ids), load.creditEvents(ids), load.classTypes()]);
  const classes = await load.classesByIds([...new Set(bookings.map(b => b.classId))]);
  const who = ids.length ? await many(
    `select u.id, u.name, u.phone, u.email from users u where u.id = any($1)`, [memberships.map(m => m.clientId)]) : [];
  const staff = classes.length ? await many(`select id, name from users where id = any($1)`,
    [[...new Set(classes.map(k => k.instructorId).filter(Boolean))]]) : [];
  const state = { settings: st, classTypes: types, classes, bookings, memberships, creditEvents: events };
  const terms = r.terms || {};
  const showPrice = admin || st.showPrices;

  return {
    id: admin ? r.id : undefined, ref: r.ref, status: r.status, payment: r.payment, source: r.source,
    title: r.title, planId: r.plan_id, offerId: r.offer_id, persons: r.persons, together: terms.together !== false,
    unitPrice: showPrice ? r.unit_price : null, originalPrice: showPrice ? r.original_price : null,
    discountPct: r.discount_pct, totalPrice: showPrice ? r.total_price : null,
    friend: admin ? terms.friend || null : (terms.friend ? { name: terms.friend.name } : null),
    notes: admin ? r.notes : undefined, createdAt: r.created_at,
    cancelMinutes: st.cancelMinutes,
    people: memberships.map((m, i) => {
      const u = who.find(x => x.id === m.clientId) || {};
      const lines = rules.creditLines(state, m);
      const sum = rules.creditSummary(state, m);
      const reserved = bookings.filter(b => b.membershipId === m.id && b.status === 'booked' &&
        (() => { const k = classes.find(x => x.id === b.classId); return k && at(k.date, k.start) > now; })()).length;
      return {
        index: i, membershipId: m.id, clientId: admin ? m.clientId : undefined,
        name: u.name || '', phone: admin ? u.phone : undefined, email: admin ? u.email : undefined,
        title: m.title, start: m.start, end: m.end, status: m.status,
        expired: m.end < todayIn(now),
        lines: lines.map(l => ({ index: l.index, types: l.types, label: l.label, total: l.total, base: l.base, adjust: l.adjust, used: l.used, left: l.unlimited ? null : l.left })),
        total: sum.unlimited ? null : sum.total, used: sum.used, left: sum.unlimited ? null : sum.left, reserved
      };
    }),
    bookings: bookings.map(b => {
      const k = classes.find(x => x.id === b.classId);
      if (!k) return null;
      const m = memberships.find(x => x.id === b.membershipId);
      const cc = rules.canCancel(k, now, state);
      const started = at(k.date, k.start) <= now;
      const s = staff.find(x => x.id === k.instructorId);
      return {
        id: b.id, classId: k.id, person: m ? memberships.indexOf(m) : 0, date: k.date, start: k.start, end: k.end,
        typeId: k.typeId, typeName: (types.find(t => t.id === k.typeId) || {}).name || k.typeId,
        instructor: s ? (admin ? s.name : s.name.split(' ')[0]) : null,
        status: b.status, attendance: b.attendance, classCancelled: k.cancelled,
        deadline: cc.deadline.toISOString(), canCancel: b.status === 'booked' && !k.cancelled && cc.ok, started
      };
    }).filter(Boolean).sort((a, z) => (a.date + a.start).localeCompare(z.date + z.start))
  };
}

const byToken = async token => {
  if (!token || String(token).length < 20) bad(404, 'That link is not valid', 'token');
  const r = await one('select id, status from reservations where manage_hash = $1', [digest(token)]);
  if (!r) bad(404, 'That link is not valid', 'token');
  return r;
};

export async function publicReservation(body) {
  const r = await byToken(body.token);
  return reservationView(r.id, { admin: false });
}

/* Booking the rest of a package later, from her link. */
export async function publicBookMore(body, meta) {
  const r = await byToken(body.token);
  await throttle('book-more', meta && meta.ip, 40, 60);
  if (r.status === 'cancelled' || r.status === 'completed') bad(409, 'This reservation is closed', 'closed');
  const now = new Date();
  await ensureSynced(now);
  const st = await load.settings();
  const res = await one('select terms from reservations where id = $1', [r.id]);
  const ms = await many(`select id, client_id from memberships where reservation_id = $1 order by created_at`, [r.id]);
  const together = !res.terms || res.terms.together !== false;
  const idx = Math.min(Math.max(0, Number(body.person) || 0), ms.length - 1);
  const holders = (together ? ms : [ms[idx]]).map(m => ({ membershipId: m.id, clientId: m.client_id }));
  await tx(async c => { await bookInto(c, st, now, body.classIds, holders, r.id, { admin: false }); await grantPending(c); });
  return reservationView(r.id, { admin: false });
}

/* Cancelling from her link: up to the deadline, and not a minute after.
   A Duo that comes together cancels together. */
export async function publicCancel(body) {
  const r = await byToken(body.token);
  const now = new Date();
  const st = await load.settings();
  await tx(async c => {
    const b = (await c.query(
      `select b.id, b.class_id, b.status, k.on_date, k.starts, k.cancelled
         from bookings b join classes k on k.id = b.class_id
        where b.id = $1 and b.reservation_id = $2 for update of b`, [body.bookingId, r.id])).rows[0];
    if (!b) bad(404, 'Booking not found', 'booking');
    if (b.status !== 'booked') bad(409, 'That booking is not active', 'booking');
    const cc = rules.canCancel({ date: b.on_date, start: hhmm(b.starts) }, now, { settings: st });
    if (!cc.ok) bad(409, 'It is too late to cancel this class. It counts as used.', 'too-late');
    const res = (await c.query('select terms from reservations where id = $1', [r.id])).rows[0];
    const together = !res.terms || res.terms.together !== false;
    if (together)
      await c.query(`update bookings set status = 'cancelled' where reservation_id = $1 and class_id = $2 and status = 'booked'`, [r.id, b.class_id]);
    else
      await c.query(`update bookings set status = 'cancelled' where id = $1`, [b.id]);
  });
  return reservationView(r.id, { admin: false });
}

/* ---------- the studio's side ---------- */

export async function adminReservations(user) {
  need(user, 'admin');
  const rows = await many(
    `select r.id, r.ref, r.status, r.payment, r.title, r.total_price, r.persons, r.offer_id, r.plan_id, r.source, r.created_at,
            coalesce(json_agg(json_build_object('clientId', u.id, 'name', u.name, 'phone', u.phone,
                                                'membershipId', m.id, 'start', m.starts_on, 'end', m.ends_on))
                     filter (where m.id is not null), '[]') as people
       from reservations r
       left join memberships m on m.reservation_id = r.id
       left join users u on u.id = m.client_id
      where r.created_at > now() - interval '400 days'
      group by r.id order by r.created_at desc limit 800`);
  return rows.map(r => ({
    id: r.id, ref: r.ref, status: r.status, payment: r.payment, title: r.title, totalPrice: r.total_price,
    persons: r.persons, offerId: r.offer_id, planId: r.plan_id, source: r.source, createdAt: r.created_at, people: r.people
  }));
}

export async function adminReservation(user, id) {
  need(user, 'admin');
  if (!UUID.test(String(id))) bad(404, 'No such reservation');
  return reservationView(id, { admin: true });
}

export async function adminCreate(user, body, meta) {
  need(user, 'admin');
  return createReservation(body, meta, user);
}

export async function adminUpdateReservation(user, id, body) {
  need(user, 'admin');
  const now = new Date();
  await tx(async c => {
    const r = (await c.query('select id, status, payment from reservations where id = $1 for update', [id])).rows[0];
    if (!r) bad(404, 'No such reservation');
    if (body.status !== undefined) {
      if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(body.status)) bad(400, 'Unknown status', 'status');
      if (body.status === 'cancelled' && r.status !== 'cancelled') {
        /* Cancelling the reservation cancels its packages and frees every
           place it still holds in a class that has not started. */
        await c.query(`update memberships set status = 'cancelled' where reservation_id = $1 and status = 'active'`, [id]);
        await c.query(
          `update bookings b set status = 'cancelled' from classes k
            where k.id = b.class_id and b.reservation_id = $1 and b.status = 'booked'
              and (k.on_date > $2 or (k.on_date = $2 and k.starts > $3))`, [id, todayIn(now), hhmmNow(now)]);
        await c.query(`update offer_claims set status = 'void' where reservation_id = $1`, [id]);
      }
      if (r.status === 'cancelled' && body.status !== 'cancelled') {
        await c.query(`update memberships set status = 'active' where reservation_id = $1 and status = 'cancelled'`, [id]);
        await c.query(`update offer_claims set status = case when status = 'void' then 'claimed' else status end where reservation_id = $1`, [id]);
      }
      await c.query('update reservations set status = $2, updated_at = now() where id = $1', [id, body.status]);
      if (body.status === 'confirmed' && r.status === 'pending') {
        const who = (await c.query('select client_id from memberships where reservation_id = $1', [id])).rows;
        for (const w of who) await notify(c, w.client_id, 'Your reservation is confirmed. See you at DUA.', 'good');
      }
    }
    if (body.payment !== undefined) {
      if (!['unpaid', 'paid'].includes(body.payment)) bad(400, 'Unknown payment state', 'payment');
      await c.query('update reservations set payment = $2, updated_at = now() where id = $1', [id, body.payment]);
    }
    if (body.notes !== undefined)
      await c.query('update reservations set notes = $2, updated_at = now() where id = $1', [id, String(body.notes || '').slice(0, 500) || null]);
    await grantPending(c);
  });
  return reservationView(id, { admin: true });
}
const hhmmNow = now => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Tirane', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now); return p; };

/* A new private link for her, shown once to send on WhatsApp. The old
   one stops working. */
export async function adminNewLink(user, id) {
  need(user, 'admin');
  const token = randomBytes(24).toString('base64url');
  const r = await one('update reservations set manage_hash = $2 where id = $1 returning ref', [id, digest(token)]);
  if (!r) bad(404, 'No such reservation');
  return { ref: r.ref, token, path: '/book?r=' + token };
}

/* Booking into a package by hand. A Duo that comes together is booked as
   a pair unless the studio says otherwise. */
export async function adminBook(user, body) {
  need(user, 'admin');
  const now = new Date();
  const st = await load.settings();
  const m = await one('select id, client_id, reservation_id from memberships where id = $1', [body.membershipId]);
  if (!m) bad(404, 'No such membership');
  let holders = [{ membershipId: m.id, clientId: m.client_id }];
  if (m.reservation_id && body.pair !== false) {
    const res = await one('select terms from reservations where id = $1', [m.reservation_id]);
    if (res && res.terms && res.terms.persons === 2 && res.terms.together !== false)
      holders = (await many(`select id, client_id from memberships where reservation_id = $1 and status = 'active' order by created_at`,
        [m.reservation_id])).map(x => ({ membershipId: x.id, clientId: x.client_id }));
  }
  await tx(async c => { await bookInto(c, st, now, body.classIds, holders, m.reservation_id, { admin: true }); await grantPending(c); });
  return m.reservation_id ? reservationView(m.reservation_id, { admin: true }) : { ok: true };
}

/* Moving a booking to another class: same package, the new class checked
   like any other, the person told. */
export async function adminMove(user, bookingId, body) {
  need(user, 'admin');
  const toId = String(body.classId || '');
  if (!UUID.test(toId)) bad(400, 'Pick a class to move to');
  const out = await tx(async c => {
    const b = (await c.query(`select b.*, m.starts_on, m.ends_on, m.lines from bookings b
                                left join memberships m on m.id = b.membership_id
                               where b.id = $1 for update of b`, [bookingId])).rows[0];
    if (!b) bad(404, 'Booking not found');
    if (b.status !== 'booked') bad(409, 'That booking is not active');
    if (b.class_id === toId) return b;
    const k = (await c.query(`select * from classes where id = $1 for update`, [toId])).rows[0];
    if (!k || k.cancelled) bad(409, 'That class is not running');
    const taken = (await c.query(`select count(*)::int as n from bookings where class_id = $1 and status = 'booked'`, [toId])).rows[0].n;
    if (k.capacity - taken - (k.blocked || 0) < 1) bad(409, 'That class is full', 'full');
    if (b.membership_id) {
      if (k.on_date < b.starts_on || k.on_date > b.ends_on) bad(409, 'That class is outside the dates of the package', 'outside');
      if (!(b.lines || []).some(l => l.types.includes(k.class_type_id))) bad(409, 'That class is not included in the package', 'not-included');
    }
    try { await c.query('update bookings set class_id = $2 where id = $1', [bookingId, toId]); }
    catch (e) { if (e.code === '23505') bad(409, 'She is already booked into that class', 'already'); throw e; }
    await notify(c, b.client_id, 'Your class moved to ' + k.on_date + ', ' + hhmm(k.starts) + '–' + hhmm(k.ends) + '.', 'warn');
    return b;
  });
  return out.reservation_id ? reservationView(out.reservation_id, { admin: true }) : { ok: true };
}

/* Cancelling for her at the desk. The studio decides about the credit:
   given back, or kept as used — the 30-minute rule is hers to override. */
export async function adminCancelBooking(user, bookingId, body) {
  need(user, 'admin');
  const keep = body && body.credit === 'keep';
  const b = await one(`update bookings set status = $2 where id = $1 and status = 'booked'
                       returning reservation_id`, [bookingId, keep ? 'late' : 'cancelled']);
  if (!b) bad(409, 'That booking is not active');
  return b.reservation_id ? reservationView(b.reservation_id, { admin: true }) : { ok: true };
}

/* Giving a credit back after a late cancellation or a no-show. */
export async function adminRestore(user, bookingId) {
  need(user, 'admin');
  const b = await one(
    `update bookings set status = 'cancelled'
      where id = $1 and (status = 'late' or (status = 'booked' and attendance = 'noshow'))
      returning reservation_id`, [bookingId]);
  if (!b) bad(409, 'Only a late cancellation or a no-show can be given back');
  return b.reservation_id ? reservationView(b.reservation_id, { admin: true }) : { ok: true };
}

export async function adminAttendance(user, bookingId, body) {
  need(user, 'admin');
  const v = body.attendance;
  if (v !== null && v !== 'attended' && v !== 'noshow') bad(400, 'Attended, no-show, or not yet');
  const out = await tx(async c => {
    const b = (await c.query(`update bookings set attendance = $2 where id = $1 and status = 'booked'
                               returning reservation_id`, [bookingId, v])).rows[0];
    if (!b) bad(409, 'That booking is not active');
    await grantPending(c);
    return b;
  });
  return out.reservation_id ? reservationView(out.reservation_id, { admin: true }) : { ok: true };
}

export async function adminCredits(user, membershipId, body) {
  need(user, 'admin');
  const delta = Number(body.delta);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) bad(400, 'Add or remove a whole number of classes');
  const line = Math.max(0, Number(body.line) || 0);
  const reason = String(trim(body.reason) || '').slice(0, 120) || (delta > 0 ? 'added at the desk' : 'removed at the desk');
  const m = await one('select id, reservation_id, lines from memberships where id = $1', [membershipId]);
  if (!m) bad(404, 'No such membership');
  if (!(m.lines || [])[line]) bad(400, 'That package has no such line');
  await tx(async c => {
    await c.query('select id from memberships where id = $1 for update', [m.id]);
    await c.query('insert into credit_events (membership_id, line, delta, reason, by_user) values ($1,$2,$3,$4,$5)',
      [m.id, line, delta, reason, user.id]);
    if (delta < 0) await checkCredits(c, m.id);
  });
  return m.reservation_id ? reservationView(m.reservation_id, { admin: true }) : { ok: true };
}

/* Places the studio holds back in one class — a broken reformer, a
   private guest. Never fewer places than are already booked. */
export async function adminBlock(user, classId, body) {
  need(user, 'admin');
  const n = Number(body.blocked);
  if (!Number.isInteger(n) || n < 0 || n > 60) bad(400, 'Blocked places is a whole number');
  return tx(async c => {
    const k = (await c.query('select capacity from classes where id = $1 for update', [classId])).rows[0];
    if (!k) bad(404, 'No such class');
    const taken = (await c.query(`select count(*)::int as n from bookings where class_id = $1 and status = 'booked'`, [classId])).rows[0].n;
    if (taken + n > k.capacity) bad(409, 'Those places are already booked', 'capacity');
    await c.query('update classes set blocked = $2, pinned = true where id = $1', [classId, n]);
    return { ok: true, blocked: n };
  });
}

/* ---------- offers ---------- */
const OFFER_KINDS = ['bundle', 'discount', 'bonus'];
const slug = v => String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function saveOffer(user, body) {
  need(user, 'admin');
  const title = String(trim(body.title) || '');
  if (!title) bad(400, 'Give the offer a title', 'title');
  const kind = OFFER_KINDS.includes(body.kind) ? body.kind : bad(400, 'Pick what kind of offer it is', 'kind');
  const int = (v, min, max) => v === '' || v == null ? null : (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : bad(400, 'Check the numbers', 'number'));
  const price = int(body.price, 0, 10000000), original = int(body.original, 0, 10000000);
  const pct = int(body.discountPct, 0, 100), max = int(body.maxRedemptions, 1, 100000);
  const validity = int(body.validityDays, 1, 3650) || 30;
  const bonus = int(body.bonusClasses, 0, 50) || 0;
  const startsOn = DATE.test(String(body.startsOn || '')) ? body.startsOn : null;
  const endsOn = DATE.test(String(body.endsOn || '')) ? body.endsOn : null;
  if (startsOn && endsOn && endsOn < startsOn) bad(400, 'The offer has to end after it starts', 'dates');
  const types = (await load.classTypes()).map(t => t.id);
  const lines = (Array.isArray(body.lines) ? body.lines : []).map(l => ({
    types: (l.types || []).filter(t => types.includes(t)),
    total: l.total === '' || l.total == null ? null : int(l.total, 1, 500)
  })).filter(l => l.types.length);
  if (kind === 'bundle' && !lines.length) bad(400, 'Say how many classes it includes', 'lines');
  if (kind === 'bundle' && price == null) bad(400, 'A bundle needs a price', 'price');
  if (kind === 'discount' && !pct) bad(400, 'Set the discount', 'discountPct');
  if (kind === 'bonus' && !bonus) bad(400, 'Set how many bonus classes', 'bonusClasses');
  const plans = (await load.plans(true)).map(p => p.id);
  const eligible = (Array.isArray(body.eligiblePlans) ? body.eligiblePlans : []).filter(id => plans.includes(id));
  const persons = Number(body.persons) === 2 ? 2 : 1;
  const id = trim(body.id) || slug(title);
  if (!id) bad(400, 'That title has no letters or digits in it', 'title');
  if (!trim(body.id) && await one('select 1 from offers where id = $1', [id])) bad(409, 'An offer with that title already exists', 'title');

  await q(
    `insert into offers (id, title, description, kind, price_all, original_all, discount_pct, lines, validity_days,
                         starts_on, ends_on, max_redemptions, new_customers_only, eligible_plans, persons, together,
                         friend_required, friend_new, bonus_classes, bonus_to, bonus_when, eligibility, active, sort,
                         description_en, eligibility_en)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     on conflict (id) do update set title=excluded.title, description=excluded.description, kind=excluded.kind,
       price_all=excluded.price_all, original_all=excluded.original_all, discount_pct=excluded.discount_pct,
       lines=excluded.lines, validity_days=excluded.validity_days, starts_on=excluded.starts_on, ends_on=excluded.ends_on,
       max_redemptions=excluded.max_redemptions, new_customers_only=excluded.new_customers_only,
       eligible_plans=excluded.eligible_plans, persons=excluded.persons, together=excluded.together,
       friend_required=excluded.friend_required, friend_new=excluded.friend_new, bonus_classes=excluded.bonus_classes,
       bonus_to=excluded.bonus_to, bonus_when=excluded.bonus_when, eligibility=excluded.eligibility,
       active=excluded.active, sort=excluded.sort,
       description_en=excluded.description_en, eligibility_en=excluded.eligibility_en`,
    [id, title.slice(0, 80), String(trim(body.description) || '').slice(0, 400) || null, kind, price, original, pct,
     JSON.stringify(lines), validity, startsOn, endsOn, max, !!body.newCustomersOnly, eligible, persons, body.together !== false,
     !!body.friendRequired, body.friendNew !== false, bonus,
     ['referrer', 'friend', 'both'].includes(body.bonusTo) ? body.bonusTo : 'both',
     ['booked', 'paid', 'friend_paid', 'visit'].includes(body.bonusWhen) ? body.bonusWhen : 'friend_paid',
     String(trim(body.eligibility) || '').slice(0, 300) || null, !!body.active, Number(body.sort) || 0,
     String(trim(body.descriptionEn) || '').slice(0, 400) || null, String(trim(body.eligibilityEn) || '').slice(0, 300) || null]);
  return { id };
}

export async function setOffer(user, id, body) {
  need(user, 'admin');
  const sets = [], vals = [id];
  if (typeof body.active === 'boolean') { vals.push(body.active); sets.push('active = $' + vals.length); }
  if (typeof body.archived === 'boolean') { vals.push(body.archived); sets.push('archived = $' + vals.length); if (body.archived) sets.push('active = false'); }
  if (!sets.length) bad(400, 'Nothing to change');
  const r = await one(`update offers set ${sets.join(', ')} where id = $1 returning id`, vals);
  if (!r) bad(404, 'No such offer');
  return { ok: true };
}

/* ---------- the studio's rules ---------- */
export async function saveSettings(user, body) {
  need(user, 'admin');
  const set = (k, v) => q(`insert into settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value`, [k, String(v)]);
  if (body.openingDate !== undefined) {
    if (!DATE.test(String(body.openingDate))) bad(400, 'Pick the opening date', 'openingDate');
    await set('opening_date', body.openingDate);
  }
  const int = (v, min, max, msg, field) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) bad(400, msg, field); return n; };
  if (body.cancelMinutes !== undefined) await set('cancel_window_min', int(body.cancelMinutes, 0, 2880, 'The cancellation window is a number of minutes', 'cancelMinutes'));
  if (body.horizonDays !== undefined) await set('booking_horizon_days', int(body.horizonDays, 1, 180, 'How far ahead is a number of days', 'horizonDays'));
  if (body.defaultCapacity !== undefined) await set('default_capacity', int(body.defaultCapacity, 1, 60, 'Capacity is a number of places', 'defaultCapacity'));
  return load.settings();
}

/* ---------- a client with an account, booking in the app ---------- */
export async function appBook(user, classId) {
  need(user, 'client');
  const now = new Date();
  const state = await load.clientState(user.id, now);
  const klass = state.classes.find(c => c.id === classId);
  const verdict = rules.canBook(state, user.id, klass, now);
  if (!verdict.ok) bad(409, verdict.message, verdict.code);
  const pick = rules.packageFor(state, user.id, klass, now);
  await tx(async c => {
    await bookInto(c, state.settings, now, [klass.id], [{ membershipId: pick.membership.id, clientId: user.id }],
      pick.membership.reservationId, { admin: false });
  });
  return { ok: true };
}

export async function appCancel(user, bookingId) {
  need(user, 'client');
  const now = new Date();
  const st = await load.settings();
  return tx(async c => {
    const b = (await c.query(
      `select b.id, b.status, b.reservation_id, b.class_id, k.on_date, k.starts
         from bookings b join classes k on k.id = b.class_id
        where b.id = $1 and b.client_id = $2 for update of b`, [bookingId, user.id])).rows[0];
    if (!b) bad(404, 'Booking not found');
    if (b.status !== 'booked' && b.status !== 'waitlist') bad(409, 'That booking is not active');
    const cc = rules.canCancel({ date: b.on_date, start: hhmm(b.starts) }, now, { settings: st });
    if (b.status === 'booked' && !cc.ok) bad(409, 'It is too late to cancel this class. It counts as used.', 'too-late');
    await c.query(`update bookings set status = 'cancelled' where id = $1`, [b.id]);
    return { ok: true, late: false };
  });
}
