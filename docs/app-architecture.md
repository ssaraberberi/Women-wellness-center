# DUA mobile platform — architecture

Status as of the `app` branch. Setup and deployment: [`mobile/README.md`](../mobile/README.md),
[`backend/README.md`](../backend/README.md).

## Shape

```
 iPhone / Android (Expo, one app)          Railway project "dua"
 ┌────────────────────────────┐            ┌─────────────────────────────────────┐
 │ client · staff · admin UIs │  HTTPS     │ api  (Fastify, Node)                │
 │ TanStack Query cache       ├───────────►│  routes → services → Prisma         │
 │ SecureStore: refresh token │  JSON+JWT  │  worker loop (same process or own)  │
 └─────────────┬──────────────┘            │ PostgreSQL                          │
               │ push                      └───────┬───────────────┬─────────────┘
        Expo Push Service ◄────────────────────────┘               │ HTTPS
                                                         Resend (email: codes,
                                                         confirmations, reminders)
```

- **One backend, one database, three roles.** `users.role` is `CLIENT`, `STAFF` or
  `ADMIN` (an enum rather than a `roles` table: the set is fixed and every route
  checks it). `is_owner` marks owners among admins. Staff carry a `staff_profiles`
  row saying instructor and/or therapist and what they may see.
- **The server decides.** The app shows availability and eligibility, but every
  booking, cancellation, payment and credit change is decided again inside a
  database transaction.
- **Development and production** are two Railway environments with separate
  databases and secrets. The `@dua.dev` dev accounts and the fixed dev code exist
  only where `APP_ENV=development`.

## Data model (38 tables)

| Area | Tables |
|---|---|
| Identity | `users`, `user_profiles`, `staff_profiles`, `auth_otp_challenges`, `auth_sessions`, `notification_preferences`, `push_tokens` |
| Pilates | `class_types`, `class_schedule_templates`, `class_sessions`, `class_bookings`, `class_attendance`, `class_waitlists` |
| SPA | `spa_treatments`, `spa_rooms`, `therapist_qualifications`, `therapist_availability`, `spa_appointments`, `spa_time_blocks` |
| Memberships | `membership_products`, `membership_product_spa_items`, `membership_purchases`, `credit_wallets`, `credit_transactions`, `spa_entitlements`, `promotion_codes`, `promotion_products` |
| Payments | `orders`, `payments`, `refunds` |
| Operations | `staff_availability`, `time_off_requests`, `studio_closures`, `client_notes`, `announcements`, `notifications`, `audit_logs`, `studio_settings` |

Constraints that matter: one live booking per client per class and one open
waiting-list entry (partial unique indexes); wallet balance ≥ 0 (CHECK);
`(template_id, starts_at)` unique so schedule generation is idempotent;
`(dedupe_key, channel)` unique on notifications; idempotency keys unique per user
on bookings, appointments and orders; `credit_transactions.idempotency_key` unique.

**No machine numbers.** A booking is a place in a class. Nothing in the schema or
the app assigns a reformer.

## Key flows

- **Sign-in.** Email → 6-digit code (Resend) → existing account: tokens; new
  address: registration token → name + phone → client account. Access JWT 15 min,
  rotating refresh token 30 days with reuse detection.
- **Booking a class.** Lock class row → check status, window, closure → count
  bookings + held offers → spend credits from the soonest-expiring package valid on
  that date → booking row → notification rows (in-app, push, email) → commit.
- **Cancelling.** Before `free_cancel_hours`: refund. After: kept or refunded per
  `late_cancel_keeps_credit`; an admin can always restore. The freed place goes to
  the waiting list.
- **Waiting list.** A freed place is offered to the first eligible person and held
  for `waitlist_offer_minutes`; held places count as taken. Expired offers pass on
  (worker, every 30 s). Lists close when the class starts.
- **SPA.** Slots computed from therapist hours, breaks, qualifications, duration +
  buffer, free rooms, blocks, approved time off and closures. Booking re-runs the
  computation for the exact slot under an advisory lock. An included treatment from
  a package pays for it; otherwise it is paid at the studio.
- **Packages.** Order (pending, promo applied, terms snapshotted) → payment recorded
  at the desk (or a verified provider event) → purchase activated: wallet +
  SPA entitlements created, validity starts.
- **Schedule.** Weekly templates generate classes `schedule_horizon_days` ahead
  (hourly). Edited or booked classes are never regenerated. Closing a day cancels
  its classes and appointments with credits returned and everyone told.

## Screen map

**Auth:** Welcome · Sign in (email) · Code · About you (new clients)

**Client:** Home (next class, next SPA, package and credits, quick book, explore,
classes with places, treatments, offers, news) · Book: Pilates (week strip with
swipe, format chips, instructor / level / availability filters, morning /
afternoon) and SPA (categories, treatments) · Class detail (book, waiting list,
accept offer, cancel, policy) · Treatment (date, therapist, times, confirm) ·
Confirmation (+ add to calendar) · My classes (upcoming incl. SPA, past with
attendance, cancelled with credit outcome, waiting list) · Packages (Pilates / SPA /
combos) · Package (promo code, total, reserve) · Memberships (credits, purchases,
credit ledger, cancel unpaid, renew) · Notifications · Profile (details, language,
notification preferences, sign out, deletion request)

**Instructor / therapist:** Today (sessions, clients, changes, upcoming) ·
Schedule (day / week, closures, time off) · Participants or Appointments ·
Session (roster, first-timers, present / absent, permitted notes) · Appointment
(complete / no-show, permitted notes) · Hours (set by studio, preferences) ·
Requests (time off, conflict, availability change) · Notifications · Profile

**Admin:** Dashboard (day / week / month: revenue, bookings, active members, new
clients, sales, cancellations, waiting lists, free places; today's classes, SPA and
staff; pending payments and requests) · Calendar (Pilates / SPA by day; new class,
new SPA appointment) · Class (participants with attendance, cancel with or without
credit, restore credit, add participant, edit time / capacity / instructor, cancel
class, waiting list) · Clients (search, add) · Client (packages with extend, credit
adjust, sell package with payment, orders and payment recording, booking and SPA
history, credit ledger, notes internal / for staff, message, disable, delete) ·
Staff (list, invite) · Staff member (roles, compensation, permissions,
qualifications, working hours, preferences, upcoming, deactivate, ownership) · More:
Orders · Payments (refund) · Packages (create / edit incl. SPA items) · Promotions ·
Analytics · Weekly timetable + class types · SPA (treatments, rooms) · Requests ·
Closed days · Announcements · Payroll estimate · Settings · Audit log

## Phases

| Phase | State |
|---|---|
| 1 Foundation — schema, migrations, auth, roles, design system, Railway config | Built and tested locally. **Not yet deployed** to Railway. |
| 2 Client Pilates — home, calendar, detail, booking, my classes, credits | Built; API tested; app type-checked, linted and bundled. |
| 3 SPA — catalogue, availability, booking, combos | Built; API tested (incl. race and room tests). |
| 4 Admin — dashboard, classes, memberships, clients, staff, payments | Built. |
| 5 Instructor — schedule, participants, attendance, requests | Built. |
| 6 Production — notifications, analytics, hardening, tests, builds | Notifications, analytics, rate limits, tests and EAS profiles built. Store builds not made. |

## Verified, and not yet verified

**Verified here:** 27 backend integration tests on a real Postgres; a 34-step smoke
run of the main journeys against the running API with all three roles; backend
production build; mobile `tsc` (with typed routes), `expo lint`, `expo-doctor`
(20/20) and `expo export` producing the iOS and Android bundles.

**Not verified, because it needs things this machine does not have:**

- **Running on a physical phone.** No device or simulator was available. The
  bundles build and every route type-checks, but the screens have not been looked
  at on a phone yet. Expect visual polish to do.
- **Railway.** The CLI here is logged out; nothing is deployed. `railway.json` and
  the steps in the backend README are ready.
- **Real email.** No Resend key was available. The Resend call is exercised in tests
  through a test outbox; a real send has not been made.
- **Real push delivery** (needs a device and an EAS project id).
- **Maestro flows** are written but have not been run.
- **Node version:** React Native 0.88 asks for Node ≥ 22.13; this machine has
  20.20. Bundling worked on 20, but use 22+.

## Deliberate limits (decisions, not bugs)

- **Credit policy is "spend at booking".** Refunds follow the cancellation rules.
  There is no separate "reserve, then consume at attendance" mode.
- **Any class credit pays any class type.** `credits_required` per class type
  sets the price in credits; packages are not restricted to certain formats.
- **Duo packages** are one shared wallet on the buyer's account (she books for
  herself; the desk can book her friend). There is no linked second account.
- **Online payment** is an interface with no provider (`PAYMENT_PROVIDER=none`).
  Clients reserve in the app and pay at the studio.
- **Notification wording** lives in `backend/src/services/messages.ts` (both
  languages), not in an admin-editable template table.
- **Staff permissions** are instructor / therapist / may-see-service-notes.
  There are no finer-grained per-screen permissions.
- **SPA time blocks** exist in the API (`/admin/spa/blocks`) but have no screen
  yet. Therapist absences are handled through approved time-off requests.
- **Error tracking** is structured logs only; Sentry (or similar) is not wired in.
