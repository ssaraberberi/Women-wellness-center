# DUA — studio platform

The booking system: administrator, employees and clients, on Postgres.
The browser talks to an API; nothing is decided in the browser.

## Made for the hand

Most of the time this is open on an iPhone at the desk or a tablet in the
studio, so it is built for those first. Below 900px the sidebar becomes a
dark top bar (the account sits behind the initials) and a tab bar under the
thumb: the first four sections, and a **More** sheet when there are more than
five. Dialogs rise from the bottom as sheets with the buttons pinned within
reach, tables turn into one card per row, every control is at least 44px
tall, and every field is 16px so iOS never zooms in when one is tapped. Safe
areas are respected top and bottom. Tablets held upright get two cards side
by side; on their side, and on a laptop, it is the sidebar layout.

It can be added to the home screen: `app/manifest.webmanifest` and the icons
in `app/icons/` (the studio mark, cream on wine) make it open full screen
under its own name. Coming back to the app after a minute away reads the
studio again, so a membership linked at the desk in the meantime is there.

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
    npm start                     # http://localhost:3000/app (site at /)

Leave the email variables out and nothing is emailed; everything else works.
See *Email* below.

`npm run check` says whether the database is reachable, migrated and seeded.

`npm run load:studio` writes the studio's printed price list (Pilates,
Spa, Paketat, Wellness Combos, LUKS PËR DY) and the Monday–Saturday
timetable, 07:00–20:50 on the hour. It is never run by a deploy; run it by
hand, and again after changing a price in `server/scripts/load-studio.js`.
`--packages` or `--schedule` does one half, and `--dry-run` previews the
timetable.

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

### What a new database gets, and what it never gets

`api/_lib/catalogue.js` writes the little that cannot be entered through a
screen, because without it there is no screen to enter it through: the two
class types everything else refers to, the switch that keeps prices off the
website, and the administrator registration code. Once, to a database that
has never had them, keyed on `settings.catalogue_version`.

**It writes no packages, and nothing in the code ever will.** Those are the
studio's, entered in the admin under *Packages*: a package that reappeared
because a deployment restarted would not be a package anybody could manage.
One build of that file did write a catalogue of twenty-one, which was the
wrong call; it takes exactly those rows back out, once, leaving behind any
that a membership points at — a membership is a record of money and nothing
here is worth breaking it for.

The registration code is the one secret, so it is not in the repository:
`ADMIN_REGISTRATION_CODE` if the deployment sets one, otherwise a random code
written to the log where only the operator can read it, and only ever when
the database has none.

This is the schema's lesson applied twice over. The schema must be there or
nothing works, so the app writes it. The packages must be the studio's, so
the app keeps its hands off them. What is left in between — class types, a
code — is the short list of things that are neither.

### Doing it by hand instead

`scripts/data.sql` holds exactly those same three rows, for anyone who would
rather run them themselves or who wants to choose the registration code. It
is three inserts, none of them overwriting anything, and it is safe on a live
database.

## Shape

    shared/domain.js       dates and periods, used by both sides
    shared/rules.js        every decision, and the only copy of it
    api/index.js           the one Vercel function: routing and plumbing
    api/_lib/schema.js     the schema, and the version that applies it
    api/_lib/db.js         pool, and the transaction helper
    api/_lib/auth.js       scrypt passwords, session tokens, emailed links
    api/_lib/mail.js       the two letters, through Resend
    api/_lib/catalogue.js  the packages, written once to a new database
    api/_lib/load.js       rows → the object the rules expect
    api/_lib/api.js        the endpoints
    app/                   the browser app
    server/local.js        the local stand-in for Vercel
    server/scripts/        migrate · seed · check
    scripts/data.sql       the catalogue, and the registration code

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
2. **Three environment variables, all for email** — `RESEND_API_KEY`,
   `MAIL_FROM` and `SITE_URL`; see *Email* below. Everything else arrives by
   itself: `DATABASE_URL` from the integration, `NODE_ENV` from Vercel. Do
   not add `PORT`. The admin registration code is not a variable — it lives
   in `scripts/data.sql`.
3. **Nothing to fill in.** The tables and the few rows underneath them
   write themselves on the first request — see *What a new database gets*
   above. The packages are not among them: add those in the admin once you
   are in. The one thing to note is the registration code: set
   `ADMIN_REGISTRATION_CODE` with the other variables, or leave it and read
   the code the first request writes to the function log.

   With a checkout and the connection string to hand, the same thing is:

       DATABASE_URL="<the pooled URL>" npm run migrate

4. Deploy. Check `/healthz` — `{"ok":true}` means the function reached
   Postgres, and `"mail":true` that the letters can go out.
5. Open `/app`, choose **Register**, enter the code you set in `data.sql`.
   That is the first administrator, and nothing else creates one.

Nothing in the deployment touches the database. No build step, no migration on
start — the function connects and reads. Filling it is a thing you do once, by
hand, and changing what is in it is the same two files run again.

## Packages, and the website that shows them

**Packages** in the admin is the whole of it: add one, edit it, retire it.
Each package carries lines saying what it allows — which class types, how
many, per week or per month — and the form replaces them whole, so deleting a
line deletes the allowance. Retiring never deletes: a membership someone
already bought still names the package, and the history has to keep saying
what they bought, so it is archived and stops being offered.

### The website shows what is in there

`assets/js/catalog.js` asks `/api/public/packages` and builds the three
panels on dua-pilates.com from the answer. **There is no catalogue in
`index.html` at all** — the panels ship empty, and what the studio has
entered is the only thing that ever goes in them. With nothing entered, or
with no JavaScript, no network or a broken answer, the section says the
packages are coming, and the tabs, the quiz and the special offers wait with
it.

Each package carries, besides its name and price, the two lines the card
shows — a headline ("The sweet spot") and a rhythm ("Around 2x per week") —
and the sentence underneath. Everything else is read off what the package
allows, so nothing has to be kept in step by hand:

- **which tab** — reformer only is *Pilates*, spa only is *Massages*, both is
  *Combinations*. A tab with nothing behind it is taken off the page, and the
  arrow keys do not walk into it.
- **the number on the card**, and the rule under it that grows with the
  package, and the per-class price, and the "4 Pilates + 1 Spa" line on a
  combination.

The fixed words are generated in English on purpose: the page's own
translator keys on the English source and is watching for new nodes, so
"classes" and "Price coming soon" come out Albanian without that file
knowing a word of it. What it cannot translate is what the studio typed, so
each of those three texts has an optional English version and falls back to
the other when it is blank — a studio writing in Albanian only writes once.

The three **special offers** under the packages are still page copy rather
than rows in the database — they are conditions on a package rather than
packages of their own. None of them names a package or quotes a figure, so
nothing there can go stale when the catalogue changes; they are hidden
alongside everything else until there is a catalogue at all.

The quiz above the packages points at a card on the page. When the package it
had in mind is not among the studio's own, it takes the nearest by shape —
same kind, closest in how much of each it gives — and says so rather than
pretending to have meant that one.

### Whether the website prices them

Above the packages table in the admin is the switch the public site reads.
With it off,
dua-pilates.com lists every package and what it includes and says the price
comes at opening; the app always shows them. A new database starts with it
off, and nothing ever flips it back on by itself.

Off is the default in the stylesheet, not in the script. A reader with no
JavaScript, an API that is down, a slow or unexpected answer — every one of
those leaves the prices in. The only path that shows a price is the one where
the studio said to.

## Booking

### For the customer — `/book`

**Book a class** on the website (nav, hero, offers, the closing section) opens
`/book`: four steps — choose, schedule, details, confirmation. No account and
no password: a full name and a phone number, an email if she wants the link
by email. She is recognised by her phone (`users.phone_key`, normalised so
`069…`, `+355 69…` and `00355 69…` are the same person), which is what stops
an offer being claimed twice.

She chooses a single class, a monthly membership, a class package, or a live
offer. The calendar shows only bookable classes, with the places left; a Duo
needs two places. She may pick some classes now and schedule the rest later.
The confirmation shows the reference (`DUA-7KQ3`), the summary and the price,
says it is **pending** and paid at the studio, and gives her a **private
link** (`/book?r=…`) — the key to her reservation: credits, booking the rest,
cancelling. Only its SHA-256 digest is stored; the studio can make a new one
(**Make a new link for her**), which retires the old.

Nothing is ever marked paid by the system. Status (pending, confirmed,
completed, cancelled) and payment (unpaid, paid) are separate and set by the
studio.

### Credits

Each person on a reservation holds a package (`memberships`): credit lines
copied from the package or offer at that moment, valid between two dates
(from the opening date or today, for its validity). A booking spends a
credit while it stands (`booked`), and keeps it spent if cancelled late
(`late`) or missed (`attendance = 'noshow'`); cancelled in time or by the
studio (`released`), it gives it back. Bonus classes and the desk's own
additions are `credit_events`, so a balance can always be explained. A
customer may hold several packages; a class is paid from the one that runs
out first. Prices, discount and terms are written on the reservation
(`unit_price`, `original_price`, `discount_pct`, `total_price`, `terms`),
so a later price change alters nothing already booked.

### The rules, enforced on the server

All in `api/_lib/booking.js`, inside one transaction with the class rows and
the package rows locked (`for update`), so simultaneous requests cannot
overbook: capacity counts bookings plus blocked places, a Duo takes two
places, a person cannot hold the same class twice (unique index), no class
before the opening date or past the booking horizon, no class outside the
package's dates, never more classes than credits. Offers are locked while
their claims are counted, so the 30th and 31st Founding claim cannot both get
in; one claim per person per offer is a unique index.

**Cancellation:** up to and including `cancel_window_min` (30) minutes before
the class, in Europe/Tirane time — a 09:00 class can be cancelled at 08:30,
not 08:31. After that the Cancel button is gone and the server refuses it.
The studio can still cancel and choose to give the credit back or keep it
spent, and can give back a late cancellation or a no-show. A class the
studio cancels always gives every credit back.

**Time:** every "when does it start" and "what is today" is answered in
Europe/Tirane (`shared/domain.js`: `at`, `todayIn`), whatever clock the
server runs on.

### The schedule — weekly template plus date overrides

**Schedule → Weekly schedule** holds the week: time slots per weekday, each
with capacity, class and who leads it, effective from a date (a new date
starts a new version; earlier dates keep theirs). Classes are generated
about 90 days ahead (`api/_lib/schedule.js`). **Review and save** first shows
what would change — added, changed, removed — and lists every class that has
bookings, which is never moved or deleted: it stays as booked, pinned.

**Calendar → a class** edits that date only (the class is pinned and the
template never touches it again): time, capacity, who leads it, blocked
places, cancel. **One-off class** adds a class to a single date. **Closed
days** cancels a whole day after a preview of who is affected — everyone is
told and gets the class back — and reopening restores the classes.

### Offers

**Offers** in the admin: a *package deal* (its own classes and price — DUA
DUO, with one or two people, attending together or not), a *discount* (a
percentage on eligible packages — FOUNDING GIRLS, with a cap and new clients
only), or *bonus classes* (BRING A BESTIE — granted to the referrer, the
friend or both, when the friend buys, when the reservation is paid, when the
friend first comes, or straight away). Each has dates, a cap, conditions in
Albanian and English, and an active switch; only live ones appear on
`/book`. Archiving never touches reservations already made. The three launch
offers are written once by `api/_lib/catalogue.js` and are then the studio's.

### The desk — Reservations

List (search by name, phone or reference; filter by status, payment, offer)
and day view (each class with its roster, phone numbers, payment, one-tap
attendance, blocked places, **Add someone**). A reservation opens as a sheet:
status, payment, credits per person (+/−), package dates, its classes with
move, cancel, give back, attendance, and **Book classes**. **New
reservation** makes one at the desk for a client or a new person, with any
package or offer — the server applies the same rules.

**Settings** holds the opening date, the cancellation window, how far ahead
booking opens, and the capacity of a new slot.

### Tests

    DATABASE_URL=postgres://…/dua_test npm run test:booking

Runs against a real Postgres (it refuses any database whose name does not
contain `test`, because it wipes it): eight people at once for five places,
blocked places, double booking, Duo seats and pricing, credits and booking
later, the opening date, the 30-minute boundary, Founding's cap and
duplicate claims, new-client checks, price snapshots, Bestie's bonus, the
template against date overrides and booked classes, closed days, package
dates, and moves.

## Employees

**Employees** (*Punonjëset*) are everyone on the staff side, and each is one
of two kinds: an **instructor**, or a **body therapist / physiotherapist**.
That is `users.job`; the role stays `instructor` for both, because it is what
opens the staff dashboard. Choosing the kind when adding someone ticks what
they can take to begin with — the reformer for an instructor, the spa for a
therapist — and that can be changed before saving. Both are placed on classes
the same way: by what they are qualified for, inside their hours, without a
clash.

## What the studio sells

`scripts/data.sql` carries all twenty-one, the same ones the website prices:
the six reformer packages, five single treatments, three treatment packs, and
seven combinations of the two. The ids match the `data-pack` tags on the
public page, so the quiz there and the catalogue here name the same things.

Two limits worth knowing before anyone asks:

- The schema has one `spa` class type, so a relax, a lymph and a sculpt hour
  are the same thing to the timetable. The packages differ by name, price and
  count — which is what a client chooses between anyway — but a class cannot
  yet be marked as one kind of treatment rather than another.
- A client holds one membership at a time, which is why the combinations
  exist. Someone who wants classes and massages buys a combination rather
  than two memberships.

`DUA SIGNATURE` is `spa-signature` rather than `signature`: that id belonged
to a membership this catalogue replaced, and archived rows still point at it.

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

## Email

Two letters, both about getting into an account: the password reset link, and
the one that confirms an address. They go out through **Resend** — one HTTPS
call from `api/_lib/mail.js`, no dependency added, nothing to keep up to date.
Both are written in Albanian and English and the one that goes out is the
language she was reading: the app sends `x-dua-lang` with every request.

**Setting it up**, once:

1. **resend.com** → sign up → **Domains** → *Add domain*. `dua-pilates.com`
   is verified and sending; a subdomain such as `mail.dua-pilates.com` is
   what Resend prefers, because it keeps the studio's own mail reputation
   separate from its robots'. Whichever is verified, `MAIL_FROM` has to sit
   on it — a `From` on an unverified domain is refused on every send, which
   is the one failure that looks like a working setup.
2. Resend shows three records to add. Add them in **Cloudflare** → DNS for
   `dua-pilates.com`, with the proxy **off** (grey cloud — these are mail
   records, not a website):
   - a **TXT** record for DKIM, named like `resend._domainkey.mail`,
   - an **MX** record on `send.mail` pointing at Resend's feedback host,
   - a **TXT** SPF record on `send.mail`.

   Copy each value from Resend rather than from here; they are per-account.
   Cloudflare appends the zone to the name, so paste the host exactly as
   Resend gives it **minus** `.dua-pilates.com`.
3. Back in Resend, **Verify**. It takes a few minutes, occasionally longer.
4. **API Keys** → *Create*, sending access, and put it in Vercel →
   *Settings* → *Environment Variables*:

       RESEND_API_KEY   re_...
       MAIL_FROM        DUA Pilates and Spa <no-reply@dua-pilates.com>
       SITE_URL         https://dua-pilates.com

   `SITE_URL` is what the links in the letters point at, so it is set
   explicitly rather than guessed from the request — a wrong value here sends
   somebody to a link that cannot work. Redeploy after adding them.
5. Check `/healthz`. It reports three things about mail: `"mail":true` that
   the key is set, `"from"` the address the letters go out as, and
   `"mailLast"` how the last attempt went. **`from` has to sit on a domain
   verified in Resend** — if it does not, every send is refused with nothing
   recorded at Resend to find, which looks exactly like a working setup that
   nobody is using. `mailLast.ok:false` with the reason is how you tell those
   two apart. Then use **Forgot your password?** on an address that has an
   account and read the letter.

   A reset asked for an address with *no* account sends nothing, by design,
   and still answers `{"ok":true}` — so a letter that does not arrive may
   simply be a letter nobody was owed. The log line says so.

The free tier is 3,000 letters a month and 100 a day. A studio sends a
handful of resets a week, so there is nothing to watch.

**If sending fails** — no key, a domain not verified yet, Resend down — the
failure is logged and never raised. The token is already in the database and
the screen still says what it says, because the alternative is a registration
that fails because a letter could not be posted. What the studio loses is the
letter, not the account, and the desk reset covers the gap.

**Locally**, leave `RESEND_API_KEY` unset and nothing is sent; `/healthz`
reports `"mail":false` and the log says which letter did not go out. To
exercise the whole path, point `fetch` at a recorder before importing the
server and read the link out of the captured body — that is how the flow is
tested.

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

**Getting back in.** Two ways, and the second is there because the first
needs somebody awake.

*By email.* **Forgot your password?** under the sign-in form sends a link —
one hour, one use. Opening it lands on `/app?reset=TOKEN`, which asks for the
new password and nothing else, and setting it signs every other session on
that account out: a reset exists because somebody may have had the old
password, so leaving the old sessions alive would make it ceremony. The
request answers the same way for an address with an account and one without —
same status, same body, same screen — because an endpoint that distinguishes
them is a membership list anyone can read. Asking is counted per address and
per caller over a rolling hour, four and fifteen, so an inbox cannot be used
as a weapon.

The token is random, and only its SHA-256 digest is stored, in `auth_codes`.
Claiming one is a single `UPDATE` that marks the row used in the same
statement that checks it was not, so the same link in two tabs opens once.
Asking again replaces the link rather than adding a second one.

*At the desk.* **Reset password** on any client or instructor issues a new
password, shows it once, and signs that account out everywhere. It is the
answer when she cannot reach her inbox, when the address on the account is
wrong, and on the day Resend is down.

**Confirming an address.** Registering sends a confirmation letter, and the
app keeps a band at the top of every screen until it is opened. Nothing is
withheld from an unconfirmed account — it is not a gate, it is the reset link
working on the day it is needed. Resetting a password confirms the address
too: she has just proved she reads that inbox.

The last administrator is the one case the desk cannot cover, and email now
does — provided `RESEND_API_KEY` is set and her address is confirmed. If
neither holds, the way back is SQL:

    update users set password_hash = '<a scrypt hash>' where email = '...';

or, more simply, delete the row and register again with the code in
`scripts/data.sql`.

**A session that ends mid-use.** Thirty days is long enough that one will
expire while somebody is looking at a screen. A 401 on anything but the
sign-in calls drops the session on this side too and draws the sign-in
screen, rather than leaving a studio on screen that the server no longer
knows us in.

## Still to do before real money changes hands

Payment happens at the studio and an administrator records it by linking the
membership. Wiring a processor would mean a webhook calling the same link, so
the shape of this is already the shape it needs. Notices are in-app:
email now has a sender (`api/_lib/mail.js`), so putting a notice in an inbox —
"your membership is confirmed", "your class is tomorrow" — is a call to it
from wherever the `notices` row is written, not new plumbing.
