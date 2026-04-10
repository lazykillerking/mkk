# MKK CTF Site - Developer Log

## Purpose

This file is the working technical map for the MKK site. It is not marketing copy. It exists to answer four questions quickly:

1. What files exist, and what category do they belong to?
2. What does each page actually do today?
3. Where does runtime state live?
4. What is real, what is placeholder, and what is risky?

This version was rewritten against the current source tree instead of preserving assumptions from earlier summaries.

---

## Project Snapshot

- Project type: static multi-page frontend
- Stack: HTML, CSS, vanilla JavaScript, Supabase browser client
- Routing model: folder-based static routes
- Auth model: Supabase email/password auth in the browser
- Persistent local app state: `localStorage`
- Shared profile backend: Supabase `public.users`
- Build step: none
- Required generation step: `npm run sync:env`

### Current top-level structure

```text
mkk/
|-- index.html
|-- register/index.html
|-- dashboard/index.html
|-- challenges/index.html
|-- profile/index.html
|-- profile/edit/index.html
|-- scoreboard/index.html
|-- css/
|-- js/
|-- profile/
|-- assets/
|-- scripts/
|-- DEV_LOG.md
|-- README.md
|-- package.json
|-- .env
|-- .gitignore
|-- CNAME
|-- skills-lock.json
```

### Directory Tree
.
├── assets
│   ├── fonts
│   └── hieroglyphics
│       ├── Alternian Alphabet
│       │   ├── lower case
│       │   └── upper case
│       ├── Dancing Men Cipher
│       ├── Enochian Alphabet
│       ├── Hylian Language
│       ├── Hymnos Alphabet
│       │   ├── lower-case
│       │   └── upper-case
│       ├── Unown Pokemon Alphabet
│       └── Wakanda Alphabet
│           ├── lower case
│           ├── numbers
│           └── upper case
├── challenges
├── css
├── dashboard
├── js
├── node_modules
│   ├── iceberg-js
│   │   └── dist
│   ├── @supabase
│   │   ├── auth-js
│   │   │   ├── dist
│   │   │   │   ├── main
│   │   │   │   │   └── lib
│   │   │   │   │       └── web3
│   │   │   │   └── module
│   │   │   │       └── lib
│   │   │   │           └── web3
│   │   │   └── src
│   │   │       └── lib
│   │   │           └── web3
│   │   ├── functions-js
│   │   │   ├── dist
│   │   │   │   ├── main
│   │   │   │   └── module
│   │   │   └── src
│   │   ├── phoenix
│   │   │   ├── assets
│   │   │   │   └── js
│   │   │   │       └── phoenix
│   │   │   └── priv
│   │   │       └── static
│   │   │           └── types
│   │   ├── postgrest-js
│   │   │   ├── dist
│   │   │   └── src
│   │   │       ├── select-query-parser
│   │   │       └── types
│   │   │           └── common
│   │   ├── realtime-js
│   │   │   ├── dist
│   │   │   │   ├── main
│   │   │   │   │   ├── lib
│   │   │   │   │   └── phoenix
│   │   │   │   └── module
│   │   │   │       ├── lib
│   │   │   │       └── phoenix
│   │   │   └── src
│   │   │       ├── lib
│   │   │       └── phoenix
│   │   ├── storage-js
│   │   │   ├── dist
│   │   │   │   └── umd
│   │   │   └── src
│   │   │       ├── lib
│   │   │       │   └── common
│   │   │       └── packages
│   │   └── supabase-js
│   │       ├── dist
│   │       │   └── umd
│   │       └── src
│   │           └── lib
│   │               └── rest
│   │                   └── types
│   │                       └── common
│   ├── tslib
│   │   └── modules
│   ├── @types
│   │   ├── node
│   │   │   ├── assert
│   │   │   ├── compatibility
│   │   │   ├── dns
│   │   │   ├── fs
│   │   │   ├── inspector
│   │   │   ├── path
│   │   │   ├── readline
│   │   │   ├── stream
│   │   │   ├── test
│   │   │   ├── timers
│   │   │   ├── ts5.6
│   │   │   │   └── compatibility
│   │   │   ├── ts5.7
│   │   │   │   └── compatibility
│   │   │   ├── util
│   │   │   └── web-globals
│   │   └── ws
│   ├── undici-types
│   └── ws
│       └── lib
├── profile
│   └── edit
├── register
├── scoreboard
├── scripts
├── tmp
└── users

### Route map

| Route | File | Access | Status |
|---|---|---|---|
| `/` | `index.html` | public | working login page |
| `/register/` | `register/index.html` | public | working signup page |
| `/forgot-password/` | `forgot-password/index.html` | public | working password recovery email request page |
| `/reset-password/` | `reset-password/index.html` | public | working password reset page for recovery links |
| `/dashboard/` | `dashboard/index.html` | protected | working |
| `/challenges/` | `challenges/index.html` | protected | working, local-only challenge system |
| `/profile/` | `profile/index.html` | protected | working |
| `/profile/edit/` | `profile/edit/index.html` | protected | working |
| `/scoreboard/` | `scoreboard/index.html` | protected | working dynamic user-registry page |
| `/users?username=...` | `users/index.html` | public | new view-only public profile page |

---

## Recent changes

- 2026-04-08: Added public profile viewer at `/users?username=...`.
- 2026-04-08: Fixed `/users?username=...` public profile page query to load `about` from `users` instead of `user_rankings`.
- 2026-04-08: Fixed score hydration on `/users?username=...` so the hero card and page stats show the same total.
- 2026-04-08: Updated scoreboard cards to link to the new public profile page.
- 2026-04-08: Added inline docs to scoreboard and public profile JS files.
- 2026-04-08: Removed hardcoded frontend SHA-256 admin password logic, replacing it with a dynamic Supabase `is_admin` role check.
- 2026-04-10: Added standalone `/forgot-password/` and `/reset-password/` recovery routes, plus the login-page recovery link.

---

## Documentation Audit

The previous `DEV_LOG.md` did a decent job on structure and breadth, but it was not fully faithful to the repo.

### What it got right

- The project is correctly framed as a static frontend with Supabase auth.
- The major page groupings were correct.
- The security concerns around client-side challenge logic were directionally correct.
- The file categories were useful and worth keeping.

### What needed correction

- It documented some assets as if they existed globally. `assets/favicon.ico` is referenced by pages but is not present in `assets/`.
- It described some modules as if they were active runtime dependencies. `js/feed.js` exists but is not referenced by any page.
- It blurred the line between real data and placeholder UI. The dashboard and scoreboard contain hardcoded display content alongside live auth/profile hydration.
- It treated a few behaviors as fully implemented platform features when they are still local-browser prototypes.

The rest of this file is the corrected version.

---

## Category 1: Root Files

### `index.html`

Public login page.

- Loads shared base/component/animation styles plus `css/auth.css`
- Loads generated public config from `js/env.js`
- Uses `js/auth.js` for login flow
- Includes an inline `Forgot Password?` link to `/forgot-password/`
- Redirects already-authenticated users through `redirectAuthenticatedUser()`
- Sends successful login to `/dashboard/`

### `forgot-password/index.html`

Public password recovery email request page.

- standalone route with no navbar or footer
- uses the shared base/component/animation styles plus a dedicated red recovery stylesheet
- loads Supabase from the CDN directly on the page
- submits `resetPasswordForEmail()` requests with redirect target `https://mkk.lazykillerking.xyz/reset-password/`
- renders status inline below the email field

### `reset-password/index.html`

Public password reset page reached from the Supabase recovery email.

- standalone route with no navbar or footer
- uses a dedicated recovery card and red-accent styling
- enables the form only after a valid Supabase recovery session is detected from the URL
- validates password length and confirmation client-side
- updates the password with `supabase.auth.updateUser()`
- redirects to `/dashboard/` after a successful password change

### `README.md`

Minimal repo entrypoint. It is not the source of truth for architecture.

### `DEV_LOG.md`

This file. Source-of-truth project notes and categorized file map.

### `package.json`

Contains only a small script surface:

- `sync:env`: generates `js/env.js` from `.env`
- `check:auth`: syntax-checks selected JS files with `node --check`

Dependency footprint is intentionally small:

- `@supabase/supabase-js`

### `.env`

Local source for public Supabase config.

Expected keys:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Important:

- These values are copied into browser-readable `js/env.js`
- This project does not use a private backend layer

### `CNAME`

Static hosting custom-domain config.

### `.gitignore`

Standard ignore file. Includes environment and dependency noise.

### `skills-lock.json`

Agent/tooling metadata. Not part of site runtime.

---

## Category 2: HTML Pages

### `register/index.html`

Signup page.

- Reuses auth-page layout from `css/auth.css`
- Collects username, email, password
- Uses `js/auth.js`
- Includes player-facing copy and a small terminal-style status block
- Redirect target after successful signup is `/dashboard/` when a session is returned immediately

Actual validation implemented in JS:

- username: 3-24 chars, letters/numbers/underscore
- email: standard email format
- email domain restriction: `@gmail.com` only
- password: minimum 8 chars

### `dashboard/index.html`

Protected landing page after auth.

Static and dynamic content are mixed here.

Dynamic:

- navbar identity
- joined date
- computed score
- computed solve count
- performance bars
- recent solves feed

Static or placeholder:

- leaderboard rows
- first-blood entries
- displayed rank delta and hints count

### `challenges/index.html`

Protected challenge board.

- category filters
- search
- challenge grid
- challenge detail modal
- dynamic admin mode visibility gated by Supabase users table `is_admin` role
- hidden admin panel for create/delete flows

This page is the heaviest client-side app surface in the repo.

### `profile/index.html`

Protected profile page.

- identity hero
- SVG avatar block
- exportable hacker card
- heatmap area
- stat tiles
- badge strip
- category breakdown
- sortable/filterable solve history table

Also pulls in:

- `html2canvas` from CDN
- `profile/profile.js`

### `profile/edit/index.html`

Protected profile editor.

- live preview card
- username, first name, last name, country, bio fields
- username and bio counters
- cancel/save actions

This page uses a dedicated stylesheet and an ES module controller.

### `scoreboard/index.html`

Protected scoreboard route that now serves as the platform's dynamic user-registry page.

- shared nav shell
- shared footer
- boot-sequence intro
- hero metrics for total users, active users, solver count, and current-user rank
- live search and client-side filter pills
- top-three podium section
- paginated infinite-scroll registry grid
- empty, loading, and end-of-list states

Important detail:

- the route path and nav label remain `Scoreboard`
- the content is now backed by Supabase `public.users`
- it now includes `js/countdown.js`, `js/countup.js`, and `css/users.css`

---

## Category 3: Shared Runtime and Infrastructure

### `js/env.js`

Generated file. Seeds `window.__PUBLIC_ENV__`.

- browser-readable
- should not be edited manually
- currently committed in the repo

### `js/supabase.js`

Browser Supabase bootstrap.

- imports `createClient` from jsDelivr ESM
- reads values from `window.__PUBLIC_ENV__`
- creates a shared client with:
  - `persistSession: true`
  - `autoRefreshToken: true`
  - `detectSessionInUrl: true`
  - `storageKey: "mkk-auth"`
- exports:
  - `supabase`
  - `requireSupabaseClient()`
  - `getSupabaseConfigError()`

### `js/session.js`

Shared auth/session/profile helper layer.

Key responsibilities:

- get authenticated user
- validate usernames
- check username availability
- ensure a `users` profile row exists
- fetch current profile
- protect routes
- populate shared auth UI
- bind logout buttons
- redirect signed-in users away from public auth pages
- update profile rows

Important contract:

- profile storage is assumed to be the `public.users` table
- profile recovery can fall back to `user.user_metadata.username`

### `js/auth.js`

Public auth page controller for both login and signup pages.

- binds whichever form exists on the current page
- performs client-side validation
- maps Supabase errors to friendlier messages
- runs `signInWithPassword()` for login
- runs `signUp()` for registration
- creates the profile row immediately when signup returns a session
- otherwise defers profile creation until first authenticated session

### `forgot-password/forgot-password.js`

Standalone recovery-email request controller.

- initializes a direct Supabase browser client from the CDN global
- validates the submitted email format
- requests password recovery mail with `resetPasswordForEmail()`
- sends users back to `https://mkk.lazykillerking.xyz/reset-password/`
- renders inline success/error feedback on the page

### `reset-password/reset-password.js`

Standalone password-reset controller used by recovery links.

- initializes a direct Supabase browser client with URL-session detection enabled
- waits for `PASSWORD_RECOVERY` or an existing recovery session before enabling the form
- computes a three-state password strength indicator
- validates password length and confirmation match
- updates the password with `supabase.auth.updateUser()`
- redirects to `/dashboard/` after success

---

## Category 4: Page Controllers in `js/`

### `js/dashboard-page.js`

Dashboard hydration module.

- route guard via `requireAuth()`
- navbar hydration
- pulls solved state and challenge state from `localStorage`
- computes stats with `getUserStats()`
- updates score and solve widgets
- builds top five category bars
- builds recent solves feed
- subscribes to Supabase realtime updates for the current user row

Important nuance:

- score shown on the dashboard prefers locally computed total solve points over `profile.score`

### `js/profile-page.js`

Profile hydration module.

- route guard via `requireAuth()`
- navbar hydration
- fills visible username/about/joined text
- reads local solve/challenge state
- computes stats
- hands control to `window.initProfileData()` from `profile/profile.js`
- subscribes to realtime profile updates
- removes the loading class when boot is complete

### `js/challenges-page.js`

Thin protected-page bootstrap for the challenges route.

- route guard
- navbar hydration
- logout binding

Challenge rendering itself lives in `js/challenges.js`.

### `js/scoreboard-page.js`

Dynamic scoreboard/user-registry controller.

- route guard via `requireAuth()`
- navbar hydration
- Supabase count queries for total users, active users, solver count, and current-user rank
- paginated user fetches from `public.users`
- client-side search and pill filters
- infinite scroll batching
- podium and registry-card rendering
- realtime refresh subscription for `public.users`

Important nuance:

- the page still lives on the `/scoreboard/` route even though the UI behavior is a user registry
- card/profile links target `/profile/{username}`

---

## Category 5: Feature Modules

### `js/challenges.js`

Largest single logic file in the repo.

Runtime model:

- self-executing browser script
- all challenge state held in one in-memory `state` object
- persistence through `localStorage`

Storage keys:

- `mkk_ctf_challenges_static`
- `mkk_ctf_challenges_solved`

Implemented behavior:

- 8 seeded default challenges
- categories: `WEB`, `CRYPTO`, `FORENSICS`, `PWN`, `REVERSE`, `MISC`, `OSINT`, `WELCOME`
- search by challenge name
- category filtering
- challenge modal
- client-side flag verification
- solved-state tracking with timestamps
- dynamic admin mode gated by Supabase profile `is_admin`
- challenge create/delete flows in the browser

Important reality check:

- this is a frontend-only prototype system, not a secure competition backend

### `js/stats.js`

Shared stat engine for dashboard and profile.

Computes:

- total solves
- solve rate
- per-category totals and percentages
- best streak
- total score

Notable rule:

- `WELCOME` challenges are excluded from solve-rate and category analytics

### `js/nav.js`

Shared header interaction layer.

- mobile nav toggle
- outside-click close
- escape close
- breakpoint reset behavior

### `js/countdown.js`

Dual-purpose shared behavior.

- updates `[data-countdown]`
- toggles header scroll styling for elements using `data-scroll-header`

The countdown is not event-driven. It is a page-timer UX effect.

### `js/countup.js`

Reusable number animation helper.

- animates values on nodes with countup data attributes
- exposes `window.runCountUp`

### `js/bars.js`

Shared progress-bar animation helper.

- animates based on `data-bar-width`
- used by dashboard and profile visualizations

### `js/feed.js`

Present in repo but currently not wired into any page.

Treat as dormant or leftover scaffolding until a page actually imports it.

---

## Category 6: Profile Feature Bundle

### `profile/profile.js`

Non-module script exposing profile-page hydration behavior through `window.initProfileData`.

Major features:

- hero-card parallax
- category bars
- radar chart SVG
- solve activity heatmap
- tooltip behavior
- copy-card image export flow
- sortable history table
- search filter over history rows
- badge strip rendering

### `profile/profile.css`

Profile page styling layer.

- hero layout
- avatar presentation
- hacker card styling
- heatmap grid
- history table
- category section
- badges strip

### `profile/edit/edit.js`

ES module controller for the edit page.

- route guard
- navbar hydration
- preload form from `auth.profile`
- live username preview
- live bio preview
- client-side username validation
- calls `updateUserProfile()`
- redirects back to `/profile?success=profile_updated`

### `profile/edit/edit.css`

Styling for the edit view.

- split layout
- preview card
- input states
- counters
- action buttons

---

## Category 7: Shared Styles

### `css/base.css`

Global foundation.

- reset/base styles
- font-face declarations
- design tokens
- body/page shell
- footer
- utility-like shared primitives

### `css/components.css`

Reusable UI blocks.

- navbar
- glass cards
- buttons
- challenge cards
- modals
- shared sections used across pages

### `css/animations.css`

Animation helpers.

- reveal classes
- stagger timing classes
- shared motion effects

### `css/auth.css`

Auth-page-specific layout and styles.

- public header variant
- hero/panel split
- form layout
- validation states
- action buttons
- inline recovery-link styling for the login page

### `forgot-password/forgot-password.css`

Forgot-password-specific styling layer.

- standalone centered layout
- red recovery palette
- single-card form treatment
- inline status feedback styles

### `reset-password/reset-password.css`

Reset-password-specific styling layer.

- standalone centered layout
- red recovery card treatment
- password strength meter styles
- toggle-button and submit-state styling

### `css/users.css`

Scoreboard user-registry styling layer.

- boot-sequence placement/fade
- hero summary layout
- search/filter pill styling
- podium card variations
- registry card layout and states
- infinite-scroll loader and end-state styling

---

## Category 8: Assets

### `assets/fonts/`

Available font files:

- JetBrains Mono
- Inter
- Montserrat
- Petrona
- Hey Comic

Important note:

- not every available font is actually used by the CSS

### `assets/hieroglyphics/Hylian Language/`

PNG glyph set used decoratively in footers and profile cards.

Observed use:

- GOODLUCK footer sequences
- MKK sequence on profile card
- EDIT sequence on profile edit preview

### Missing asset mismatch

All pages reference:

- `/assets/favicon.ico`

But that file is not present in the current `assets/` tree.

---

## Category 9: Tooling and Scripts

### `scripts/generate-env.mjs`

Generates `js/env.js` from `.env`.

Behavior:

- resolves project root relative to script location
- parses a simple key/value `.env`
- only copies public keys
- throws if `.env` is missing
- writes a browser global assignment

This is the only required project generation step.

---

## Runtime Data Model

### Supabase-side data

Expected table:

- `public.users`

Observed fields used by the frontend:

- `id`
- `username`
- `score`
- `created_at`
- `solves_count`
- `last_active_at`
- `first_name`
- `last_name`
- `country`
- `about`
- `is_admin`

### Browser-side data

`localStorage` keys:

- `mkk-auth`: Supabase auth persistence
- `mkk_ctf_challenges_static`: challenge definitions
- `mkk_ctf_challenges_solved`: solved challenge ids/timestamps

### Solve record shape

Current frontend normalizes solves toward:

```js
{ id: "challenge-id", timestamp: "ISO-8601 string" }
```

Legacy string or numeric solve ids are still tolerated and upgraded in-place.

---

## Auth and Security Notes

### What is actually protected

- route access to dashboard, challenges, profile, profile edit, scoreboard
- profile reads and updates through Supabase
- session persistence through Supabase browser auth

### What is not secure

- admin challenge management is client-side only (requests are not validated back-end yet)
- challenge answers exist in browser-readable code/state
- challenge CRUD is stored in `localStorage`
- solve history can be tampered with locally
- score computation is mostly local and therefore not authoritative

### Supabase-specific concerns

- `public.users` must use correct RLS policies
- profile creation assumes the authenticated user can insert their own row
- username availability checks are best-effort and intentionally tolerant of RLS restrictions

---

## What Is Placeholder vs Real

### Real enough for local use

- login
- signup
- logout
- profile creation and update
- protected-route bootstrapping
- local challenge board interactions
- profile visualizations from local solve data
- realtime profile row refresh from Supabase updates

### Placeholder or partially mocked

- dashboard leaderboard standings
- dashboard first-blood feed
- dashboard rank position
- dashboard hints tile
- any notion of server-authoritative challenge solves or rankings

---

## Development Workflow

### Install

```bash
npm install
```

### Generate browser config

```bash
npm run sync:env
```

### Syntax check the selected auth/runtime files

```bash
npm run check:auth
```

### Local developer checklist

1. Make sure `.env` exists.
2. Run `npm run sync:env`.
3. Confirm `js/env.js` contains public config.
4. Verify Supabase Auth is enabled for email/password.
5. Verify `public.users` exists with compatible RLS policies.

---

## Current Risks and Gaps

- `assets/favicon.ico` is referenced but missing.
- `js/feed.js` appears unused.
- No automated tests.
- No bundling/minification pipeline.
- No server-side challenge validation.
- Countdown is cosmetic, not tied to an event record.
- Large challenge logic lives in one browser file.

---

## Recommended Next Documentation Rule

When this repo changes, update this file only with behavior verified from source. Do not document intended features as if they already ship.

---

Last verified against current tree: April 10, 2026
Last updated: April 10, 2026
