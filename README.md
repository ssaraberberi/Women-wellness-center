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
assets/img/                 31 photographs, sized and compressed per slot
assets/js/main.js           scroll motion, gallery, booking, menu (vanilla, ~16 KB)
```

## Page structure

| # | Section | Idea |
|---|---------|------|
| 0 | Opening | A full-screen image that disintegrates under your scroll |
| 1 | Hero | *Move like you mean it.* Revealed as the fragments clear |
| 2 | The experience | *The best hour of your week.* Asymmetric editorial grid + studio facts |
| — | Four rituals | Vertical scroll drives a horizontal reveal: Reformer → Barre → Yoga → Massage |
| 3 | Reformer | The signature service: oversized drifting type, sticky image, scrolling words |
| 4 | Barre + Yoga | Offset split with an atmospheric full-bleed band |
| 5 | Recovery | *You've earned the dark room.* Mood shift — plum, warm, intimate |
| 6 | Schedule | The full week, 31 classes; tap any one for instructor, level and availability |
| 7 | Memberships | Three tiers, Reformer switchable 8 / 12 / 16, Wellness featured |
| 8 | The studio | Draggable cinematic gallery with a progress bar |
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

## Design system

**Palette** — pink, but grown up. Blush `#F6E9E6` is the base surface, petal `#F0D9D4`
carries the two pink blocks (memberships and testimonials), and the dark sections are
plum-black `#2E2124` / `#1D1417` rather than coffee brown, so the shadows stay warm and
pink-leaning. Accents run rose `#D9A79E` through deep dusty rose `#8E5E57`, which is also
the label ink — checked at 4.55:1 on blush, so the small uppercase type is genuinely
readable rather than decorative. A soft-light rose veil sits over the hero and the dark
carousel so the photography lives inside the palette instead of next to it.

**Type** — Bodoni Moda for display (a true Didone: high contrast, fashion-editorial),
Jost 200–500 for navigation, labels and body. Everything scales with `clamp()`,
so there is one continuous type ramp rather than breakpoint jumps.

**Prices** are in Albanian lek, at levels that make sense for Tirana:
first class 990 ALL, drop-in 1,800 ALL, memberships 9,900 – 24,900 ALL / month.

## The opening

The landing viewport is given over entirely to one image — a wide shot of the room —
which comes apart as you scroll and reveals the hero underneath. The hero section grows
to three viewports so its stage can stay pinned while the image travels through it.

How it works: the opening image is painted into an offscreen canvas, cover-fitted to the
viewport, and cut into a grid of roughly a thousand tiles. Scrolling drives one value
from 0 to 1. Early on the whole field pushes in; from about 0.14 a wave sweeps outward
from a focal point, and each tile it reaches is thrown along its own radial vector,
rotating and fading as it goes. Tiles carry real image content, so what flies apart is
the photograph itself rather than a texture standing in for it.

Three details do most of the work:

- **Depth.** Every tile belongs to one of three bands. Near tiles leave earliest, travel
  furthest and swell past the camera; far tiles recede and shrink. A faster, shallower
  layer of dust drifts in front of all of it.
- **A readable front.** The wave is ordered radially but jittered, so it has a distinct
  travelling edge rather than a clean expanding circle — a circle reads as a wipe, a
  ragged edge reads as something breaking.
- **Contrast.** Both layers are the same warm room, so the hero underneath is held in
  shadow and brightens as it is uncovered. Without that the fragments have nothing to
  read against and the whole effect flattens.

Progress is lerped toward the scroll position rather than taken from it directly, so
trackpad jitter never reaches the animation while the motion stays tied to the scroll.
Before the wave starts, a single `drawImage` covers the frame; per-tile drawing only
begins once tiles actually diverge, and each tile's matrix is composed by hand so the
loop makes no `save`/`restore` calls. Measured at a locked 60fps on both desktop and
phone viewports, with no dropped frames through the full sweep.

Phones get a shorter run (2.4 viewports instead of 3), coarser tiles, less rotation and
a third of the dust.

**If anything is unavailable it simply does not happen.** `prefers-reduced-motion`, no
JavaScript, no canvas, or an image that fails to load all leave a normal one-viewport
hero with its headline in place — the tall section is only applied once the opening is
known to work. Hero buttons are set to `visibility: hidden` until they are actually on
screen, so they never sit invisible in the tab order.

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

`prefers-reduced-motion: reduce` disables parallax, pinning and the intro curtain, and
shows all content immediately — the layout is unchanged.

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
