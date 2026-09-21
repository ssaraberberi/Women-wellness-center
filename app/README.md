# DUA — studio platform (prototype)

A working prototype of the booking platform: three roles, real scheduling
logic, and no backend. It runs as static files next to the marketing site,
at `/app`.

## Trying it

Demo accounts, all with the password `demo1234`:

| Role | Email | What to look at |
|---|---|---|
| Administrator | `admin@dua-pilates.com` | dashboard, schedule, instructor assignment |
| Instructor | `elira@dua-pilates.com` | her classes, qualifications, availability |
| Client | `sara@example.com` | Signature membership, booking, cancelling |
| Client | `enke@example.com` | Essential — shows what a plan does *not* include |

The administrator registration code is **not** in the interface, by design.
It lives in `js/data.js` as `ADMIN_CODE`. In production it belongs on a
server: anything shipped to the browser can be read by whoever receives it,
so this is a prototype arrangement and not a security boundary.

`window.duaReset()` in the console puts the demo back to its opening state.

## How it is put together

    js/data.js     class types, membership plans, and the seed
    js/rules.js    every decision: eligibility, availability, cancellation
    js/store.js    state, persistence, and the actions that change it
    js/ui.js       small rendering helpers
    js/views/      one file per role, plus the signed-in frame

No framework and no build step. State lives in `localStorage`, so a
refresh keeps your place and two browsers see two separate studios.

**The rules are the point.** `rules.js` answers the questions and the views
render the answer — no screen works out for itself whether a client may
book. That is what keeps the client's "1 class left this week" and the
admin's "8 / 10 booked" from ever disagreeing.

Class types and plans are data. Add a type to `CLASS_TYPES` and it appears
in the schedule editor, the qualification list, the plan builder and the
eligibility checks without touching logic.

## What the brief asked for, and where it is

- **Intelligent assignment** — `suggestInstructors()` ranks by qualified /
  available for the *whole* class / free of clashes. The admin can only
  pick someone the check passes; the rest are shown and disabled with the
  reason, rather than hidden.
- **Membership eligibility** — allowances are `{types, limit, per}`, so
  weekly and monthly both work and the wording follows the plan.
- **Cancellation** — free until an hour before; inside the window the
  session returns and the first person on the waitlist is moved in.
- **Drift** — the admin's *Attention* list carries anything that was valid
  when it was set and is not now: a class outside its instructor's hours, a
  class with nobody assigned, a membership that expired with classes still
  booked. The seed ships with one, deliberately.

## Known edges

Payment is a form that takes no card. Notifications are in-app only.
Everything is one browser's `localStorage`, so the roles do not see each
other's changes across devices — a real deployment needs a server, and
that is where the admin code, passwords and money would move to.
