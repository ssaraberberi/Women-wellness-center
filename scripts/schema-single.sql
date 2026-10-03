-- ============================================================
-- DUA — the schema, as ONE statement.
--
-- Same contents as schema.sql, wrapped in a DO block so it
-- survives a client that allows a single command per request — the
-- Vercel storage query box, Neon's HTTP driver, anything that sends
-- SQL as a prepared statement. If your editor runs several statements
-- happily, use schema.sql instead; it reads better.
--
-- Run this first. Running it again changes nothing.
-- ============================================================

do $$
begin
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
    status     text not null check (status in ('active', 'cancelled', 'replaced')),
    created_at timestamptz not null default now(),
    check (starts_on <= ends_on)
  );
  -- A client holds at most one active membership; the rest are history.
  create unique index if not exists memberships_one_active
    on memberships (client_id) where status = 'active';

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

  -- Settings that must not live in client code. The admin registration
  -- code is one row here, read only by the server.
  create table if not exists settings (
    key   text primary key,
    value text not null
  );
end $$;
