# MKK Developer Log

## Overview

This repository is a static multi-page frontend for an MKK CTF site. There is no backend in this repo. Most behavior is driven by hand-authored HTML plus small browser-side JavaScript files.

The site has four visible routes:

- `/dashboard` is the main landing page with stats, standings, performance bars, and a recent solves feed.
- `/challenges` is a local challenge browser with category filters, a detail modal, local flag submission, and a local-only admin mode.
- `/profile` is the most interactive page. It contains the boot animation, activity heatmap, sortable history table, parallax hacker card, and clipboard export.
- `/scoreboard` is currently just a placeholder page with shared header/footer styling.

The root `/` route only redirects to `/dashboard`.

## Folder Structure

```text
mkk/
├── assets/
│   ├── fonts/                  Shared local font files referenced by css/base.css
│   └── hieroglyphics/          Image glyphs used in the dashboard/profile/footer motifs
├── challenges/
│   └── index.html              Challenges page markup
├── css/
│   ├── animations.css          Shared keyframes and entrance animations
│   ├── base.css                Global tokens, fonts, resets, layout shell, footer
│   └── components.css          Shared nav/cards plus challenge-page-specific components
├── dashboard/
│   └── index.html              Dashboard page markup
├── js/
│   ├── bars.js                 Width animation bootstrap for `[data-bar-width]`
│   ├── challenges.js           Full client-side challenge app and admin flow
│   ├── countdown.js            Header scroll state + relative countdown timer
│   ├── countup.js              Animated numeric counters for `[data-countup]`
│   ├── feed.js                 Small placeholder hook for the solve feed
│   └── nav.js                  Shared mobile nav behavior
├── profile/
│   ├── index.html              Profile page markup
│   ├── profile.css             Profile-only layout and effects
│   └── profile.js              Profile-only interactions
├── scoreboard/
│   └── index.html              Scoreboard placeholder markup
├── .gitignore                  Standard ignore rules
├── CNAME                       Custom domain mapping for static hosting
├── DEV_LOG.md                  This onboarding file
├── index.html                  Root redirect page
└── README.md                   Short repo entry point
```

## Shared Frontend Architecture

- `css/base.css` defines the site's design tokens, font-face declarations, body background, common shell sizing, and shared footer treatment.
- `css/components.css` holds the reusable UI pieces: fixed header, responsive nav, glass cards, dashboard layouts, and the entire challenges page component set.
- `css/animations.css` is intentionally small and only contains reusable animation classes and keyframes.
- `js/nav.js` is safe to include on every page. It no-ops if the nav shell is missing.
- `js/countdown.js` also handles two concerns: header scroll styling and the countdown pill. The countdown is relative to page load, not tied to a real event timestamp.
- `js/countup.js` animates numbers by scanning for `data-countup`.
- `js/bars.js` animates bars immediately on load. On the profile page, `profile.js` overrides that behavior for some bars with scroll-triggered animation.

## Page Notes

### Dashboard

- Mostly static HTML with shared JS for counters, bars, nav, and timer.
- Standings, first-blood items, and solve feed are hardcoded sample content.
- The footer uses glyph images from `assets/hieroglyphics/Hylian Language/`.

### Challenges

- `js/challenges.js` is the only substantial app-like script in the repo.
- All challenge data lives in the browser. `DEFAULT_CHALLENGES` seeds the page, then localStorage takes over.
- Admin mode is not secure. It uses a client-side password hash check and only hides/reveals UI in the browser.
- Flag submissions are also browser-local. Solved state is stored under `mkk_ctf_challenges_solved`.
- This means challenge creation, deletion, and solve counts are mock/demo behavior, not authoritative server data.

### Profile

- The page starts with `body.profile-booting`, which hides the real content until `profile.js` finishes the boot sequence.
- The heatmap is generated from the `heatmapData` array in `profile/profile.js`.
- Heatmap month labels are generated dynamically from the same date helper used for each cell, so labels stay aligned with week columns even if the data range changes.
- The radar chart is static SVG in HTML, while the category bars are animated via CSS/JS.
- The solve history table is rendered in HTML and enhanced in JS with search and sorting.
- "Copy Card" depends on the CDN `html2canvas` script loaded in `profile/index.html`.
- The profile card's Hylian glyph strip reuses the shared `.glyph-line` treatment in `profile/index.html`, with card-scoped overrides in `profile/profile.css` to keep the inversion readable against the darker card background.

### Scoreboard

- This page is currently a stub. It reuses shared layout and navigation but does not yet implement a scoreboard table or data source.

## Data and State

- There is no API layer.
- There is no bundler.
- There is no framework.
- There is no server-side rendering in this repo.
- The only persisted runtime data is browser localStorage on the challenges page.

Relevant localStorage keys:

- `mkk_ctf_challenges_static`: full current challenge list after admin edits
- `mkk_ctf_challenges_solved`: challenge IDs solved in the current browser

## Developer Expectations

- Treat this as a static site first. Most changes should be plain HTML/CSS/JS.
- Shared styles belong in `css/base.css`, `css/components.css`, or `css/animations.css`.
- Profile-specific styling belongs in `profile/profile.css`.
- Page-specific JavaScript should stay small and isolated like `profile/profile.js`.
- If you expand the challenges app further, be careful not to present the current local-only auth or scoring behavior as real security.
- Binary assets under `assets/` were not annotated; they are consumed by the CSS and page markup directly.

## Gaps / Risks New Developers Should Know

- The countdown timer is fake-relative. Reloading the page resets it.
- The challenges admin password check is client-side only.
- The solve feed script is effectively a placeholder.
- The scoreboard route is incomplete.
- Some page content is intentionally mock data for presentation rather than production data.
