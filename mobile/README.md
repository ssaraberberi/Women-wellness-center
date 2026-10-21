# DUA — the phone app (iOS + Android)

One Expo / React Native codebase for the App Store and Google Play. It
talks to the **same API and the same database** as dua-pilates.com — no
second backend and no copy of the data. The studio's rules come from
`../shared/rules.js`, the very file the website and the server run, so a
booking the phone predicts is the booking the server decides.

Albanian by default, English with one tap — the same as the website.

## Three apps in one, by role

The server decides the role at sign-in; the phone only opens the matching app.

| Role | Tabs | What it does |
|---|---|---|
| **Client** | Home · Classes · Packages · Account | upcoming classes with cancel (30-min rule), package credits; a timetable by day with Book / Cancel; reserving a package or an offer (paid at the studio); her reservations; a reminder 2 hours before each class |
| **Instructor / therapist** | Classes · Hours · Account | her classes (upcoming / past), the roster with phone numbers, attendance (came / no-show); weekly hours and what she teaches |
| **Admin** | Schedule · Reservations · Studio · Account | the day's classes with flags; per class: roster, attendance, assigning someone, places held back, cancelling a place or the class; reservations: search, status, payment, ± credits, booking classes, a new private link via WhatsApp; a new reservation at the desk; numbers, what needs attention, the website's price switch |

Everyone gets notifications (the bell, plus push) and the language switch.
The weekly timetable, packages and offers are still edited in the web admin at `/app`.

## What changed on the server (additive only — the website is untouched)

- `Authorization: Bearer <token>` is accepted alongside the cookie. The
  token is returned in the body only when the request carries
  `x-dua-client: mobile`, so a browser never sees it.
- New endpoints: `GET/POST /api/client/reservations`,
  `GET /api/instructor/classes/:id/roster`,
  `POST /api/instructor/bookings/:id/attendance` (her own classes only),
  `POST /api/me/devices`, `POST /api/me/devices/forget`.
- Schema (applies itself, `VERSION 2026-10-21m`): a new `push_devices`
  table and a `notices.pushed_at` column. Old notices are marked as sent,
  so nothing is pushed retroactively.
- Every notice the server already writes also goes out as a push (Expo
  Push), in Albanian or English according to the phone's language
  (`shared/notices.js`). Set `PUSH_DISABLED=1` to turn it off.
- Reservations made in the app are written with `source = 'app'`.

Tests: `npm run test:booking` (52) and `npm run test:mobile` (25) from the repository root.

## Running it

    cd mobile
    npm install
    EXPO_PUBLIC_API_URL=http://<your-computer-ip>:3000 npx expo start   # with `npm start` running at the root

Push notifications need a development build (`eas build --profile development`); everything else runs in Expo Go.
Without `EXPO_PUBLIC_API_URL` the app talks to `https://dua-pilates.com` (`app.json → extra.apiUrl`).

Checks: `npm run typecheck`, `node tools/strings.mjs` (every string has an Albanian line).

## Publishing in the stores

What only the studio can do (accounts and payment):

1. **Apple Developer Program** (99 USD/year) and **Google Play Console** (25 USD one-off).
2. `npm i -g eas-cli && eas login && eas init` — links the project to EAS and
   writes `extra.eas.projectId` into `app.json` (push needs it).
3. Identity: `com.duapilates.app` on both platforms (`app.json`). Change it
   before the first build if the studio wants another one — afterwards it cannot be changed.
4. Build: `npm run build:ios` and `npm run build:android` (in the cloud — no Mac needed).
   EAS creates the certificates and signing keys itself.
5. Submit: in `eas.json` put the `ascAppId` from App Store Connect and the
   Google Play service-account key (`play-service-account.json`, kept out of git);
   then `npm run submit:ios` / `npm run submit:android`.
   Android goes to the *internal* track first; promote it from the console.
6. In the store listings: screenshots, a description (SQ/EN), and a privacy
   policy URL (e.g. `dua-pilates.com/privacy` — still to be written). The app collects
   name, email, phone and bookings; it does no tracking and takes no payments.
7. **Apple requires account deletion from inside the app** for apps with
   registration. Today that is done through the studio; before submitting to
   Apple, a "Delete account" button needs adding (one endpoint + one button).

The icons are cut from the studio's mark by `tools/build-icons.py`.
