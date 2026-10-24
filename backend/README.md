# DUA Pilates & SPA — API

The backend for the mobile app: Fastify 5 + TypeScript, PostgreSQL through
Prisma, passwordless email sign-in with codes delivered by Resend, a worker for
notifications, reminders and the waiting list. Hosted on Railway.

It is separate from the website's Vercel function in `../api` (the marketing site
and its older `/app` keep working untouched) and has its own database.

- **OpenAPI:** `GET /docs` (Swagger UI) and `/docs/json`. Every route is listed
  with its zod schema.
- **Health:** `GET /health` → `{"ok":true,"db":true}`; Railway uses it.

## Run it locally

Node 20+. No PostgreSQL install needed — `dev:db` runs a real one from npm.

    cd backend
    npm install
    cp .env.example .env            # the defaults work for local development
    npm run dev:db                  # terminal 1: Postgres on :5433 (leave it running)
    npx prisma migrate deploy       # terminal 2: create the tables
    npm run seed                    # dev accounts, classes, SPA, packages
    npm run dev                     # API on :4000 (all interfaces, so a phone on the Wi-Fi can reach it)

`npm run seed -- --fresh` wipes and reseeds. The seed refuses to run when
`APP_ENV=production`.

Without `RESEND_API_KEY`, nothing is emailed and each code is printed in the API
log instead (development only — production refuses to start without a key).

## Environment

| Variable | What it is |
|---|---|
| `APP_ENV` | `development` or `production`. Development enables `DEV_LOGIN_CODE` for `@dua.dev` accounts. |
| `DATABASE_URL` | Postgres. On Railway: `${{Postgres.DATABASE_URL}}`. |
| `JWT_SECRET`, `OTP_PEPPER` | Two different random strings, 32+ characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `RESEND_API_KEY` | From resend.com → API Keys. Required in production. |
| `MAIL_FROM` | `DUA Pilates & SPA <no-reply@dua-pilates.com>` — must be on a domain verified in Resend. |
| `DEV_LOGIN_CODE` | e.g. `000000`. Ignored unless `APP_ENV=development`, and only for `@dua.dev` emails. Leave empty in production. |
| `RUN_WORKER` | `true` (default): this process also runs the background jobs. `false`: run `npm run worker` as its own service. |
| `ACCESS_TOKEN_TTL_MIN`, `REFRESH_TOKEN_TTL_DAYS` | 15 and 30 by default. |
| `PAYMENT_PROVIDER` | `none`. Online payment is an interface waiting for a provider; see *Payments*. |
| `CORS_ORIGINS` | Only for browser clients. The native app does not need it. |

## Deploy on Railway

You need a Railway account and the CLI (`npm i -g @railway/cli`, then
`railway login` — the CLI on this machine is installed but logged out).

**One project, two environments.** Railway environments are full copies (their own
database, their own variables), which is what keeps test bookings away from real
clients.

1. **New project** → *Deploy from GitHub repo* → `ssaraberberi/Women-wellness-center`.
2. Open the new service → **Settings**:
   - *Root Directory*: `/backend`
   - *Config file*: `/backend/railway.json` (build: `npm ci --include=dev && npm run build`;
     pre-deploy: `prisma migrate deploy`; start: `npm start`; health check `/health`).
   - *Branch*: the branch you deploy from.
   - *Networking* → **Generate Domain**. That URL is the app's `EXPO_PUBLIC_API_URL`.
   - Rename the service `api`.
3. **+ New → Database → PostgreSQL** in the same project.
4. **api → Variables** (raw editor):

       APP_ENV=production
       NODE_ENV=production
       DATABASE_URL=${{Postgres.DATABASE_URL}}
       JWT_SECRET=<random>
       OTP_PEPPER=<another random>
       RESEND_API_KEY=re_...
       MAIL_FROM=DUA Pilates & SPA <no-reply@dua-pilates.com>
       RUN_WORKER=true

5. Deploy. `https://<domain>/health` should answer `{"ok":true,"db":true}`.
6. **Environments → New environment → `development`** (duplicate of production).
   In *development*, change: `APP_ENV=development`, `DEV_LOGIN_CODE=000000`, new
   `JWT_SECRET` / `OTP_PEPPER`, and generate a separate domain. It gets its own
   Postgres automatically.
7. **Seed the development database** from your computer. Railway's internal
   `DATABASE_URL` is not reachable from outside, so use the database's public URL
   (Postgres service → *Connect* → *Public network*):

       cd backend
       DATABASE_URL="<public url of the development Postgres>" APP_ENV=development npm run seed

   (PowerShell: `$env:DATABASE_URL="…"; $env:APP_ENV="development"; npm run seed`.)

   **Never seed production.** The first real administrator there is created by
   hand — see *The first owner* below.

8. Put the *development* domain in `mobile/.env` and in `mobile/eas.json`
   (`development` / `preview`), the *production* domain in `eas.json` → `production`.

**Separate worker (optional).** With more traffic, add a second service from the
same repo with root `/backend`, start command `npm run worker`, the same
variables, and set `RUN_WORKER=false` on `api`. All jobs are safe to run twice, so
the overlap during a deploy is harmless.

**Backups.** Enable backups on the Postgres service (*Backups* tab, available on
paid plans) and keep a scheduled `pg_dump`: `pg_dump "$DATABASE_PUBLIC_URL" -Fc > dua-$(date +%F).dump`.
Restore with `pg_restore --clean -d "$DATABASE_URL" dua-….dump`. Migrations only
ever move forward (`prisma migrate deploy`), never reset.

**Logs and errors.** Logs are structured JSON (pino) in Railway's log view, with
`authorization`, refresh tokens and codes redacted. Every 5xx is logged with its
stack. An external error tracker (Sentry or similar) is *not* wired in yet.

### The first owner

Nobody can register as staff or admin from the app — public sign-up always makes a
client. On a new production database, sign up in the app with the owner's email
first (she becomes a client), then promote that one account once:

    railway connect Postgres        # opens psql on the production database
    update users set role = 'ADMIN', is_owner = true where email = 'owner@example.com';

She signs out and in again; from then on, everyone else is invited from the app
(Staff → Invite). Only owners can add admins.

## Resend

1. resend.com → *Domains* → add `dua-pilates.com` (or a subdomain such as
   `mail.dua-pilates.com`) and add the DNS records it shows in Cloudflare (proxy off).
2. *API Keys* → create one with sending access → `RESEND_API_KEY` on Railway.
3. `MAIL_FROM` must use the verified domain, or every send is refused.

Sign-in codes are sent directly (the request waits for Resend and says so if it
fails). Every other email — booking confirmations, cancellations, SPA, package
activation, expiry reminders, waiting-list offers, staff invitations — is a row in
`notifications`, delivered by the worker with retries (1, 5, 15, 60, 240 minutes)
and never sent twice for the same event.

## What the API guarantees

- **Overbooking cannot happen.** Booking locks the class row (`select … for
  update`), recounts bookings plus held waiting-list places, spends the credit and
  writes the booking in one transaction. A partial unique index allows one live
  booking per client per class. Tested: eight clients at once for five places →
  five bookings, three "full", nobody charged twice.
- **Retries are safe.** `Idempotency-Key` on bookings, SPA appointments and
  orders; the app sends one per tap. Credit transactions have unique keys too.
- **Credits are a ledger.** `credit_transactions` explains every change of
  `credit_wallets.remaining`, which cannot go below zero (CHECK constraint).
  Credits are spent at booking, from the package that expires first. Expired
  packages cannot pay.
- **Purchases keep their terms.** Price, credits, validity and wording are copied
  onto the purchase when it is made; editing the package later changes nothing bought.
- **SPA has no double-booking.** All SPA scheduling decisions run under one
  advisory lock; availability accounts for working hours, breaks, qualifications,
  treatment length + buffer, rooms, blocks, approved time off and closed days.
- **Nothing is paid without a payment.** An order becomes paid only by an admin
  recording it (method and person stored in `payments` and `audit_logs`) or by a
  verified provider webhook.
- **Auth.** 6-digit codes from a CSPRNG, stored only as an HMAC, valid 10 minutes,
  5 guesses, 3 requests per address per 15 minutes and 20 per IP per hour. Access
  tokens are 15-minute JWTs; refresh tokens are random, stored as SHA-256, rotated on
  every use, and reusing an old one revokes the whole sign-in. A disabled account is
  refused on its next request. The same answer is given for known and unknown emails.
- **Times.** Stored in UTC, every "which day / what time" computed in
  `Europe/Tirane` with luxon, so daylight-saving changes are handled.

## Payments

`src/services/orders.ts` defines a `PaymentProvider` interface (create checkout,
verify webhook) and `POST /payments/webhook/:provider`. With `PAYMENT_PROVIDER=none`
(the default) there is no online payment: clients reserve a package in the app and
pay at the studio, where an admin records it and the package activates. Adding a
provider means one adapter that verifies its signature and calls
`completeOnlinePayment` — no other code path can mark an order paid.

## Tests

    npm run dev:db        # if not already running
    npm test              # vitest, against the dua_test database (wiped per file)

27 integration tests through the real HTTP layer and a real Postgres: registration
and OTP (hashing, expiry, lockout, rate limit, reuse), refresh rotation and reuse
detection, role access, owner-only admin invites, concurrent booking, idempotent
retries, credit refusal (none / expired / insufficient), cancellation policies and
desk restores, studio cancellations, the waiting list (offer, hold, expiry, accept),
SPA availability (hours, breaks, buffers, rooms, closures) and racing SPA bookings,
payment recording, price snapshots, promotions, trials, combo entitlements, and
staff attendance permissions.

`npx tsx scripts/smoke.ts [url]` walks the main journeys against a running API with
the dev accounts (34 checks) — useful right after a Railway deploy of the
development environment.

## Layout

    prisma/schema.prisma         the data model (38 tables)
    prisma/migrations/           SQL migrations; hand-written constraints at the end of init
    prisma/seed.ts               development data
    src/app.ts                   Fastify: security headers, rate limit, OpenAPI, errors, routes
    src/routes/                  auth · me · client · staff · admin-ops · admin-people · admin-commerce
    src/services/                auth, tokens, booking + waitlist, credits, spa, orders, schedule, notify, mail, analytics
    src/jobs.ts                  worker: deliveries, waitlist expiry, reminders, schedule generation, housekeeping
    test/                        vitest integration tests
    scripts/                     dev-db (embedded Postgres), smoke test
