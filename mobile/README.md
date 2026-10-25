# DUA Pilates & SPA — mobile app

One React Native app for iOS and Android, with three experiences chosen by the
role the server gives the signed-in account:

| Role | Tabs |
|---|---|
| **Client** | Home · Book (Pilates / SPA) · My classes · Packages · Profile |
| **Instructor / therapist** | Today · Schedule · Participants (Appointments for therapists) · Notifications · Profile |
| **Admin / owner** | Dashboard · Calendar · Clients · Staff · More (orders, payments, packages, promotions, analytics, timetable, SPA, requests, closed days, announcements, payroll, settings, audit log) |

Expo SDK 58 · Expo Router · TypeScript · TanStack Query · Zustand · React Hook Form + Zod ·
expo-secure-store · expo-notifications · expo-calendar. Albanian by default, English in Profile.

The API is in [`../backend`](../backend/README.md). This app decides nothing: every
booking, credit and price is checked again on the server.

---

## Run it on your phone with Expo Go

### 1. Once, on the phone

Install **Expo Go** from the App Store (iPhone) or Google Play (Android). It has to
support **SDK 58**; the store version does once SDK 58 is out. If Expo Go says the
project is incompatible, update Expo Go.

### 2. Once, on the computer

- **Node.js 22.13 or newer** ([nodejs.org](https://nodejs.org)). React Native 0.88
  requires it. Check with `node -v`.
- Then:

      cd mobile
      npm install

### 3. Point the app at an API the phone can reach

The app reads the API address from `mobile/.env`:

    EXPO_PUBLIC_API_URL=https://<your-api>.up.railway.app

- **Railway (recommended):** use the URL of the *development* environment's API
  service (see `backend/README.md` → Railway). It works from anywhere, including tunnel mode.
- **Your own computer:** run the backend locally and use the computer's **LAN
  address**, e.g. `http://192.168.1.40:4000`. Find it with `ipconfig` (Windows) or
  `ipconfig getifaddr en0` (macOS). Phone and computer must be on the same Wi-Fi.

**Never `localhost`** — on the phone, localhost is the phone itself.

Only `EXPO_PUBLIC_*` values go in this file and they end up inside the app, so it
contains no secrets. Every secret (database, Resend key, JWT secret) stays on Railway.

After changing `.env`, restart `npx expo start`.

### 4. Start the dev server and scan

    npx expo start

A QR code appears in the terminal.

- **iPhone:** open the Camera app, point at the QR code, tap the banner.
- **Android:** open Expo Go → *Scan QR code*.

The DUA welcome screen opens. Edit any file and the phone updates on save (Fast Refresh).

If the phone cannot reach your computer (different networks, office/guest Wi-Fi,
VPN), use the tunnel:

    npx expo start --tunnel

The first time, it asks to install `@expo/ngrok`; say yes. The tunnel carries the
app bundle only — the API still has to be reachable on its own, so with a tunnel
use the **Railway** API URL.

### 5. Sign in as each role

With the backend seeded (`npm run seed` in `backend/`) and `APP_ENV=development`,
`DEV_LOGIN_CODE=000000` on the API, these accounts sign in with the code **000000**,
no inbox needed:

| Role | Email |
|---|---|
| Admin / owner | `owner@dua.dev` |
| Instructor | `ines@dua.dev` (also `marta@dua.dev`, `elisa@dua.dev`) |
| Therapist | `ana@dua.dev` |
| Client with packages, bookings and a SPA appointment | `sara@dua.dev` |
| Client with an unpaid trial waiting at the desk | `klea@dua.dev` |

The fixed code works only for `@dua.dev` addresses and only when the API runs with
`APP_ENV=development`; production ignores it. **Any other address** gets a real
6-digit code by email through Resend — sign up with your own email to test the
real flow (new addresses go through *About you* and become clients).

Sign out from Profile (or More → Profile for admins) to switch roles.

### What to try

- **Client:** Book → pick tomorrow → a class → *Book class*; *Add to calendar*;
  My classes → *Manage* → cancel (in time: credit returned). A class showing *Full*
  → *Join the waiting list*. Book → SPA → a treatment → a time → confirm. Packages →
  a package → promo code `FOUNDING20` (first-time clients only) → reserve.
- **Admin:** Dashboard → *payments pending* → record a cash payment (Klea's trial
  activates and she gets a notification). Calendar → a class → add a participant,
  change capacity, cancel the class (everyone's credit returns). More → Weekly
  timetable / Settings (cancellation hours, waitlist hold time…).
- **Instructor:** Today → a class → participants. *Present / Absent* opens 30
  minutes before the class. Profile → Requests → ask for time off (the admin sees
  it under More → Requests).

### Loading, errors, offline, sessions

- Pull down on any list to refresh. Lists show skeletons while loading and a
  *Try again* card on errors.
- Turn on airplane mode: a grey bar says you are offline, the last data stays on
  screen, and queries resume by themselves when the connection returns.
- Close the app completely and reopen it: you are still signed in. The refresh
  token lives in the iOS Keychain / Android Keystore (expo-secure-store); the access
  token lives only in memory and renews itself every 15 minutes.
- Opening the app offline with a saved session still opens your app (role and name
  are kept on the device); data loads when the connection is back.

### Push notifications and Expo Go

- **iPhone + Expo Go:** push works. Allow notifications when asked (Profile →
  Notification preferences asks again).
- **Android + Expo Go:** Expo removed remote push from Expo Go on Android in SDK 53.
  The app says so in Notification preferences. Everything else works; notifications
  still appear in the in-app list (bell icon) and by email. For push on Android,
  use a development build (next section).

Push needs an EAS project id: run `npx eas-cli@latest init` once and it is written
into `app.json` (`extra.eas.projectId`).

## Development build (when Expo Go is not enough)

Android push is the one feature here that needs it. Everything else runs in Expo Go.

    npx eas-cli@latest login
    npx eas-cli@latest init                       # once: links the EAS project
    npx eas-cli@latest build --profile development --platform android
    # (or --platform ios; needs an Apple developer account)

Install the build from the link EAS gives you, then `npx expo start --dev-client`
and scan the QR code with that app instead of Expo Go.

## Production builds

`eas.json` has three profiles: `development`, `preview` (internal testers) and
`production`. Each sets `EXPO_PUBLIC_API_URL` — **change the two Railway URLs in
`eas.json` to your real ones** before building.

    npx eas-cli@latest build --profile production --platform all
    npx eas-cli@latest submit --platform ios       # App Store Connect
    npx eas-cli@latest submit --platform android   # Google Play

Bundle id / package: `com.duapilatesandspa.app` (in `app.json`; change it before the
first store submission if the studio wants a different one).

## Troubleshooting

| What you see | What to do |
|---|---|
| "No connection to DUA" on every screen | `EXPO_PUBLIC_API_URL` is wrong or unreachable. Open `<that URL>/health` in the **phone's** browser: it must say `{"ok":true,...}`. |
| Works on Wi-Fi at home, not elsewhere | You used a LAN address. Switch to the Railway URL. |
| LAN address does not answer from the phone | Windows Firewall: allow Node.js on *Private networks* (or port 4000). Make sure the Wi-Fi is set as Private, not Public. |
| QR scans but "Could not connect to development server" | Same Wi-Fi? Otherwise `npx expo start --tunnel`. Corporate/guest networks often block device-to-device traffic. |
| "Project is incompatible with this version of Expo Go" | Update Expo Go from the store. |
| The code email never arrives | Check spam. On the API, `RESEND_API_KEY` must be set and `MAIL_FROM` must be on a domain verified in Resend. Without a key (development) the code is printed in the API log. |
| "Too many attempts" | 3 codes per 15 minutes per email, 5 wrong guesses per code. Wait, or use a dev account. |
| Changes in `.env` ignored | Stop and rerun `npx expo start` (add `-c` to clear the cache). |
| Red screen after `npm install` | `npx expo install --fix`, then `npx expo start -c`. |

## Checks

    npx tsc --noEmit      # types (including typed routes)
    npx expo lint
    npx expo-doctor       # SDK / dependency health
    npx expo export --platform ios --platform android   # proves both bundles build

End-to-end flows for the critical journeys are in [`.maestro/`](.maestro) (client
books and cancels, client books SPA, admin records a payment, instructor opens her
roster). Run them with [Maestro](https://maestro.mobile.dev) against a development
or preview build: `maestro test .maestro/`.

## Layout

    src/app/            routes (Expo Router)
      (auth)/           welcome · sign-in · verify (6-digit code) · register
      client/           (tabs) + class/[id] · treatment/[id] · package/[id] · booked · memberships · notifications · …
      staff/            (tabs) + session/[id] · appointment/[id] · hours · requests · …
      admin/            (tabs) + session/[id] · client/[id] · staff/[id] · product/[id] · orders · analytics · settings · …
    src/components/     design system (ui.tsx), DateStrip, ClassRow, AgendaItem, shared screens
    src/lib/            api client (token refresh, idempotency), auth store, i18n, Tirana-time formatting, push
    src/theme.ts        colours, type, spacing
    assets/photos/      the studio's own photographs (shared with the website)
