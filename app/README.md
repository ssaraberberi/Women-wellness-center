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

### The schema applies itself

`api/_lib/schema.js` holds the schema and a version. An instance checks the
version once, applies the schema if the database is behind, and never asks
again. There is no file to remember to paste and no deploy that can arrive
ahead of its own tables — which is a lesson rather than a design: a release
once landed before `signin_failures` existed and every sign-in, right
password included, answered 500 until somebody noticed.

Bump `VERSION` whenever the SQL changes. Everything in it is `if not exists`,
and the whole thing runs in one transaction.

The throttle that broke it is now best-effort for the same reason: if its
table cannot be read or written, it says so in the log and lets the attempt
through. A control that protects sign-in must not be able to stop it.

### Filling the database

`scripts/data.sql` is the half that stays yours: the administrator
registration code, the class types and the packages. Paste it into the Neon
SQL editor, or run `npm run migrate`, which applies the schema and then this.

It is an upsert, so running it again rewrites those rows and touches nothing
else — changing a price is editing the number and running it again, on a live
database, with every account, class and booking left alone.

`npm run seed:demo` is separate and optional: four instructors, a month of
timetable, clients mid-membership. Every account it creates shares one
password, so never give it a database real people sign in to. `npm run reset`
wipes and re-runs it. `npm run check` says what is in there.

Demo accounts, all with the password from `SEED_PASSWORD` (default `demo1234`):

| Role | Email | What to look at |
|---|---|---|
| Administrator | `admin@dua-pilates.com` | dashboard, schedule, instructor assignment |
| Instructor | `elira@dua-pilates.com` | her classes, qualifications, availability |
| Client | `sara@example.com` | Signature membership, booking, cancelling |
| Client | `enke@example.com` | Essential — shows what a plan does *not* include |

The administrator registration code is never sent to the browser. It lives in
the `settings` table, put there by `scripts/data.sql`, and is compared on the
server. It is not an environment variable and never was one worth being:
change the line at the top of `data.sql`, run the file, and the new code is
live without a deploy.

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
2. **No environment variables to add.** `DATABASE_URL` comes from the
   integration and `NODE_ENV` from Vercel. Do not add `PORT`. The admin
   registration code is not a variable — it lives in `scripts/data.sql`.
3. **Fill the database**, once. Open the Neon SQL Editor from Vercel's
   Storage tab and paste in `scripts/schema.sql`, then `scripts/data.sql`.
   Change the registration code at the top of `data.sql` first.

   With a checkout and the connection string to hand, the same thing is:

       DATABASE_URL="<the pooled URL>" npm run migrate

4. Deploy. Check `/healthz` — `{"ok":true}` means the function reached
   Postgres.
5. Open `/app`, choose **Register**, enter the code you set in `data.sql`.
   That is the first administrator, and nothing else creates one.

Nothing in the deployment touches the database. No build step, no migration on
start — the function connects and reads. Filling it is a thing you do once, by
hand, and changing what is in it is the same two files run again.

## Packages, and whether the website prices them

**Packages** in the admin is the whole of it: add one, edit it, retire it.
Each package carries lines saying what it allows — which class types, how
many, per week or per month — and the form replaces them whole, so deleting a
line deletes the allowance. Retiring never deletes: a membership someone
already bought still names the package, and the history has to keep saying
what they bought, so it is archived and stops being offered.

Above that table is the switch the public site reads. With it off,
dua-pilates.com lists every package and what it includes and says the price
comes at opening; the app always shows them. `scripts/data.sql` sets it off
to begin with, with `do nothing`, so re-running the file never flips it back.

Off is the default in the stylesheet, not in the script. A reader with no
JavaScript, an API that is down, a slow or unexpected answer — every one of
those leaves the prices in. The only path that shows a price is the one where
the studio said to.

## Memberships are applied for, not bought

A client picks a package in the app and **applies**. Nothing is charged there
and nothing is booked: the row is written with status `requested`, and
`membershipOf` in `shared/rules.js` leaves those out on purpose, so every rule
that reads a membership agrees she does not have one yet. Trying to book
answers "Waiting for the studio to confirm your package".

She pays at the studio. An administrator sees the queue at the top of
**Memberships**, confirms it, and that is the step that makes it real: status
`active`, thirty days counted **from the day it is confirmed**, not from the
day she asked. Whatever she held before is marked `replaced`. Both sides get a
notice — the studio when she applies, the client when it is confirmed or
closed.

One open application per client, held by a partial unique index rather than by
the interface, so a second tap cannot queue a second. Confirming twice answers
that the request is not waiting any more.

The screens say all of this in their own words: three numbered steps in the
client's dialog before she applies, and the line in the studio's queue that
matters most — confirm only once she has paid, because nothing else checks.

## Albanian and English

`app/js/i18n.js` holds the dictionary; `el()` in `ui.js` sends every `text`
and every `aria-label`, `placeholder` and `title` through `t()` on the way
into the DOM. A view writes English and the reader's language comes out. A
string with no entry comes through unchanged, which is how a name, a number
or a line nobody has translated yet survives rather than breaking.

Sentences with a value in them use `t('Apply for %s', name)` — never
concatenation around `t()`, because word order is not the same in both.
A translation may reorder with `%1 %2 %3`: the date is built that way, since
Albanian puts the day before the month.

Switching language re-renders every screen from the same state rather than
translating in place, so there is no half-English screen to get stuck in. The
choice is kept in `localStorage` and the pair of words sits in the sidebar and
on the sign-in screen, both always visible.

Albanian is the default, as it is on the website.

Two kinds of string live outside the views and are translated the same way:
the package blurbs, which are written in `scripts/data.sql`, and the notices
the server composes. Change one there and add its pair to the dictionary.

## What protects an account

- **Guessing is rate limited.** Failed sign-ins are counted per address and
  per caller over a rolling fifteen minutes, in `signin_failures`. Eight wrong
  guesses at one address, or twenty from one caller, and the answer is 429 for
  both — the right password included. A success clears that address. Both
  limits are needed: one address attacked from everywhere and one caller
  working through a list are the same attack from two sides.
- **A wrong address costs the same as a right one.** Signing in with an
  address that has no account used to return at once while a real one took the
  time scrypt takes, which told anyone with a stopwatch which addresses exist.
  It now burns the same work on a throwaway hash; measured, the difference is
  single-digit milliseconds against scrypt's fifty.
- **Writes must come from here.** Any non-GET request whose `Origin` is not
  this host is refused before it reaches a handler, behind the
  `SameSite=Lax` cookie rather than instead of it.
- **Headers.** `vercel.json` sends a content security policy that keeps
  scripts, styles, images, fonts and connections to this origin, plus
  `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `base-uri 'none'` and a
  permissions policy switching off camera, microphone, location and payment.
- Passwords are scrypt with a per-password salt; sessions are opaque random
  tokens stored as SHA-256 digests, in `HttpOnly` cookies marked `Secure` in
  production. A copy of the table is not a copy of anyone's session.

Still missing, and worth knowing: there is no password reset. If the
administrator forgets hers, the way back is SQL.

## Still to do before real money changes hands

Payment happens at the studio and an administrator records it by confirming
the application. Wiring a processor would mean a webhook confirming the same
row, so the shape of this is already the shape it needs. Notices are in-app; email or SMS would be a sender behind the
same `notices` table.
