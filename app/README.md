# DUA — studio platform

The booking system: administrator, instructor and client, on Postgres.
The browser talks to an API; nothing is decided in the browser.

## Running it locally

    cp .env.example .env          # fill in DATABASE_URL
    npm install
    npm run migrate               # create the schema
    npm run reset                 # wipe and fill with demo data
    npm start                     # http://localhost:3000/app/

`npm run check` says whether the database is reachable, migrated and seeded.

### The three seed commands

`migrate` only builds tables. An empty database has no admin registration
code, no class types and no plans, so nobody can sign in and the app has
nothing to show. One of these fills that gap:

| | What it writes | Where it belongs |
|---|---|---|
| `npm run seed` | the admin code, the class types, the plans — **no accounts** | the real studio. Safe to re-run; it leaves people alone |
| `npm run seed:demo` | the same, plus the demo studio | a database only you sign in to |
| `npm run reset` | wipes everything first, then `seed:demo` | starting the demo over |

`seed:demo` and `reset` give every account they create one published
password. Never point them at a database real clients use.

Demo accounts, all with the password from `SEED_PASSWORD` (default `demo1234`):

| Role | Email | What to look at |
|---|---|---|
| Administrator | `admin@dua-pilates.com` | dashboard, schedule, instructor assignment |
| Instructor | `elira@dua-pilates.com` | her classes, qualifications, availability |
| Client | `sara@example.com` | Signature membership, booking, cancelling |
| Client | `enke@example.com` | Essential — shows what a plan does *not* include |

The administrator registration code is never sent to the browser. It lives in
the `settings` table, put there by the seed from `ADMIN_REGISTRATION_CODE`, and
is compared on the server. Change it before going live — and note that the
server reads the table, not the variable: changing `ADMIN_REGISTRATION_CODE`
in Railway does nothing until `npm run seed` runs again and rewrites the row.

## Shape

    shared/domain.js       dates and periods, used by both sides
    shared/rules.js        every decision, and the only copy of it
    server/migrations/     schema, applied in order, once each
    server/scripts/        migrate · seed · check
    server/src/db.js       pool, and the transaction helper
    server/src/auth.js     scrypt passwords, hashed session tokens
    server/src/load.js     rows → the object the rules expect
    server/src/api.js      the endpoints
    server/src/index.js    http, routing, static files
    app/                   the browser app

**One copy of the rules.** `shared/rules.js` is imported by the browser so the
interface can answer instantly, and by the server, which reaches the same
verdict again before it writes. The client's answer is a prediction; the
server's is the decision. That is why a booking the server refuses can never
look taken.

**Capacity is settled in the database.** Booking locks the class row, recounts
under the lock, and re-checks the membership allowance there too. Six requests
for one seat return one `ok` and five `Class is full` — tested, not assumed.
A partial unique index on `(class_id, client_id)` for live bookings means a
double-click cannot produce two places even if the lock is somehow bypassed.

**Nothing trusts the client.** Roles are checked per endpoint, passwords are
scrypt with a per-user salt, session tokens are random and stored only as a
SHA-256 digest, and the sign-in cookie is `HttpOnly` (`Secure` in production).
A wrong password and an unknown email return the same message, so the form
cannot be used to find out who has an account.

## Deploying to Railway

1. **New Project → Deploy from GitHub repo**, pick this repository and the
   branch you want.
2. **+ New → Database → Add PostgreSQL** in the same project.
3. In the app service, **Variables**:

       DATABASE_URL            ${{ Postgres.DATABASE_URL }}
       ADMIN_REGISTRATION_CODE <choose one>
       NODE_ENV                production

   Use the variable reference for `DATABASE_URL`, not a pasted string, so it
   follows the database if it moves. `PORT` is injected; do not set it.
4. `railway.json` already asks for `npm run migrate` before each deploy and
   `/healthz` as the health check, so the schema is applied on every release.
5. First deploy only. From this repo, with the Railway CLI linked to the
   project (`npm i -g @railway/cli`, `railway login`, `railway link`):

       railway run npm run seed

   That writes the admin registration code, the class types and the plans,
   and creates no accounts. Then open `/app`, choose **Register**, enter the
   code from step 3, and the first administrator is yours.

   `railway run npm run seed:demo` instead if this database is only for you
   to click around in — it adds the demo studio, whose every account shares
   one published password.
6. **Settings → Networking → Generate Domain**, or point a subdomain such as
   `app.dua-pilates.com` at it. The marketing site stays on Vercel; this
   service serves only `/app`, `/shared` and `/assets`, and redirects `/`
   to the app.

## Still to do before real money changes hands

Checkout records a membership without taking a card. Wiring a processor means
a webhook that creates the membership on payment, rather than the browser
asking for one. Notices are in-app; email or SMS would be a sender behind the
same `notices` table.
