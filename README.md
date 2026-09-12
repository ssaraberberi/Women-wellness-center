# DRITA — boutique movement & recovery studio, Tiranë

A production-ready homepage mockup for a women-focused boutique wellness studio on
**Sheshi Wilson, Tiranë** — Reformer Pilates, barre, yoga and massage under one roof.

`drita` is Albanian for *the light*. The whole design is built around that: warm ivory,
deep windows, architectural shadow, and a lot of quiet.

Open `index.html` in a browser. No build step, no dependencies, no network required —
fonts and photography are served from `assets/`.

---

## What's here

```
index.html                  the full homepage
assets/css/styles.css       design system + every section
assets/css/fonts.css        self-hosted @font-face declarations
assets/fonts/               Bodoni Moda + Jost (woff2, latin + latin-ext)
assets/img/                 31 photographs, sized and compressed per slot
assets/js/main.js           scroll motion, gallery, booking, menu (vanilla, ~16 KB)
```

## Page structure

| # | Section | Idea |
|---|---------|------|
| 1 | Hero | *Make space for yourself.* Full-bleed, parallax, minimal nav |
| 2 | The experience | *More than a workout.* Asymmetric editorial grid + studio facts |
| — | Four rituals | Vertical scroll drives a horizontal reveal: Reformer → Barre → Yoga → Massage |
| 3 | Reformer | The signature service: oversized drifting type, sticky image, scrolling words |
| 4 | Barre + Yoga | Offset split with an atmospheric full-bleed band |
| 5 | Recovery | Mood shift — dark, warm, intimate; treatments and prices |
| 6 | Memberships | Three tiers, Reformer switchable 8 / 12 / 16, Wellness featured |
| 7 | The studio | Draggable cinematic gallery with a progress bar |
| 8 | In their words | Lifestyle testimonials, sticky lead quote |
| 9 | Community | `@drita.studio` feed grid |
| 10 | Final CTA | *Your new ritual starts here.* |

A full-screen booking panel opens from every CTA — service preselected from whichever
button you pressed, time slots, validation and a confirmation state.

## Design system

**Palette** — warm ivory `#F7F3EE`, soft stone `#EAE2D8`, taupe `#B4A392`,
espresso `#2A2320` / `#191411`, dusty rose accent `#C9A79C`.
Ink colours are set so small uppercase labels clear 4.5:1 on their backgrounds.

**Type** — Bodoni Moda for display (a true Didone: high contrast, fashion-editorial),
Jost 200–500 for navigation, labels and body. Everything scales with `clamp()`,
so there is one continuous type ramp rather than breakpoint jumps.

**Prices** are in Albanian lek, at levels that make sense for Tirana:
first class 990 ALL, drop-in 1,800 ALL, memberships 9,900 – 24,900 ALL / month.

## Motion

Every effect is driven from a single throttled `requestAnimationFrame` loop and only
ever writes `transform` and `opacity`.

- **Hero parallax** — the image drifts at 0.22× page speed; the headline stays put.
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
