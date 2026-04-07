# MKK Developer Log

## Overview

This repository is a static multi-page frontend for an MKK CTF site. There is no backend in this repo. Most behavior is driven by hand-authored HTML plus small browser-side JavaScript files.

Supabase Auth has now been added on the frontend side. The repo still remains a static site, but browser sessions, protected routes, and player profile hydration now depend on a configured Supabase project plus the `public.users` table.

The site has five visible routes:

- `/` is now the public login entry page.
- `/register` is the public signup page.
- `/dashboard` is the main authenticated landing page with stats, standings, performance bars, and a recent solves feed.
- `/challenges` is a local challenge browser with category filters, a detail modal, local flag submission, and a local-only admin mode.
- `/profile` is the most interactive page. It contains the boot animation, activity heatmap, sortable history table, parallax hacker card, and clipboard export.
- `/scoreboard` is currently just a placeholder page with shared header/footer styling.

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
│   ├── auth.css                Login/register page layout and form styling
│   ├── base.css                Global tokens, fonts, resets, layout shell, footer
│   └── components.css          Shared nav/cards plus challenge-page-specific components
├── dashboard/
│   └── index.html              Dashboard page markup
├── js/
│   ├── auth.js                 Login/signup form controller shared by `/` and `/register`
│   ├── bars.js                 Width animation bootstrap for `[data-bar-width]`
│   ├── challenges.js           Full client-side challenge app and admin flow
│   ├── challenges-page.js      Challenges-only auth/profile hydration (mirrors dashboard-page.js)
│   ├── countdown.js            Header scroll state + relative countdown timer
│   ├── countup.js              Animated numeric counters for `[data-countup]`
│   ├── dashboard-page.js       Dashboard-only auth/profile hydration
│   ├── env.js                  Generated browser-readable public config from `.env`
│   ├── feed.js                 Small placeholder hook for the solve feed
│   ├── nav.js                  Shared mobile nav behavior
│   ├── profile-page.js         Profile-only auth/profile hydration
│   ├── scoreboard-page.js      Scoreboard-only auth/profile hydration
│   ├── session.js              Shared auth guard, logout, and profile-loading helpers
│   ├── stats.js                Shared utility for computing player stats from localStorage
│   └── supabase.js             Shared Supabase client bootstrap
├── profile/
│   ├── index.html              Profile page markup
│   ├── profile.css             Profile-only layout and effects
│   └── profile.js              Profile-only interactions
├── register/
│   └── index.html              Dedicated signup page markup
├── scoreboard/
│   └── index.html              Scoreboard placeholder markup
├── scripts/
│   └── generate-env.mjs        Generates `js/env.js` from `.env`
├── .gitignore                  Standard ignore rules
├── .env                        Public Supabase config source file
├── CNAME                       Custom domain mapping for static hosting
├── DEV_LOG.md                  This onboarding file
├── index.html                  Root login page
└── README.md                   Short repo entry point
```

## Shared Frontend Architecture

- `css/base.css` defines the site's design tokens, font-face declarations, body background, common shell sizing, and shared footer treatment.
- `css/components.css` holds the reusable UI pieces: fixed header, responsive nav, glass cards, dashboard layouts, and the entire challenges page component set.
- `css/animations.css` is intentionally small and only contains reusable animation classes and keyframes.
- `css/auth.css` styles the login/register surfaces, button pairs, feedback rows, and auth-specific layout.
- `js/nav.js` is safe to include on every page. It no-ops if the nav shell is missing.
- `js/countdown.js` also handles two concerns: header scroll styling and the countdown pill. The countdown is relative to page load, not tied to a real event timestamp.
- `js/countup.js` animates numbers by scanning for `data-countup`.
- `js/bars.js` animates bars immediately on load. On the profile page, `profile.js` overrides that behavior for some bars with scroll-triggered animation.
- `js/supabase.js` creates the shared browser-side Supabase client using the generated public config in `js/env.js`.
- `js/session.js` contains the cross-page auth layer: route protection, profile fetching, logout, and navbar hydration helpers.
- `js/stats.js` provides centralized helper functions to compute player performance from raw localStorage solves.
- `js/auth.js` powers both public entry pages. It logs users in on `/` and signs them up on `/register`.

## Auth Setup

- This is still a static frontend, so the browser cannot read `.env` directly.
- `.env` is used as the developer-facing source file.
- `npm run sync:env` runs `scripts/generate-env.mjs`, which converts the public values in `.env` into `js/env.js`.
- Only two values should be exposed to the browser:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- Never place the Supabase service-role key in this repo or in `js/env.js`.

## Auth and Session Flow

- `/` is now the login page.
- `/register` is the signup page.
- `js/auth.js` is loaded by both pages and only binds the form that exists on the current route.
- Login uses `supabase.auth.signInWithPassword`.
- Signup uses `supabase.auth.signUp`.
- After signup, the frontend attempts to create a matching row in `public.users` with:
  - `id = auth user id`
  - `username = submitted username`
  - `score = 0`
- If email confirmation is enabled in Supabase, the profile row may instead be created on first authenticated login because no session exists yet.
- `js/session.js` provides `requireAuth()`, which redirects unauthenticated users back to `/`.
- Protected pages currently include:
  - `/dashboard`
  - `/challenges`
  - `/profile`
  - `/scoreboard`
- Navbar username/score placeholders are hydrated from the logged-in user's `public.users` row.
- The navbar power button is now used as the logout control.

## Page Notes

### Root Login (`/`)

- `index.html` is now a real page, not a redirect.
- It contains the login form plus a secondary button that routes to `/register`.
- On successful login, the user is redirected to `/dashboard`.

### Register (`/register`)

- `register/index.html` is the dedicated signup page.
- It collects `username`, `email`, and `password`.
- On successful signup with an immediate session, the user is redirected to `/dashboard`.
- On successful signup without an immediate session, the page shows a confirmation message and then sends the user back to `/` to log in after email verification.

### Dashboard

- Mostly static HTML with shared JS for counters, bars, nav, and timer.
- The page is auth-protected and hydrates the current username, score, and join date from Supabase.
- "Your Performance" bars and "Your Recent Solves" are automatically populated from the user's `localStorage` solves using `js/stats.js`.
- Standings and first-blood items remain hardcoded sample content due to lack of a multiplayer backend.
- The footer uses glyph images from `assets/hieroglyphics/Hylian Language/`.

### Challenges

- `js/challenges.js` is the only substantial app-like script in the repo.
- The page is now **auth-protected**. `js/challenges-page.js` runs `requireAuth()` before the challenge board renders, redirecting unauthenticated users to `/`.
- The navbar on this page now uses the same dynamic pattern as every other page: countdown pill, `[data-auth-username]` / `[data-auth-score]` user chip, and a logout button all populated by `populateAuthUI()` and `bindLogoutButtons()` from `js/session.js`.
- All challenge data lives in the browser. `DEFAULT_CHALLENGES` seeds the page, then localStorage takes over.
- Admin mode is not secure. It uses a client-side password hash check and only hides/reveals UI in the browser.
- Flag submissions are also browser-local. Solved state is stored under `mkk_ctf_challenges_solved`.
- This means challenge creation, deletion, and solve counts are mock/demo behavior, not authoritative server data.

### Profile

- The page now loads its layout instantly as a skeleton shell, without the legacy artificial boot delays.
- A dedicated edit portal exists at `profile/edit/index.html` where users can modify their profile details (Username, First Name, Last Name, Country, About). The interface enforces live validation (via `validateUsername` mapped in `js/session.js`) and limits bio input using an active character counter.
- `js/profile-page.js` retrieves the logged-in user profile, local browser solves, and heavily orchestrates dynamic hydration of stats (including dynamic `data-profile-about` bio updates).
- The profile stats, heatmap, history table, and category radar chart are dynamically built based on actual solves rather than being mocked HTML.
- `profile/profile.js` encapsulates the generation functions and exposes `window.initProfileData` which `profile-page.js` triggers when data is ready.
- "Copy Card" depends on the CDN `html2canvas` script loaded in `profile/index.html`. This script is explicitly deferred to prevent blocking the initial HTML rendering.
- The profile card's Hylian glyph strip reuses the shared `.glyph-line` treatment in `profile/index.html`, with card-scoped overrides in `profile/profile.css` to keep the inversion readable against the darker card background.

### Scoreboard

- This page is currently a stub. It reuses shared layout and navigation but does not yet implement a scoreboard table or data source.
- It is auth-protected so the current session populates the navbar and logout control.
- The standard site footer (Hylian glyphs, copyright) has been added to match the other pages.

## Data and State

- The only real external API layer is Supabase.
- There is no bundler.
- There is no framework.
- There is no server-side rendering in this repo.
- Runtime state now exists in two places:
  - Supabase Auth session storage in the browser
  - browser localStorage on the challenges page

Relevant localStorage keys:

- `mkk-auth`: Supabase auth session cache for the static frontend
- `mkk_ctf_challenges_static`: full current challenge list after admin edits
- `mkk_ctf_challenges_solved`: array of objects `{id, timestamp}` tracking challenges solved in the current browser

## Developer Expectations

- Treat this as a static site first. Most changes should be plain HTML/CSS/JS.
- Shared styles belong in `css/base.css`, `css/components.css`, or `css/animations.css`.
- Auth-entry-specific styling belongs in `css/auth.css`.
- Profile-specific styling belongs in `profile/profile.css`.
- Page-specific JavaScript should stay small and isolated like `profile/profile.js`.
- Shared auth/session logic should stay in `js/session.js` and `js/supabase.js`, not be duplicated per page.
- If you expand the challenges app further, be careful not to present the current local-only auth or scoring behavior as real security.
- Binary assets under `assets/` were not annotated; they are consumed by the CSS and page markup directly.

## Gaps / Risks New Developers Should Know

- The countdown timer is fake-relative. Reloading the page resets it.
- Frontend signup/profile creation is convenient, but the strongest guarantees still belong in database constraints and Supabase-side automation.
- `js/env.js` is generated and intentionally browser-readable, so it must only contain public keys.
- The challenges admin password check is client-side only.
- The solve feed script is effectively a placeholder.
- The scoreboard route is incomplete (no real leaderboard data yet).
- Some page content is intentionally mock data for presentation rather than production data.

## Changelog

### 2026-04-07 — Frontend Sync & Auth Integration

- **Challenges page auth** — Added `js/challenges-page.js` (new file). The challenges page now calls `requireAuth()` before rendering, redirecting unauthenticated users to `/`. `populateAuthUI()` and `bindLogoutButtons()` hydrate the navbar dynamically.
- **Hardcoded username removed** — The static `lazykillerking | 1,234 pts` chip in `challenges/index.html` was replaced with the standard nav-meta block: countdown pill + `[data-auth-username]`/`[data-auth-score]` user chip + logout power button.
- **Scoreboard footer** — Added the shared Hylian-glyph footer to `scoreboard/index.html`, making all four inner pages consistent.
- **Login/register copy** — Dev-facing route descriptions replaced with player-facing marketing copy on both auth pages.
- **Register header** — Added `data-scroll-header` to `register/index.html` so the scroll-shrink behaviour is consistent with every other page.
- **Footer on challenges page** — The standard `site-footer` block was added below the challenge grid section.
