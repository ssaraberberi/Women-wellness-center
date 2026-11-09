/**
 * Bringing the old website's booking data (its own Postgres) into this database.
 *
 * planImport() reads both sides and works out every row it would write — with
 * the id it would have — and every problem it found. It writes nothing; the
 * source is only ever read. applyImport() writes exactly that plan, in one
 * transaction, and refuses while any blocking problem is open or if this
 * source was imported before (legacy_refs). Every created row is logged in
 * legacy_refs with the batch, so the import can be traced and undone.
 *
 * Rules (agreed with the studio, 2026-11-07):
 *  - people: linked to an app client only when the email is verified on both
 *    sides; otherwise a client of her own (never merged), possible duplicates
 *    noted for the desk; phone-only clients kept as they are
 *  - packages keep their dates and exactly the credits the website shows,
 *    explained in the ledger (grant, adjustments, bonuses, classes used);
 *    active-but-unpaid ones stay active and their price is owed (not revenue)
 *  - paid reservations become paid orders on the day they were paid; unpaid
 *    ones are owed; nothing is counted twice
 *  - unlimited lines, non-Reformer lines, bookings with no class at the same
 *    minute, over-full classes, double bookings: blocking, for a person to decide
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { normalizePhone } from '../lib/phone.js';
import { dbDate, studioDate, studioDateTime } from '../lib/time.js';

type Severity = 'blocker' | 'review' | 'info';
export type Issue = { severity: Severity; area: string; sourceId: string; client?: string; message: string };

type Line = { types: string[]; total: number | null };
type WUser = { id: string; name: string; email: string | null; email_verified: boolean; phone: string | null; password_hash: string | null; active: boolean; created_at: Date };
type WPlan = { id: string; name: string; price_all: number; kind: string; validity_days: number; archived: boolean; bookable: boolean; blurb: string | null; blurb_en: string | null; sort: number; lines: Line[] };
type WOffer = { id: string; title: string; description: string | null; description_en: string | null; kind: 'bundle' | 'discount' | 'bonus'; price_all: number | null; original_all: number | null; discount_pct: number | null; lines: Line[]; validity_days: number; starts_on: string | null; ends_on: string | null; max_redemptions: number | null; new_customers_only: boolean; eligible_plans: string[]; persons: number; together: boolean; friend_required: boolean; friend_new: boolean; bonus_classes: number; bonus_to: string; bonus_when: string; eligibility: string | null; eligibility_en: string | null; active: boolean; archived: boolean; sort: number };
type WRes = { id: string; ref: string; status: string; payment: string; source: string; plan_id: string | null; offer_id: string | null; title: string; unit_price: number | null; original_price: number | null; persons: number; total_price: number | null; terms: { together?: boolean } | null; notes: string | null; created_at: Date; updated_at: Date };
type WMem = { id: string; client_id: string; plan_id: string | null; offer_id: string | null; reservation_id: string | null; title: string | null; lines: Line[] | null; starts_on: string; ends_on: string; status: string; created_at: Date };
type WBook = { id: string; class_id: string; client_id: string; status: string; created_at: Date; membership_id: string | null; reservation_id: string | null; attendance: string | null; on_date: string; starts: string; class_type_id: string; cancelled: boolean };
type WEvent = { id: string; membership_id: string; delta: number; reason: string; at: Date };
type WClaim = { id: string; offer_id: string; client_id: string; reservation_id: string | null; role: string; status: string; granted_at: Date | null; created_at: Date };

export type Plan = Awaited<ReturnType<typeof planImport>>;

const q = <T>(db: PrismaClient, sql: string) => db.$queryRawUnsafe<T[]>(sql);
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const nextDay = (d: string) => new Date(+dbDate(d) + 86_400_000).toISOString().slice(0, 10);

export async function planImport(src: PrismaClient, dst: PrismaClient, opts: { batch: string; now?: Date }) {
  const now = opts.now ?? new Date();
  const today = studioDate(now);
  const issues: Issue[] = [];
  const issue = (severity: Severity, area: string, sourceId: string, message: string, client?: string) => issues.push({ severity, area, sourceId, message, client });

  // ───── read the website (read-only) ─────
  const reformer = new Set(
    (await q<{ id: string }>(src, `select id from class_types where lower(id) like '%reformer%' or lower(name) like '%reformer%'`)).map((r) => r.id),
  );
  const users = await q<WUser>(src, `select id, name, email, coalesce(email_verified,false) as email_verified, phone, password_hash, active, created_at from users where role = 'client'`);
  const plans = await q<WPlan>(
    src,
    `select p.id, p.name, p.price_all, p.kind, p.validity_days, p.archived, p.bookable, p.blurb, p.blurb_en, p.sort,
            coalesce((select json_agg(json_build_object('types', a.class_type_ids, 'total', a.limit_count) order by a.sort) from plan_allowances a where a.plan_id = p.id), '[]') as lines
       from plans p order by p.sort`,
  );
  const offers = await q<WOffer>(src, `select *, to_char(starts_on,'YYYY-MM-DD') as starts_on, to_char(ends_on,'YYYY-MM-DD') as ends_on from offers order by sort`);
  const reservations = await q<WRes>(src, `select * from reservations order by created_at`);
  const memberships = await q<WMem>(src, `select id, client_id, plan_id, offer_id, reservation_id, title, lines, to_char(starts_on,'YYYY-MM-DD') as starts_on, to_char(ends_on,'YYYY-MM-DD') as ends_on, status, created_at from memberships order by created_at, id`);
  const bookings = await q<WBook>(
    src,
    `select b.id, b.class_id, b.client_id, b.status, b.created_at, b.membership_id, b.reservation_id, b.attendance,
            to_char(c.on_date,'YYYY-MM-DD') as on_date, to_char(c.starts,'HH24:MI') as starts, c.class_type_id, c.cancelled
       from bookings b join classes c on c.id = b.class_id order by b.created_at`,
  );
  const events = await q<WEvent>(src, `select id::text as id, membership_id, delta, reason, at from credit_events order by at, id`);
  const claims = await q<WClaim>(src, `select id::text as id, offer_id, client_id, reservation_id, role, status, granted_at, created_at from offer_claims order by created_at`);

  // ───── read this database ─────
  // Plain SQL on columns every version has, so a dry run also works against a database not yet migrated.
  const hasRefs = (await q<{ t: string | null }>(dst, `select to_regclass('public.legacy_refs')::text as t`))[0]?.t;
  const already = hasRefs ? (await q<{ n: number }>(dst, `select count(*)::int as n from legacy_refs where source like 'website.%'`))[0].n : 0;
  if (already) issue('blocker', 'run', '-', `This website was already imported (${already} rows in legacy_refs). A second run would duplicate data; it is refused.`);
  if (!hasRefs) issue('info', 'run', '-', 'This database is not migrated yet (no legacy_refs): fine for a dry run; deploy the migrations before applying.');
  const appUsers = await q<{ id: string; email: string | null; role: string; emailVerifiedAt: Date | null; phone: string | null }>(
    dst,
    `select u.id, u.email, u.role::text as role, u.email_verified_at as "emailVerifiedAt", p.phone from users u left join user_profiles p on p.user_id = u.id`,
  );
  const byEmail = new Map(appUsers.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]));
  const byPhone = new Map<string, string[]>();
  for (const u of appUsers) if (u.phone) byPhone.set(u.phone, [...(byPhone.get(u.phone) ?? []), u.id]);
  const appProducts = await q<{ id: string; kind: string; name: string; price: number; classCredits: number; validityDays: number; active: boolean }>(
    dst,
    `select id, kind::text as kind, name, price, class_credits as "classCredits", validity_days as "validityDays", active from membership_products`,
  );
  const usedRefs = new Set((await q<{ reference: string }>(dst, `select reference from orders`)).map((o) => o.reference));
  const activeSingle = appProducts.find((p) => p.kind === 'SINGLE' && p.active);

  // ───── what will be written ─────
  const W = {
    users: [] as Record<string, unknown>[],
    profiles: [] as Record<string, unknown>[],
    prefs: [] as Record<string, unknown>[],
    notes: [] as { clientId: string; body: string }[],
    products: [] as Record<string, unknown>[],
    offers: [] as Record<string, unknown>[],
    offerProducts: [] as { offerId: string; productId: string }[],
    orders: [] as Record<string, unknown>[],
    payments: [] as Record<string, unknown>[],
    purchases: [] as Record<string, unknown>[],
    wallets: [] as Record<string, unknown>[],
    transactions: [] as Record<string, unknown>[],
    bookings: [] as Record<string, unknown>[],
    attendance: [] as Record<string, unknown>[],
    waitlist: [] as Record<string, unknown>[],
    claims: [] as Record<string, unknown>[],
    refs: [] as { source: string; sourceId: string; target: string; targetId: string; batch: string }[],
  };
  const ref = (source: string, sourceId: string, target: string, targetId: string) => W.refs.push({ source: `website.${source}`, sourceId, target, targetId, batch: opts.batch });

  // ── people ──
  const userMap = new Map<string, string>();
  const nameOf = new Map<string, string>();
  const people = { linked: 0, created: 0, review: 0, phoneOnly: 0, invalidPhone: 0 };
  for (const w of users) {
    nameOf.set(w.id, w.name);
    const email = w.email?.trim().toLowerCase() || null;
    const hit = email ? byEmail.get(email) : undefined;
    const phone = w.phone ? normalizePhone(w.phone) : null;
    if (w.phone && !phone) people.invalidPhone++;
    if (hit && hit.role === 'CLIENT' && hit.emailVerifiedAt && w.email_verified) {
      userMap.set(w.id, hit.id);
      ref('users', w.id, 'users', hit.id);
      people.linked++;
      continue;
    }
    const id = randomUUID();
    userMap.set(w.id, id);
    const [firstName, ...rest] = w.name.trim().split(/\s+/);
    const notes: string[] = ['Imported from the old website.'];
    if (hit) {
      notes.push(`The website email ${email} is already used by another app account (${hit.id}); left off this profile until she verifies it.`);
      issue('review', 'clients', w.id, `Same email as app account ${hit.id}, not verified on both sides — kept separate`, w.name);
      people.review++;
    }
    const twins = phone ? (byPhone.get(phone) ?? []) : [];
    if (twins.length) {
      notes.push(`Possible duplicate of ${twins.join(', ')} (same phone) — check before merging.`);
      issue('review', 'clients', w.id, `Same phone as app client(s) ${twins.join(', ')} — kept separate, flagged`, w.name);
      if (!hit) people.review++;
    }
    if (w.phone && !phone) notes.push(`Phone on the website: "${w.phone}" (not a valid number).`);
    if (!email) people.phoneOnly++;
    W.users.push({
      id,
      email: hit ? null : email,
      role: 'CLIENT',
      status: w.active ? 'ACTIVE' : 'DISABLED',
      emailVerifiedAt: w.email_verified && !hit ? w.created_at : null,
      passwordHash: w.password_hash?.startsWith('scrypt$') ? w.password_hash : null,
      createdAt: w.created_at,
    });
    W.profiles.push({ userId: id, firstName: firstName || w.name, lastName: rest.join(' '), phone });
    W.prefs.push({ userId: id });
    W.notes.push({ clientId: id, body: notes.join(' ') });
    ref('users', w.id, 'users', id);
    if (!hit && !twins.length) people.created++;
  }

  // ── packages (lines must be Reformer, counted) ──
  // severity: an archived package nobody holds is only listed; anything in use or on sale blocks.
  const credits = (lines: Line[] | null, where: string, sourceId: string, client?: string, severity: Severity = 'blocker') => {
    let total = 0;
    for (const l of lines ?? []) {
      if (l.total == null) {
        issue(severity, where, sourceId, 'Unlimited line — no unlimited packages in the app; needs a decision', client);
        return null;
      }
      if (!l.types.every((t) => reformer.has(t))) {
        issue(severity, where, sourceId, `Line for non-Reformer classes (${l.types.join(', ')}) — needs a decision`, client);
        return null;
      }
      total += l.total;
    }
    return total;
  };
  const productMap = new Map<string, string>();
  const heldPlans = new Set(memberships.map((m) => m.plan_id));
  for (const p of plans) {
    const n = credits(p.lines, 'packages', p.id, undefined, p.archived && !heldPlans.has(p.id) ? 'review' : 'blocker');
    if (n === null) continue;
    const kind = p.kind === 'single' ? 'SINGLE' : 'PACKAGE';
    const match = appProducts.find((a) => a.kind === kind && norm(a.name) === norm(p.name) && a.price === p.price_all);
    if (match) {
      productMap.set(`plan:${p.id}`, match.id);
      ref('plans', p.id, 'membership_products', match.id);
      if (match.classCredits !== n || match.validityDays !== p.validity_days) {
        issue('review', 'packages', p.id, `Matched app package "${match.name}" but credits/validity differ (${n}/${p.validity_days} vs ${match.classCredits}/${match.validityDays}); past packages keep the website's terms`);
      }
      continue;
    }
    const id = randomUUID();
    // A second active single price would stop single-class booking: the website's comes in switched off.
    const sellable = !p.archived && p.bookable && !(kind === 'SINGLE' && activeSingle);
    if (kind === 'SINGLE' && activeSingle && !p.archived) issue('review', 'packages', p.id, `Website single class "${p.name}" (${p.price_all} L) imported switched off: the app already sells "${activeSingle.name}" (${activeSingle.price} L)`);
    W.products.push({ id, kind, name: p.name, description: p.blurb ?? '', descriptionEn: p.blurb_en, price: p.price_all, classCredits: n, validityDays: p.validity_days, sortOrder: p.sort, active: sellable });
    productMap.set(`plan:${p.id}`, id);
    ref('plans', p.id, 'membership_products', id);
  }

  // ── offers ──
  const offerMap = new Map<string, string>();
  const offerKind = new Map<string, WOffer>();
  for (const o of offers) {
    offerKind.set(o.id, o);
    const id = randomUUID();
    let productId: string | null = null;
    if (o.kind === 'bundle') {
      const n = credits(o.lines, 'offers', o.id);
      if (n === null) continue;
      productId = randomUUID();
      // The website priced a bundle per person (its total was price × persons); the app's package carries the price for all of them.
      const persons = o.persons || 1;
      W.products.push({ id: productId, kind: persons === 2 ? 'DUO' : 'PROMO', name: o.title, description: o.description ?? '', descriptionEn: o.description_en, price: (o.price_all ?? 0) * persons, originalPrice: o.original_all ? o.original_all * persons : null, classCredits: n, validityDays: o.validity_days, persons, sortOrder: o.sort, active: false });
      productMap.set(`offer:${o.id}`, productId);
      ref('offers', o.id, 'membership_products', productId);
    }
    W.offers.push({
      id,
      kind: o.kind.toUpperCase(),
      title: o.title,
      description: o.description ?? '',
      descriptionEn: o.description_en,
      eligibility: o.eligibility,
      eligibilityEn: o.eligibility_en,
      productId,
      together: o.together,
      discountPct: o.discount_pct,
      startsOn: o.starts_on ? dbDate(o.starts_on) : null,
      endsOn: o.ends_on ? dbDate(o.ends_on) : null,
      maxRedemptions: o.max_redemptions,
      newClientsOnly: o.new_customers_only,
      friendRequired: o.friend_required,
      friendNew: o.friend_new,
      bonusClasses: o.bonus_classes,
      bonusTo: o.bonus_to === 'referrer' ? 'REFERRER' : o.bonus_to === 'friend' ? 'FRIEND' : 'BOTH',
      bonusWhen: ({ booked: 'BOOKED', paid: 'PAID', friend_paid: 'FRIEND_PAID', visit: 'VISIT' } as Record<string, string>)[o.bonus_when] ?? 'FRIEND_PAID',
      active: o.active,
      archived: o.archived,
      sortOrder: o.sort,
    });
    for (const planId of o.eligible_plans ?? []) {
      const pid = productMap.get(`plan:${planId}`);
      if (pid) W.offerProducts.push({ offerId: id, productId: pid });
      else issue('review', 'offers', o.id, `Eligible package ${planId} was not imported`);
    }
    offerMap.set(o.id, id);
    ref('offers', o.id, 'offers', id);
  }

  // ── reservations → orders (what was paid, what is owed) ──
  const memsByRes = new Map<string, WMem[]>();
  for (const m of memberships) if (m.reservation_id) memsByRes.set(m.reservation_id, [...(memsByRes.get(m.reservation_id) ?? []), m]);
  const orderMap = new Map<string, string>();
  const buyerOf = new Map<string, string>(); // reservation → membership id of the buyer
  const money = { paid: { n: 0, total: 0 }, owed: { n: 0, total: 0 }, cancelled: { n: 0, total: 0 } };
  for (const r of reservations) {
    const holders = memsByRes.get(r.id) ?? [];
    const buyer = holders[0];
    if (!buyer) {
      issue('blocker', 'money', r.id, `Reservation ${r.ref} has nobody on it — cannot tell who pays`);
      continue;
    }
    const clientId = userMap.get(buyer.client_id);
    if (!clientId) {
      issue('blocker', 'money', r.id, `Reservation ${r.ref}: its client is not a website client`);
      continue;
    }
    if (r.status === 'cancelled' && r.payment === 'paid') {
      issue('blocker', 'money', r.id, `Reservation ${r.ref} is cancelled but marked paid — was the money returned? Needs a decision`, nameOf.get(buyer.client_id));
      continue;
    }
    const total = r.total_price ?? 0;
    const subtotal = r.original_price ? r.original_price * (r.persons || 1) : total;
    const status = r.status === 'cancelled' ? 'CANCELLED' : r.payment === 'paid' ? 'PAID' : 'PENDING';
    const id = randomUUID();
    let reference = r.ref;
    if (usedRefs.has(reference)) {
      reference = `${r.ref}-W`;
      issue('info', 'money', r.id, `Reference ${r.ref} already exists in the app; imported as ${reference}`);
    }
    usedRefs.add(reference);
    W.orders.push({ id, reference, userId: clientId, status, subtotal: Math.max(subtotal, total), discount: Math.max(subtotal - total, 0), total, offerId: r.offer_id ? (offerMap.get(r.offer_id) ?? null) : null, createdAt: r.created_at });
    if (status === 'PAID') {
      const pid = randomUUID();
      W.payments.push({ id: pid, orderId: id, method: 'CASH', status: 'COMPLETED', amount: total, provider: 'website-import', note: 'Imported from the website, where it was marked paid (method not recorded there).', createdAt: r.updated_at, completedAt: r.updated_at });
      ref('reservations', r.id, 'payments', pid);
      money.paid.n++;
      money.paid.total += total;
    } else if (status === 'PENDING') {
      money.owed.n++;
      money.owed.total += total;
    } else {
      money.cancelled.n++;
      money.cancelled.total += total;
    }
    orderMap.set(r.id, id);
    buyerOf.set(r.id, buyer.id);
    ref('reservations', r.id, 'orders', id);
  }

  // ── classes: the app's class at the same minute ──
  const minDate = bookings.reduce((m, b) => (b.on_date < m ? b.on_date : m), today);
  const sessions = await q<{ id: string; at: string; capacity: number; status: string }>(
    dst,
    `select id, to_char(starts_at at time zone 'Europe/Tirane','YYYY-MM-DD HH24:MI') as at, capacity, status::text from class_sessions where starts_at >= '${minDate}'::date - 1`,
  );
  const sessionAt = new Map<string, typeof sessions>();
  for (const s of sessions) if (s.status !== 'CANCELLED') sessionAt.set(s.at, [...(sessionAt.get(s.at) ?? []), s]);
  const appBooked = new Map(
    (await q<{ session_id: string; n: number }>(dst, `select session_id, count(*)::int as n from class_bookings where status = 'BOOKED' group by 1`)).map((r) => [r.session_id, r.n]),
  );
  const appBookedPairs = new Set((await q<{ k: string }>(dst, `select session_id || ':' || user_id as k from class_bookings where status = 'BOOKED'`)).map((r) => r.k));

  // ── packages → purchases + wallets, with the ledger that explains the balance ──
  const memMap = new Map<string, { purchaseId: string; walletId: string | null; clientId: string; balance: number; total: number }>();
  const pairOf = new Map<string, string>(); // reservation → pair id (DUO)
  const packages = { active: 0, activeUnpaid: 0, creditsRemaining: 0 };
  for (const m of memberships) {
    const clientId = userMap.get(m.client_id);
    const client = nameOf.get(m.client_id);
    if (!clientId) {
      issue('blocker', 'packages', m.id, 'Package of someone who is not a website client');
      continue;
    }
    const n = credits(m.lines, 'packages', m.id, client);
    if (n === null) continue;
    const productId =
      (m.offer_id && offerKind.get(m.offer_id)?.kind === 'bundle' && productMap.get(`offer:${m.offer_id}`)) || (m.plan_id && productMap.get(`plan:${m.plan_id}`)) || null;
    const res = m.reservation_id ? reservations.find((r) => r.id === m.reservation_id) : undefined;
    const isBuyer = !!res && buyerOf.get(res.id) === m.id;
    const offer = m.offer_id ? offerKind.get(m.offer_id) : undefined;
    const duo = !!offer && offer.kind === 'bundle' && offer.persons === 2;
    let pairId: string | null = null;
    if (duo && res) {
      pairId = pairOf.get(res.id) ?? randomUUID();
      pairOf.set(res.id, pairId);
    }
    const status = m.status === 'active' ? 'ACTIVE' : m.status === 'replaced' ? 'EXPIRED' : 'CANCELLED';
    const startsAt = studioDateTime(m.starts_on, '00:00');
    const expiresAt = studioDateTime(nextDay(m.ends_on), '00:00');
    const purchaseId = randomUUID();
    W.purchases.push({
      id: purchaseId,
      userId: clientId,
      productId: productId ?? 'BONUS_PRODUCT',
      orderId: isBuyer ? orderMap.get(res!.id) : null,
      status,
      nameSnapshot: m.title ?? 'Paketë',
      priceSnapshot: isBuyer ? (res!.total_price ?? 0) : 0,
      classCredits: n,
      validityDays: Math.round((+expiresAt - +startsAt) / 86_400_000),
      startsAt,
      expiresAt,
      createdAt: m.created_at,
      activatedAt: status === 'CANCELLED' ? null : m.created_at,
      pairId,
      together: duo ? (res?.terms?.together ?? offer?.together ?? true) : false,
    });
    ref('memberships', m.id, 'membership_purchases', purchaseId);
    if (!productId && (m.plan_id || (offer && offer.kind === 'bundle'))) issue('blocker', 'packages', m.id, `"${m.title}": its package on the website could not be brought over (see that package's problem)`, client);
    else if (!productId) issue('info', 'packages', m.id, `"${m.title}" had no package of its own on the website (a bonus); filed under "Klasa bonus"`, client);
    let walletId: string | null = null;
    if (status !== 'CANCELLED') {
      walletId = randomUUID();
      W.transactions.push({ id: randomUUID(), walletId, userId: clientId, type: 'GRANT', delta: n, balanceAfter: n, reason: `${m.title ?? 'Paketë'} (website)`, idempotencyKey: `legacy-grant:${m.id}`, createdAt: m.created_at });
    }
    memMap.set(m.id, { purchaseId, walletId, clientId, balance: n, total: n });
    if (status === 'ACTIVE') {
      packages.active++;
      if (res && res.payment !== 'paid') packages.activeUnpaid++;
    }
  }

  // Ledger rows in time order, so every balance-after is what it was then.
  type Move = { at: Date; memId: string; delta: number; type: string; reason: string; key: string; bookingId?: string };
  const moves: Move[] = [];
  for (const e of events) {
    if (!memMap.get(e.membership_id)?.walletId) continue;
    const bonus = e.reason.startsWith('bonus:');
    moves.push({ at: e.at, memId: e.membership_id, delta: e.delta, type: bonus ? 'BONUS' : e.delta > 0 ? 'ADMIN_ADD' : 'ADMIN_DEDUCT', reason: bonus ? 'Bonus (website)' : `${e.reason} (website)`, key: `legacy-ce:${e.id}` });
  }

  // ── bookings ──
  const placed = new Map<string, number>(); // app session → places the import adds
  const pairBooking = new Map<string, string>(); // reservation:class → pair id
  const bookingStats = { imported: 0, history: 0, waitlist: 0, notImported: 0 };
  for (const b of bookings) {
    const clientId = userMap.get(b.client_id);
    const client = nameOf.get(b.client_id);
    if (!clientId) continue;
    const future = studioDateTime(b.on_date, b.starts) > now;
    const live = b.status === 'booked';
    const spends = (b.status === 'booked' || b.status === 'late') && !!b.membership_id;
    const mem = b.membership_id ? memMap.get(b.membership_id) : undefined;
    const hits = sessionAt.get(`${b.on_date} ${b.starts}`) ?? [];
    const s = hits.length === 1 ? hits[0] : null;
    if (!reformer.has(b.class_type_id)) {
      if (live && future) issue('blocker', 'bookings', b.id, `Upcoming non-Reformer class (${b.class_type_id}) ${b.on_date} ${b.starts}`, client);
      else bookingStats.notImported++;
      continue;
    }
    if (b.status === 'waitlist') {
      if (future && s) {
        W.waitlist.push({ id: randomUUID(), sessionId: s.id, userId: clientId, status: 'WAITING', createdAt: b.created_at });
        bookingStats.waitlist++;
      } else bookingStats.notImported++;
      continue;
    }
    if (!s) {
      if (live && future) issue('blocker', 'bookings', b.id, `Upcoming class ${b.on_date} ${b.starts}: ${hits.length ? 'several' : 'no'} app class at that minute — create or choose it first`, client);
      else {
        bookingStats.history++;
        // Not placed on a class, but the class she used still counts against her package.
        if (spends && mem?.walletId) moves.push({ at: b.created_at, memId: b.membership_id!, delta: -1, type: 'BOOKING', reason: `${b.on_date} ${b.starts} (website)`, key: `legacy-use:${b.id}` });
      }
      continue;
    }
    if (live && future) {
      if (appBookedPairs.has(`${s.id}:${clientId}`)) {
        issue('blocker', 'bookings', b.id, `${b.on_date} ${b.starts}: she is booked in this class in the app too`, client);
        continue;
      }
      const n = (placed.get(s.id) ?? 0) + 1;
      placed.set(s.id, n);
      if ((appBooked.get(s.id) ?? 0) + n > s.capacity) issue('blocker', 'bookings', b.id, `${b.on_date} ${b.starts}: the app class would be over capacity (${s.capacity})`, client);
    }
    const id = randomUUID();
    const status = b.status === 'booked' ? 'BOOKED' : b.status === 'late' ? 'LATE_CANCELLED' : 'CANCELLED';
    const res = b.reservation_id ? reservations.find((r) => r.id === b.reservation_id) : undefined;
    let pairId: string | null = null;
    if (res && pairOf.has(res.id) && (res.terms?.together ?? true)) {
      const k = `${res.id}:${b.class_id}`;
      pairId = pairBooking.get(k) ?? randomUUID();
      pairBooking.set(k, pairId);
    }
    W.bookings.push({
      id,
      sessionId: s.id,
      userId: clientId,
      walletId: spends && mem?.walletId ? mem.walletId : null,
      creditsUsed: spends && mem?.walletId ? 1 : 0,
      status,
      source: res?.source === 'admin' ? 'ADMIN' : 'MEMBER_WEB',
      idempotencyKey: `legacy:${b.id}`,
      bookedAt: b.created_at,
      cancelledAt: status === 'BOOKED' ? null : b.created_at,
      pairId,
    });
    if (b.attendance && status === 'BOOKED') W.attendance.push({ bookingId: id, status: b.attendance === 'attended' ? 'PRESENT' : 'ABSENT', markedAt: b.created_at });
    if (spends && mem?.walletId) moves.push({ at: b.created_at, memId: b.membership_id!, delta: -1, type: 'BOOKING', reason: `${b.on_date} ${b.starts} (website)`, key: `booking:${id}`, bookingId: id });
    ref('bookings', b.id, 'class_bookings', id);
    bookingStats.imported++;
  }

  moves.sort((a, b) => +a.at - +b.at);
  for (const mv of moves) {
    const mem = memMap.get(mv.memId)!;
    mem.balance += mv.delta;
    if (mv.delta > 0) mem.total += mv.delta;
    W.transactions.push({ id: randomUUID(), walletId: mem.walletId, userId: mem.clientId, type: mv.type, delta: mv.delta, balanceAfter: mem.balance, bookingId: mv.bookingId ?? null, reason: mv.reason, idempotencyKey: mv.key, createdAt: mv.at });
  }
  for (const m of memberships) {
    const mem = memMap.get(m.id);
    if (!mem?.walletId) continue;
    const p = W.purchases.find((x) => x.id === mem.purchaseId)!;
    if (mem.balance < 0) issue('blocker', 'credits', m.id, `More classes used than the package had (balance ${mem.balance})`, nameOf.get(m.client_id));
    W.wallets.push({ id: mem.walletId, userId: mem.clientId, purchaseId: mem.purchaseId, total: mem.total, remaining: Math.max(mem.balance, 0), expiresAt: p.expiresAt });
    if (p.status === 'ACTIVE') packages.creditsRemaining += Math.max(mem.balance, 0);
  }

  // ── who used which offer ──
  for (const c of claims) {
    const offerId = offerMap.get(c.offer_id);
    const clientId = userMap.get(c.client_id);
    if (!offerId || !clientId) continue;
    const id = randomUUID();
    W.claims.push({ id, offerId, clientId, orderId: c.reservation_id ? (orderMap.get(c.reservation_id) ?? null) : null, role: c.role === 'friend' ? 'FRIEND' : 'BUYER', status: c.status.toUpperCase(), grantedAt: c.granted_at, createdAt: c.created_at });
    ref('offer_claims', c.id, 'offer_claims', id);
  }

  // ── reconciliation: what each client should have after the import ──
  const perClient = new Map<string, { name: string; credits: number; owed: number; paid: number; upcoming: number }>();
  const row = (wid: string) => perClient.get(wid) ?? perClient.set(wid, { name: nameOf.get(wid) ?? '?', credits: 0, owed: 0, paid: 0, upcoming: 0 }).get(wid)!;
  for (const m of memberships) {
    const mem = memMap.get(m.id);
    if (mem?.walletId && m.status === 'active' && m.ends_on >= today) row(m.client_id).credits += mem.balance;
  }
  for (const r of reservations) {
    const buyer = buyerOf.get(r.id);
    const m = buyer ? memberships.find((x) => x.id === buyer) : undefined;
    if (!m || !orderMap.has(r.id)) continue;
    if (r.status !== 'cancelled' && r.payment !== 'paid') row(m.client_id).owed += r.total_price ?? 0;
    if (r.payment === 'paid' && r.status !== 'cancelled') row(m.client_id).paid += r.total_price ?? 0;
  }
  for (const b of bookings) if (b.status === 'booked' && studioDateTime(b.on_date, b.starts) > now && userMap.has(b.client_id)) row(b.client_id).upcoming++;
  const reconciliation = [...perClient.entries()].map(([websiteId, r]) => ({ websiteId, appId: userMap.get(websiteId)!, ...r }));

  const summary = {
    batch: opts.batch,
    generatedAt: now.toISOString(),
    people: { ...people, websiteClients: users.length },
    packages: { ...packages, total: memberships.length, products: W.products.length, offers: W.offers.length },
    money,
    bookings: bookingStats,
    claims: W.claims.length,
    issues: { blocker: issues.filter((i) => i.severity === 'blocker').length, review: issues.filter((i) => i.severity === 'review').length, info: issues.filter((i) => i.severity === 'info').length },
    rows: Object.fromEntries(Object.entries(W).map(([k, v]) => [k, v.length])),
  };
  return { summary, issues, reconciliation, writes: W };
}

/**
 * Write the plan, all of it or nothing. Refuses while a blocking problem is
 * open. Returns the same reconciliation, read back from this database.
 */
export async function applyImport(dst: PrismaClient, plan: Plan, opts: { actorId: string }) {
  const blockers = plan.issues.filter((i) => i.severity === 'blocker');
  if (blockers.length) throw new Error(`Refused: ${blockers.length} blocking problem(s) are still open — see the report`);
  const W = plan.writes;
  await dst.$transaction(
    async (tx) => {
      const bonusProduct = W.purchases.some((p) => p.productId === 'BONUS_PRODUCT')
        ? ((await tx.membershipProduct.findFirst({ where: { kind: 'PROMO', name: 'Klasa bonus', active: false } })) ??
          (await tx.membershipProduct.create({ data: { kind: 'PROMO', name: 'Klasa bonus', nameEn: 'Bonus classes', price: 0, classCredits: 0, validityDays: 60, active: false } })))
        : null;
      // Rows were shaped in planImport against these tables; Postgres checks every one on insert.
      const data = (rows: Record<string, unknown>[]) => rows as never;
      await tx.user.createMany({ data: data(W.users) });
      await tx.userProfile.createMany({ data: data(W.profiles) });
      await tx.notificationPreference.createMany({ data: data(W.prefs) });
      await tx.clientNote.createMany({ data: W.notes.map((n) => ({ ...n, authorId: opts.actorId, visibility: 'INTERNAL' })) });
      await tx.membershipProduct.createMany({ data: data(W.products) });
      await tx.offer.createMany({ data: data(W.offers) });
      await tx.offerProduct.createMany({ data: W.offerProducts });
      await tx.order.createMany({ data: data(W.orders) });
      await tx.payment.createMany({ data: data(W.payments) });
      await tx.membershipPurchase.createMany({ data: data(W.purchases.map((p) => (p.productId === 'BONUS_PRODUCT' ? { ...p, productId: bonusProduct!.id } : p))) });
      await tx.creditWallet.createMany({ data: data(W.wallets) });
      await tx.classBooking.createMany({ data: data(W.bookings) });
      await tx.classAttendance.createMany({ data: data(W.attendance.map((a) => ({ ...a, markedById: opts.actorId }))) });
      await tx.classWaitlist.createMany({ data: data(W.waitlist) });
      await tx.creditTransaction.createMany({ data: data(W.transactions) });
      await tx.offerClaim.createMany({ data: data(W.claims) });
      await tx.legacyRef.createMany({ data: W.refs });
      await tx.auditLog.create({ data: { actorId: opts.actorId, action: 'import.website', entityType: 'import', entityId: plan.summary.batch, data: plan.summary as object } });
    },
    { timeout: 10 * 60_000, maxWait: 30_000 },
  );
  return reconcile(dst, plan);
}

/** Read back from this database what each imported client has, next to what the website had. */
export async function reconcile(dst: PrismaClient, plan: Plan) {
  const today = new Date();
  const out = [];
  for (const r of plan.reconciliation) {
    const [wallets, owed, paid, upcoming] = await Promise.all([
      dst.creditWallet.findMany({ where: { userId: r.appId, expiresAt: { gt: today }, purchase: { status: 'ACTIVE' } }, select: { remaining: true, purchaseId: true } }),
      dst.order.aggregate({ where: { userId: r.appId, status: 'PENDING', bookingId: null }, _sum: { total: true } }),
      dst.payment.aggregate({ where: { order: { userId: r.appId }, status: 'COMPLETED', provider: 'website-import' }, _sum: { amount: true } }),
      dst.classBooking.count({ where: { userId: r.appId, status: 'BOOKED', session: { startsAt: { gt: today } } } }),
    ]);
    const imported = new Set((await dst.legacyRef.findMany({ where: { target: 'membership_purchases', targetId: { in: wallets.map((w) => w.purchaseId) } }, select: { targetId: true } })).map((x) => x.targetId));
    const app = {
      credits: wallets.filter((w) => imported.has(w.purchaseId)).reduce((s, w) => s + w.remaining, 0),
      owed: owed._sum.total ?? 0,
      paid: paid._sum.amount ?? 0,
      upcoming,
    };
    const ok = app.credits === r.credits && app.owed >= r.owed && app.paid === r.paid && app.upcoming >= r.upcoming;
    out.push({ ...r, app, ok });
  }
  return { ok: out.every((x) => x.ok), clients: out };
}
