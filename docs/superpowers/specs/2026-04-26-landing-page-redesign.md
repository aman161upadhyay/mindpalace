# Landing Page Redesign — Mind Palace
**Date:** 2026-04-26
**Status:** Approved

---

## Overview

Redesign the Mind Palace landing page (`src/pages/Home.tsx`) with a luxurious, editorial aesthetic inspired by intellectual culture — readers, learners, people who care about compounding knowledge. Build two variants (A and B) for local comparison before selecting one for production.

Language throughout uses elevated vocabulary: **marginalia**, **sparks**, **relics**, **soul notes** instead of plain "highlights."

---

## Shared Foundation

### Colors

| Mode | Background | Primary (Moss Green) | Dark Green Text | Glow |
|------|-----------|---------------------|-----------------|------|
| Light | `#f7f5f0` | `#4e6a57` | `#2d3d35` | `rgba(78,106,87,0.12)` |
| Dark | `#0e1110` | `#4e6a57` | `#f5f6f5` | `rgba(78,106,87,0.15)` |

Dark mode uses the existing `[data-theme="dark"]` system. A large radial moss green glow gradient bleeds softly through hero and section backgrounds in dark mode.

### Typography
- **Headings:** Playfair Display (already loaded via Google Fonts)
- **Body:** Inter
- **Labels / captions / mono:** JetBrains Mono

### Navigation (fixed, glass blur)
- Left: logo (Lucide `Leaf` or `BookOpen` icon + "Mind Palace" in Playfair Display)
- Right: `Contact` (text link) · `Sign in` (if unauthenticated) or `Open Mind Palace` (if authenticated) as a pill button in moss green
- Background: `bg-background/80 backdrop-blur-xl`, border bottom `border-border/50`

### Typing Animation (Hero)
Two lines rendered sequentially on page load:

- **Line 1:** cursor (`|` in moss green, blinking) pinned at the **left** edge. Text grows rightward character by character.
  Text: *"Every idea you've ever read,"*
- **Line 2** (below, slightly right-offset via `pl-8` or similar): cursor pinned at the **right** end. Text grows leftward character by character.
  Text: *"remembered in one place."*

Speed: ~35–40ms per character. Cursor blinks at 500ms interval. Both lines animate **simultaneously** — line 1 grows rightward from left cursor, line 2 grows leftward from right cursor, both starting at the same moment. This creates the "written from both ends" visual. Implemented in React with `useEffect` + `useState`, no external library.

### Sections (both variants)
1. **Hero** — full viewport height, typing animation, CTA
2. **Sparks** — 3 sample marginalia quote cards
3. **Daily 5** — animated email preview, 5 sparks scrolling
4. **Footer**

### Contact Page (`/contact`)
New route rendered by `src/pages/Contact.tsx`. Minimal, centered layout. Content:

- Name: **Aman Upadhyay**
- Title: MBA Candidate 2027, Harvard Business School
- 2-line bio: *"Builder at the intersection of technology and human systems. Previously in medtech and healthcare AI."*
- Email: [aupadhyay@mba2027.hbs.edu](mailto:aupadhyay@mba2027.hbs.edu)
- LinkedIn: [linkedin.com/in/amanupadhyay](https://www.linkedin.com/in/amanupadhyay/)
- WhatsApp: `+13128267339` (link: `https://wa.me/13128267339`)
- Aesthetic: same moss green theme, single centered card, no clutter

### Routing
Add `/contact` and `/home-b` to `src/App.tsx`:
- `/` → `HomeA` (Approach A, replaces current `Home`)
- `/home-b` → `HomeB` (Approach B, for local comparison)
- `/contact` → `Contact`

---

## Approach A — Editorial Minimal

### Hero
- Full-width centered layout
- **Dark mode:** large moss green radial glow (600px blurred circle) centered behind heading
- **Light mode:** subtle glow, mostly negative space
- Heading: 96px Playfair Display, ~`text-7xl md:text-9xl`
- Typing animation below heading (see above)
- Below animation: thin horizontal rule (`1px` moss green, `w-16`), then a subline in JetBrains Mono italic small caps:
  *"Capture marginalia. Collect sparks. Build your relics."*
- CTA: single pill button — `Create Account` (unauthenticated) or `Open Mind Palace` (authenticated)

### Sparks Section
- Heading: *"Ideas worth keeping."* — centered, Playfair Display
- 3 quote cards, **staggered vertically**, each rotated `±2deg` (alternating), spaced with overlap
- Each card:
  - Off-white (`#f7f5f0`) background in light; near-black with `border border-primary/30` in dark
  - Large serif quote text, one key phrase underlined with a moss green `2px` underline (`decoration-primary`)
  - Author in JetBrains Mono, small, muted
  - Labeled with "spark" or "soul note" or "relic" in small moss green pill badge
- Sample quotes:
  1. *"The more you know, the more you realize you don't know."* — Aristotle · **spark**
  2. *"We do not read to escape life, but for life not to escape us."* — Anonymous · **soul note**
  3. *"You are not a drop in the ocean. You are the entire ocean in a drop."* — Rumi · **relic**

### Daily 5 Section
- Full-width block: `#1a2e22` (dark green) in both modes
- Centered email card (white, `rounded-2xl`, `shadow-2xl`, ~`max-w-sm`)
- Email card header: "Mind Palace · Daily Sparks" in mono, small
- Inside card: 5 spark preview rows, each with a truncated quote and a dot separator
- **Animation:** rows scroll upward in a continuous loop (`@keyframes scroll-up`), giving the feel of an inbox arriving
- Heading above card: *"5 sparks. Every morning."* — Playfair Display, white
- Subline: *"Your relics, revisited daily. A gentle nudge from your past self."*
- Feature pills below: `✦ 5 random marginalia` · `✦ Privacy first` · `✦ Unsubscribe anytime`

### Footer
- Single centered row
- Logo · `Contact` · `Sign in`
- Tagline below: *"Your marginalia, forever."* in mono, muted

---

## Approach B — Split Composition

### Hero
- **Left half** (60%): heading + typing animation, left-aligned
- **Right half** (40%): moss green radial gradient orb (`w-80 h-80 rounded-full blur-3xl`), with a floating quote fragment (`absolute`, centered in orb) that fades in after typing animation completes
- Subline left-aligned below heading: *"The next 50 years of what you read, in one place."*
- CTA: same pill button, left-aligned

### Sparks Section
- Heading: *"From curious minds."* — left-aligned, Playfair Display
- 3 cards in **clean 3-column grid** (`grid-cols-3`), no rotation, clean rectangles
- Same card content as A but no tilt — more structured, less romantic

### Daily 5 Section
- Same email animation as A
- Background: `bg-background` (off-white light / near-black dark) — no full green block
- Centered layout with more breathing room

### Footer
- Two columns: left = logo + *"Your marginalia, forever."*, right = `Contact · Sign in`

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/pages/Home.tsx` | Replace with Approach A |
| `src/pages/HomeB.tsx` | New — Approach B |
| `src/pages/Contact.tsx` | New — contact page |
| `src/App.tsx` | Add `/home-b` and `/contact` routes |
| `src/index.css` | Add `@keyframes scroll-up` for email animation |

---

## Out of Scope
- Chrome Web Store "Add to Chrome" button (added later)
- Testimonials, blog, FAQ sections
- Dark/light theme toggle on landing page (uses existing system theme)
- Mobile-specific layout (responsive but not mobile-first)
