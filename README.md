# DUA — movement & recovery studio, Tiranë

A production-ready homepage mockup for a women-focused studio on
**Sheshi Wilson, Tiranë** — Reformer Pilates, barre, yoga and massage.

**DUA** is short, lowercase and a little familiar — named the way people actually
refer to the places they go every week, not the way a wellness brand names itself.
The tone follows: confident, specific, occasionally funny, never reverent. Nobody
here is going to call anything a journey.

Open `index.html` in a browser. No build step, no dependencies, no network required —
fonts and photography are served from `assets/`.

---

## What's here

```
index.html                  the full homepage
tools/build-logo.py         cuts the logo artwork into the alpha masks the CSS paints
assets/css/styles.css       design system + every section
assets/css/fonts.css        self-hosted @font-face declarations
assets/fonts/               Bodoni Moda + Jost (woff2, latin + latin-ext)
assets/img/                 photographs, sized and compressed per slot.
                            opening-studio-*.jpg is the studio's own photograph,
                            supplied for a landing treatment that was removed —
                            kept, but not currently placed on the page.
assets/js/main.js           scroll motion, gallery, booking, menu (vanilla)
assets/js/i18n.js           English / Albanian, dictionary and switch
assets/js/whatsapp.js       floating WhatsApp contact card
```

## Page structure

| # | Section | Idea |
|---|---------|------|
| 1 | Hero | *Move like you mean it.* Full-bleed, minimal nav |
| 2 | The experience | *The best hour of your week.* Asymmetric editorial grid + studio facts |
| — | Four rituals | Vertical scroll drives a horizontal reveal: Reformer → Barre → Yoga → Massage |
| 3 | Reformer | The signature service: oversized drifting type, sticky image, scrolling words |
| 4 | Barre + Yoga | Offset split with an atmospheric full-bleed band |
| 5 | Recovery | *You've earned the dark room.* Mood shift — plum, warm, intimate |
| 6 | Schedule | The full week, 31 classes; tap any one for instructor, level and availability |
| 7 | Memberships | Three tiers, Reformer switchable 8 / 12 / 16, Wellness featured |
| 8 | The space | A room-by-room tour — reformer room, changing rooms, mat studio, lockers, washroom — as a draggable gallery |
| 9 | In their words | Lifestyle testimonials, sticky lead quote |
| 10 | Community | `@dua.studio` feed grid |
| 11 | Final CTA | *See you Thursday.* |

**The schedule** is a seven-column timetable of the real week — Monday to Sunday, 31
classes, instructor named on every one, with a discipline marker down the left edge
(rose for reformer, plum for barre, deep rose for yoga). Tapping a class opens a panel
with the description, instructor and their role, duration, level and how many places are
left; full classes are dimmed and marked. *Book this class* hands straight over to the
booking panel with the discipline already selected.

To edit the timetable, change the `WEEK` and `CLASSES` tables in
`tools/generate-schedule.py` and re-run it — it rewrites the section in place, so the
markup cannot drift out of sync with itself.

On phones the seven columns collapse to a day picker showing one day at a time. Without
JavaScript the picker never appears and all seven days stay visible, so nothing is hidden
behind a control that is not there.

A full-screen booking panel opens from every CTA — service preselected from whichever
button you pressed, time slots, validation and a confirmation state.

## Two languages

**Albanian is the default.** A switch in the bar (and in the mobile menu) moves the whole
page between the two, and the choice is remembered — a visitor who picks English keeps
English on the next visit. With JavaScript off, or before the script runs, the served HTML
is the English source, so that is what a crawler and a link preview see; if Albanian link
previews matter, the `<title>`, `description` and `og:` tags in the head are the things to
translate. Translations are keyed by the **English source
string** rather than by invented ids, so there are no keys to keep in sync and nothing
can quietly fall back to a placeholder — an untranslated string simply stays in English
and is visible as such. A `data-sq` attribute on an element overrides the dictionary,
for the handful of words that mean different things in different places (*Movement* is a
section heading in one spot and a membership name in another).

Text that arrives after load — the class panel, the membership tier switcher, the booking
confirmation — is translated on its way into the DOM by a `MutationObserver`, so the
schedule's data attributes stay in English and keep working as keys. The booking
`<option>` elements carry explicit English `value`s for the same reason: only their labels
translate. Dates and availability counts are handled by pattern rather than by listing
thirty-one near-identical strings.

Proper nouns stay put: *DUA*, *Sheshi Wilson*, *Tiranë*, instructor names, prices, and the
discipline names Albanian studios already use in English — Reformer, Barre, Yoga, Vinyasa.

**The Albanian is mine, not a native speaker's.** It reads naturally to me and keeps the
voice of the English, but it should be read by someone from Tirana before this goes live.

## WhatsApp

A floating button appears once the hero is behind you and opens a small card with a
single action. The card also opens itself **once**, when the memberships section comes
into view — the point where someone is actually weighing it up rather than browsing.
Dismiss it and it stays dismissed for the session; it hides entirely while the booking
dialog or the mobile menu is open.

The link is `wa.me/355673803802` with the message prefilled, and the prefill follows the
page language, built at open and again at click so switching mid-visit is picked up:

- Shqip — *Përshëndetje! Dua të di më shumë për abonimet tuaja.*
- English — *Hello! I'd like to know more about your memberships.*

## Design system

**Palette** — the two colours the logo ships in. Cream `#FFFBEA` is the base surface and
the ink on every dark ground; wine `#7D2F49` is the label ink, the featured membership card
and the closing block, so the brand colour appears at three different scales rather than
once. Between them, `#F5E9DC` carries the alternating sections (barre + yoga, memberships,
testimonials), and the same wine driven to near-black — `#3B1522` / `#2A0E18` — is the body
ink and the deepest grounds, which keeps the shadows in the brand's own hue instead of
falling back to a neutral black. Every text pair clears WCAG AA: body 15.4:1, labels 8.5:1,
cream on wine 8.5:1. Only `--rose-mid`, the 1px dash before a plan bullet, sits below that,
and it carries no text.

**Logo** — `assets/img/logo-dua-{mark,lockup}.png` are alpha masks cut from the supplied
artwork by `tools/build-logo.py`, not coloured images. The stylesheet paints them with
`mask-image` plus `currentColor`, so one asset renders the mark in whatever colour its
context calls for — which the navigation needs, since it flips from cream over the hero to
wine once it sticks. The rule is wrapped in `@supports`, so a browser without mask support
falls back to the typeset wordmark underneath. Re-run the script against new artwork to
regenerate both files.

**Type** — Fraunces for display and DM Sans for everything else. The previous pairing was
a high-contrast Didone over a geometric sans, which is the exact combination that reads as
machine-generated luxury; Fraunces is a soft serif with real warmth and DM Sans is friendly
at small sizes. Everything scales with `clamp()`, so there is one continuous ramp rather
than breakpoint jumps.

**Restraint** — the small uppercase labels were tracked out to `.26em`, which is another
tell. All of it is roughly halved, the section eyebrows lost their `01 —` numbering, and
three purely abstract photographs (a lit wall, a shadow, a band of light) were cut because
they carried no information. Corners are softened to 14px on cards and images, 9px on
controls: enough to feel welcoming, not enough to look like a consumer app.

**Photography** — the hero, the reformer, barre and yoga frames, and every room in the
space section are the studio's own photographs. The remaining stock is down to a handful
of details and the massage section.

**Prices** are in Albanian lek, at levels that make sense for Tirana:
first class 990 ALL, drop-in 1,800 ALL, memberships 9,900 – 24,900 ALL / month.

## Motion

Every effect is driven from a single throttled `requestAnimationFrame` loop and only
ever writes `transform` and `opacity`.

- **Image reveals** — a mask wipes up while the photograph settles from 1.08 → 1.
- **Text parallax** — `REFORMER PILATES` in outline drifts horizontally against scroll.
- **Sticky + scrolling text** — one large image holds while *Strength. Control. Posture.
  Confidence. Movement.* pass it, each fading up as it reaches the centre line.
- **Horizontal scroll** — the rituals section pins and translates its track sideways
  (desktop); below 900px it degrades to a native snap carousel.
- **Micro-interactions** — buttons fill from below, links retract their underline,
  images ease in on hover, the nav solidifies once you leave the hero.

`prefers-reduced-motion: reduce` disables the drifting layers, the pinning and the intro
curtain, and shows all content immediately — the layout is unchanged.

## Responsive

Mobile is composed separately rather than squeezed: a full-screen serif menu, taller
image crops (including a different hero focal point so the room reads at 390px), stacked
memberships, single-column reformer copy, and swipeable carousels in place of pinned
horizontal scroll. Verified for zero horizontal overflow at 390 / 768 / 1024 / 1280 / 1512px.

## Accessibility

Skip link, landmark elements, alt text on every content image, focus-visible rings,
`aria-expanded` on the menu, Escape-to-close and a focus trap on the booking dialog,
and a reveal safety sweep so no content can be left invisible after a fast scroll.

## Notes

This is a design mockup. The booking form validates and confirms locally; it posts
nowhere. Photography is from [Unsplash](https://unsplash.com) under the Unsplash
License and stands in for a real brand shoot — a live build would replace it with
studio photography of the actual space.

---

## Deploying to Vercel

The site is static with `index.html` at the repo root, so there is **no build step** —
Vercel's zero-config "Other" preset serves it as-is. `vercel.json` is already in the
repo and sets cache headers (fonts immutable, images a day with stale-while-revalidate,
CSS/JS always revalidated so design tweaks show up immediately).

**From the dashboard** — Add New → Project → import `ssaraberberi/Women-wellness-center`.
Leave Framework Preset on *Other*, leave Build Command and Output Directory empty, and
set the production branch to `claude/tirana-wellness-studio-design-gtqxps` (or merge to
`main` first). Deploy.

**From the CLI**

```bash
npm i -g vercel
vercel login
vercel          # preview URL
vercel --prod   # production
```

One thing to change after the domain is live: `og:image` in `index.html` is a relative
path. Make it absolute (`https://your-domain/assets/img/hero-reformer-reach-1200.jpg`)
so the link preview renders when the site gets shared.


## What is live, and what is parked

The studio offers **reformer Pilates** and the **spa**, and has not opened yet, so
the page says so at full scale in the band under the hero. Barre, yoga and mat
Pilates are gone from the site entirely, as is the location block — the address
is not public, so the site says only *Tirana, Albania*.

Nothing on the page states a price, a class size, a piece of equipment count or
anything offered free of charge, and there is no way to book: the timetable, the
memberships and the booking form are all pre-launch. The **timetable** and
**memberships** sections keep their place and their ground and carry a short
"coming soon" line, so the rhythm of the scroll is unchanged when the real
content lands. The one action on the page is the WhatsApp card.

The schedule and booking JavaScript is still in `main.js` and inert by design —
every branch was already guarded, so it finds nothing and does nothing, and their
CSS is untouched. Both come back by restoring markup alone.

Deleted rather than parked, and recoverable from git: the community grid and its
photographs, the massage price list, the barre and yoga section, the class-detail
overlay, the location block, `tools/generate-schedule.py` (which would otherwise
put the timetable back over the coming-soon block on its next run) and
`tools/build-map.py`.

When editing this stylesheet, note that removing a rule means removing its whole
block, opening brace to closing brace. Dropping only the line that opens a
multi-line rule leaves its declarations orphaned, and every rule after that point
silently stops applying. `grep -c '{' / '}'` should stay balanced.
