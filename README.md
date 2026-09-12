# Beci — movement & recovery studio, Tiranë

A production-ready homepage mockup for a women-focused studio on
**Sheshi Wilson, Tiranë** — Reformer Pilates, barre, yoga and massage.

**Beci** is short, lowercase and a little familiar — named the way people actually
refer to the places they go every week, not the way a wellness brand names itself.
The tone follows: confident, specific, occasionally funny, never reverent. Nobody
here is going to call anything a journey.

Open `index.html` in a browser. No build step, no dependencies, no network required —
fonts and photography are served from `assets/`.

---

## What's here

```
index.html                  the full homepage
tools/generate-schedule.py  regenerates the timetable section from a data table
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
| 10 | Community | `@beci.studio` feed grid |
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

Proper nouns stay put: *Beci*, *Sheshi Wilson*, *Tiranë*, instructor names, prices, and the
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

**Palette** — pink, but grown up. Blush `#F8E9E6` is the base surface; petal `#F0D9D4`
carries the pink blocks (barre + yoga, memberships, testimonials); the dark sections are
plum-black `#2E2124` / `#1D1417` rather than coffee brown, so the shadows stay warm and
pink-leaning. Accents run rose `#D9A79E` through deep dusty rose `#8E5E57`, which is also
the label ink and the featured membership card — checked at 4.55:1 on blush, so the small
uppercase type is genuinely readable rather than decorative.

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
