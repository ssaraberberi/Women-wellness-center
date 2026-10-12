/* ============================================================
   DUA — the schema, and the app's own job of applying it
   ------------------------------------------------------------
   This used to be a file somebody had to remember to paste into the
   database. They did not, once, and sign-in returned 500 to everybody
   for as long as it took to notice — the throttle wrote to a table that
   was not there yet.

   So the schema lives here, as the string the app itself applies. Every
   statement is `if not exists`, the whole thing runs inside one
   transaction, and VERSION is bumped whenever this text changes: an
   instance checks the version once, applies the schema if the database
   is behind, and never looks again. A deploy cannot now arrive ahead of
   its own tables.
   ============================================================ */

/* Bump on every change to SCHEMA below. */
export const VERSION = '2026-10-12c';

export const SCHEMA = `
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  role          text not null check (role in ('admin', 'instructor', 'client')),
  name          text not null,
  email         text not null,
  phone         text,
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
-- Added after the first release, so it has to be able to arrive late.
alter table users add column if not exists email_verified boolean not null default false;
-- What an employee does. The role stays 'instructor' for everyone on the
-- staff side — it is what signs them in to the staff dashboard — and this
-- says which kind they are: an instructor, or a body therapist /
-- physiotherapist. Null only for admins and clients.
alter table users add column if not exists job text
  check (job is null or job in ('instructor', 'therapist'));
update users set job = 'instructor' where role = 'instructor' and job is null;
-- Email identifies an account, and case is not part of the identity.
create unique index if not exists users_email_key on users (lower(email));

create table if not exists class_types (
  id         text primary key,
  name       text not null,
  short_name text not null,
  sort       int  not null default 0
);

create table if not exists plans (
  id        text primary key,
  name      text not null,
  price_all int  not null check (price_all >= 0),
  blurb     text,
  featured  boolean not null default false,
  sort      int not null default 0,
  archived  boolean not null default false
);

-- "how many of these class types, per period". limit_count null = unlimited.
create table if not exists plan_allowances (
  id             bigserial primary key,
  plan_id        text not null references plans(id) on delete cascade,
  class_type_ids text[] not null check (cardinality(class_type_ids) > 0),
  limit_count    int check (limit_count is null or limit_count > 0),
  period         text not null check (period in ('week', 'month')),
  sort           int not null default 0
);
create index if not exists plan_allowances_plan on plan_allowances (plan_id);
-- What the website card says, beyond the name and the price. Added after
-- the first release, so they have to be able to arrive late. The _en
-- columns are optional: the site falls back to the other text when one is
-- blank, so a studio that writes in Albanian only is not writing twice.
alter table plans add column if not exists tagline    text;
alter table plans add column if not exists rhythm     text;
alter table plans add column if not exists tagline_en text;
alter table plans add column if not exists rhythm_en  text;
alter table plans add column if not exists blurb_en   text;

create table if not exists instructor_qualifications (
  instructor_id uuid not null references users(id) on delete cascade,
  class_type_id text not null references class_types(id) on delete cascade,
  primary key (instructor_id, class_type_id)
);

create table if not exists instructor_availability (
  id            bigserial primary key,
  instructor_id uuid not null references users(id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),  -- 0 = Sunday
  starts        time not null,
  ends          time not null,
  check (starts < ends)
);
create index if not exists instructor_availability_who on instructor_availability (instructor_id);

create table if not exists classes (
  id            uuid primary key default gen_random_uuid(),
  class_type_id text not null references class_types(id),
  on_date       date not null,
  starts        time not null,
  ends          time not null,
  capacity      int  not null check (capacity > 0),
  instructor_id uuid references users(id) on delete set null,
  cancelled     boolean not null default false,
  created_at    timestamptz not null default now(),
  check (starts < ends)
);
create index if not exists classes_on_date on classes (on_date);
create index if not exists classes_instructor on classes (instructor_id, on_date);

create table if not exists memberships (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references users(id) on delete cascade,
  plan_id    text not null references plans(id),
  starts_on  date not null,
  ends_on    date not null,
  -- The studio links a membership to a client once she has paid at the desk,
  -- and it is active from that moment. 'requested' belonged to an older flow
  -- where the client applied in the app; it is still allowed so that rows
  -- from then remain valid, and nothing writes it any more.
  status     text not null check (status in ('requested', 'active', 'cancelled', 'replaced')),
  created_at timestamptz not null default now(),
  check (starts_on <= ends_on)
);
-- A client holds at most one active membership; the rest are history.
create unique index if not exists memberships_one_active
  on memberships (client_id) where status = 'active';
-- Applications from the old flow are closed: there is no queue to answer
-- them from any more, and the studio links memberships directly instead.
update memberships set status = 'cancelled' where status = 'requested';
drop index if exists memberships_one_requested;

create table if not exists bookings (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id) on delete cascade,
  client_id  uuid not null references users(id) on delete cascade,
  status     text not null check (status in ('booked', 'waitlist', 'cancelled', 'late', 'released')),
  created_at timestamptz not null default now()
);
-- One live place per class per client. Cancelled rows stay as history,
-- so this is a partial index rather than a plain unique constraint.
create unique index if not exists bookings_one_live
  on bookings (class_id, client_id) where status in ('booked', 'waitlist');
create index if not exists bookings_class on bookings (class_id);
create index if not exists bookings_client on bookings (client_id);

create table if not exists notices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  text       text not null,
  tone       text not null default 'info' check (tone in ('info', 'good', 'warn', 'bad')),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notices_user on notices (user_id, read);

-- Sign-in tokens. Opaque, hashed at rest, and swept on expiry.
create table if not exists auth_tokens (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_tokens_user on auth_tokens (user_id);

-- One-time links sent by email: a password reset, or confirming that an
-- address is really hers. The token is never stored, only its digest, so
-- a copy of this table opens nothing. Single use, and short-lived.
create table if not exists auth_codes (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null check (kind in ('reset', 'verify')),
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_codes_user on auth_codes (user_id, kind);

-- Requests for one of those links, counted so an inbox cannot be used as
-- a weapon and an address cannot be probed at speed.
create table if not exists auth_code_requests (
  id    bigserial primary key,
  email text not null,
  ip    text,
  at    timestamptz not null default now()
);
create index if not exists auth_code_requests_email on auth_code_requests (lower(email), at desc);
create index if not exists auth_code_requests_ip on auth_code_requests (ip, at desc);

-- Failed sign-ins, so a password cannot be guessed at machine speed.
-- Rows older than the window are deleted as they are counted, which is
-- why this needs no sweeper of its own.
create table if not exists signin_failures (
  id         bigserial primary key,
  email      text not null,
  ip         text,
  at         timestamptz not null default now()
);
create index if not exists signin_failures_email on signin_failures (lower(email), at desc);
create index if not exists signin_failures_ip on signin_failures (ip, at desc);

-- Settings that must not live in client code. The admin registration
-- code is one row here, read only by the server.
create table if not exists settings (
  key   text primary key,
  value text not null
);

-- ================================================================
-- Booking: reservations without a password, class credits, a weekly
-- schedule with date-specific overrides, and offers.
-- ================================================================

-- The studio's own rules, editable from Settings. Only ever inserted, so a
-- value the studio has changed is never put back.
insert into settings (key, value) values
  ('opening_date', '2026-11-02'),
  ('cancel_window_min', '30'),
  ('booking_horizon_days', '35'),
  ('default_capacity', '5')
on conflict (key) do nothing;

-- A customer can reserve with a name and a phone number and nothing else,
-- so an account may have no email and no usable password. The phone is
-- kept a second time as a normalised key, which is how the same person is
-- recognised the next time she books.
alter table users alter column email drop not null;
alter table users add column if not exists phone_key text;
update users set phone_key = nullif(
  regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'),
    '^00', ''), '^355', ''), '^0', ''), '')
  where phone_key is null and phone is not null;
create index if not exists users_phone_key on users (phone_key) where role = 'client';

-- What a package is, how long it lasts once bought, and whether it is
-- offered on the booking page.
alter table plans add column if not exists kind text not null default 'membership';
alter table plans add column if not exists validity_days int not null default 30;
alter table plans add column if not exists bookable boolean not null default true;

-- ---------- the weekly schedule ----------
-- A template is a week of time slots that applies from its date until the
-- next template takes over. Classes are generated from it ahead of time;
-- a class edited for one date is pinned, and the template never touches a
-- pinned class again.
create table if not exists schedule_templates (
  id             bigserial primary key,
  effective_from date not null unique,
  created_at     timestamptz not null default now()
);
create table if not exists template_slots (
  id            bigserial primary key,
  template_id   bigint not null references schedule_templates(id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),   -- 0 = Sunday
  starts        time not null,
  ends          time not null,
  capacity      int  not null check (capacity > 0),
  class_type_id text not null references class_types(id),
  instructor_id uuid references users(id) on delete set null,
  check (starts < ends)
);
create index if not exists template_slots_template on template_slots (template_id);

-- Days the studio is closed. Every class that day is cancelled, and comes
-- back if the day is reopened.
create table if not exists closures (
  on_date    date primary key,
  reason     text,
  created_at timestamptz not null default now()
);

alter table classes add column if not exists slot_id bigint references template_slots(id) on delete set null;
alter table classes add column if not exists pinned boolean not null default false;
alter table classes add column if not exists blocked int not null default 0;
alter table classes add column if not exists cancel_reason text;
create unique index if not exists classes_slot_date on classes (slot_id, on_date) where slot_id is not null;

-- ---------- offers ----------
-- bundle:   its own classes and price (DUA DUO)
-- discount: a percentage off an eligible package (FOUNDING GIRLS)
-- bonus:    bonus classes once a condition is met (BRING A BESTIE)
create table if not exists offers (
  id                 text primary key,
  title              text not null,
  description        text,
  kind               text not null check (kind in ('bundle', 'discount', 'bonus')),
  price_all          int check (price_all is null or price_all >= 0),
  original_all       int check (original_all is null or original_all >= 0),
  discount_pct       int check (discount_pct is null or discount_pct between 0 and 100),
  lines              jsonb not null default '[]',
  validity_days      int not null default 30 check (validity_days > 0),
  starts_on          date,
  ends_on            date,
  max_redemptions    int check (max_redemptions is null or max_redemptions > 0),
  new_customers_only boolean not null default false,
  eligible_plans     text[] not null default '{}',
  persons            int not null default 1 check (persons in (1, 2)),
  together           boolean not null default true,
  friend_required    boolean not null default false,
  friend_new         boolean not null default true,
  bonus_classes      int not null default 0 check (bonus_classes >= 0),
  bonus_to           text not null default 'both' check (bonus_to in ('referrer', 'friend', 'both')),
  bonus_when         text not null default 'friend_paid' check (bonus_when in ('booked', 'paid', 'friend_paid', 'visit')),
  eligibility        text,
  active             boolean not null default false,
  archived           boolean not null default false,
  sort               int not null default 0,
  created_at         timestamptz not null default now()
);

-- Offers are written in Albanian, with an optional English version, the way
-- packages are: the page shows the reader's language, or the other one.
alter table offers add column if not exists description_en text;
alter table offers add column if not exists eligibility_en text;

-- ---------- reservations ----------
-- What a customer asked for, with the price and the terms as they were at
-- that moment: a package renamed or repriced later changes nothing here.
-- Status and payment are separate, and nothing marks a reservation paid
-- except the studio.
create table if not exists reservations (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,
  manage_hash    text unique,
  status         text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  payment        text not null default 'unpaid' check (payment in ('unpaid', 'paid')),
  source         text not null default 'web' check (source in ('web', 'admin', 'app')),
  plan_id        text references plans(id),
  offer_id       text references offers(id),
  title          text not null,
  unit_price     int,
  original_price int,
  discount_pct   int,
  persons        int not null default 1,
  total_price    int,
  terms          jsonb not null default '{}',
  notes          text,
  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists reservations_created on reservations (created_at desc);

-- A package a customer holds: the credits it carries are a snapshot of the
-- package or offer at the moment it was bought. A customer may hold
-- several at once, so the one-active rule goes.
alter table memberships alter column plan_id drop not null;
alter table memberships add column if not exists offer_id text references offers(id);
alter table memberships add column if not exists reservation_id uuid references reservations(id) on delete set null;
alter table memberships add column if not exists title text;
alter table memberships add column if not exists lines jsonb;
drop index if exists memberships_one_active;
update memberships m set title = p.name from plans p where p.id = m.plan_id and m.title is null;
update memberships m set lines = coalesce((
    select jsonb_agg(jsonb_build_object('types', a.class_type_ids, 'total', a.limit_count) order by a.sort)
      from plan_allowances a where a.plan_id = m.plan_id), '[]'::jsonb)
  where m.lines is null;
create index if not exists memberships_client on memberships (client_id);
create index if not exists memberships_reservation on memberships (reservation_id);

-- Credits added or taken away by hand, and bonus classes: a ledger, so the
-- balance can always be explained.
create table if not exists credit_events (
  id            bigserial primary key,
  membership_id uuid not null references memberships(id) on delete cascade,
  line          int not null default 0,
  delta         int not null,
  reason        text not null,
  by_user       uuid references users(id) on delete set null,
  at            timestamptz not null default now()
);
create index if not exists credit_events_membership on credit_events (membership_id);

-- Which package a booking spends, which reservation it belongs to, and
-- whether she came.
alter table bookings add column if not exists membership_id uuid references memberships(id) on delete set null;
alter table bookings add column if not exists reservation_id uuid references reservations(id) on delete set null;
alter table bookings add column if not exists attendance text check (attendance is null or attendance in ('attended', 'noshow'));
create index if not exists bookings_membership on bookings (membership_id);
create index if not exists bookings_reservation on bookings (reservation_id);
update bookings b set membership_id = (
    select m.id from memberships m join classes k on k.id = b.class_id
     where m.client_id = b.client_id and m.status = 'active'
       and k.on_date between m.starts_on and m.ends_on
     order by m.ends_on limit 1)
  where b.membership_id is null and b.status in ('booked', 'late');

-- Who has used an offer. One claim per customer per offer, held by the
-- index rather than by the form.
create table if not exists offer_claims (
  id             bigserial primary key,
  offer_id       text not null references offers(id),
  client_id      uuid not null references users(id) on delete cascade,
  reservation_id uuid references reservations(id) on delete cascade,
  role           text not null default 'buyer' check (role in ('buyer', 'friend')),
  status         text not null default 'claimed' check (status in ('claimed', 'pending', 'granted', 'void')),
  granted_at     timestamptz,
  created_at     timestamptz not null default now()
);
create unique index if not exists offer_claims_once on offer_claims (offer_id, client_id, role) where status <> 'void';
create index if not exists offer_claims_offer on offer_claims (offer_id);

-- Requests from the public booking page, counted so it cannot be used to
-- flood the timetable.
create table if not exists rate_events (
  kind text not null,
  key  text not null,
  at   timestamptz not null default now()
);
create index if not exists rate_events_key on rate_events (kind, key, at desc);
`;

/* ---------- applying it ----------
   Once per instance, not once per request: the promise is kept, so
   everything after the first caller waits on the same work and then
   stops asking. A database already at this version costs one cheap
   select for the life of the instance.

   settings is created by the schema itself, so the version cannot be
   read before there is anywhere to keep it — a missing table means
   "apply", which is exactly right for an empty database. */
let applied = null;

export function ensureSchema(pool) {
  if (!applied) applied = apply(pool).catch(function (e) { applied = null; throw e; });
  return applied;
}

async function apply(pool) {
  const client = await pool.connect();
  try {
    const at = await client.query(
      `select value from settings where key = 'schema_version'`
    ).then(r => r.rows[0] && r.rows[0].value, () => null);
    if (at === VERSION) return;

    await client.query('begin');
    await client.query(SCHEMA);
    await client.query(
      `insert into settings (key, value) values ('schema_version', $1)
       on conflict (key) do update set value = excluded.value`, [VERSION]);
    await client.query('commit');
    console.log('schema applied: ' + VERSION + (at ? ' (was ' + at + ')' : ' (new database)'));
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
