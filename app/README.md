# DUA — studio platform

The booking system: administrator, instructor and client, on Postgres.
The browser talks to an API; nothing is decided in the browser.

It deploys to Vercel as static files plus one function. `api/index.js` is
that function — the routing table and the plumbing — and `api/_lib/` holds
everything it calls. The underscore is how Vercel is told those files are
not routes of their own. `npm start` runs `server/local.js`, which serves the
files and hands `/api` to the same function, so the thing you test is the
thing that ships.

## Running it locally

    cp .env.example .env          # fill in DATABASE_URL
    npm install
    npm run migrate               # create the schema
    npm run reset                 # wipe and fill with demo data
    npm start                     # http://localhost:3000/app/ (site at /)

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

## Deploying to Vercel

The marketing site and the platform are one deployment: the site at the root,
the app at `/app`, and the whole API as a single function at `/api`. There is
no server process — `vercel.json` rewrites `/api/*` and `/healthz` into
`api/index.js`, which carries the routing table.

1. **Storage → Create Database → Neon (Postgres)**, in the Vercel dashboard,
   connected to this project. Vercel injects `DATABASE_URL` itself. Pick the
   **pooled** connection string if asked: a function is one request at a time,
   and an unpooled one will run the database out of connections.
2. **Settings → Environment Variables**, for Production:

       ADMIN_REGISTRATION_CODE  <choose one>

   `NODE_ENV` is set by Vercel, and `DATABASE_URL` by the integration.
   Do not add `PORT`.
3. **Prepare the database**, once, from a checkout. The scripts are not part
   of the deployment, so they run from here:

       vercel env pull .env.local      # or paste the Neon URL into .env
       DATABASE_URL="<the pooled URL>" npm run migrate
       DATABASE_URL="<the pooled URL>" npm run seed

   `seed` writes the admin code, the class types and the plans, and creates
   no accounts. Re-run it any time; it leaves people alone.
4. Deploy. Check `/healthz` — `{"ok":true}` means the function reached
   Postgres.
5. Open `/app`, choose **Register**, enter the code from step 2. That is the
   first administrator, and nothing else creates one.

Changing `ADMIN_REGISTRATION_CODE` later is a variable change plus a re-run of
`npm run seed`: the server reads the code from the `settings` table, not from
the environment.

If this database is only for you to click around in, `npm run seed:demo` adds
the demo studio, whose every account shares one published password.

## Still to do before real money changes hands

Checkout records a membership without taking a card. Wiring a processor means
a webhook that creates the membership on payment, rather than the browser
asking for one. Notices are in-app; email or SMS would be a sender behind the
same `notices` table.
