# MKK CTF Site - Developer Log

## What This File Is For

This is the working technical map for the MKK site.

Use it to answer these quickly:

1. What exists in the repo?
2. What does each route do right now?
3. Where does data live?
4. What is production-like, and what is still prototype territory?

This document is intentionally practical. It is not product copy.

Last verified against the current tree: April 13, 2026  
Last updated: April 13, 2026

---

## Project Snapshot

| Item | Value |
|---|---|
| Project type | Static multi-page frontend |
| Stack | HTML, CSS, vanilla JavaScript, Supabase browser client |
| Routing model | Folder-based static routes |
| Auth model | Supabase email/password auth in the browser |
| Shared profile backend | `public.users` |
| Persistent browser state | `localStorage` |
| Build step | None |
| Required setup step | `npm run sync:env` |

### Repo Shape

Only the active app structure is shown here. Vendor folders are intentionally omitted for readability.

```text
mkk/
|-- index.html
|-- register/
|-- forgot-password/
|-- reset-password/
|-- dashboard/
|-- challenges/
|-- profile/
|   |-- index.html
|   `-- edit/
|-- scoreboard/
|-- users/
|-- css/
|-- js/
|-- assets/
|-- scripts/
|-- DEV_LOG.md
|-- README.md
|-- package.json
|-- .env
`-- .gitignore
```

---

## Quick Route Map

| Route | File | Access | Current State |
|---|---|---|---|
| `/` | `index.html` | public | working login page |
| `/register/` | `register/index.html` | public | working signup page |
| `/forgot-password/` | `forgot-password/index.html` | public | working password recovery request page |
| `/reset-password/` | `reset-password/index.html` | public | working recovery reset page |
| `/dashboard/` | `dashboard/index.html` | protected | working |
| `/challenges/` | `challenges/index.html` | protected | working |
| `/profile/` | `profile/index.html` | protected | working |
| `/profile/edit/` | `profile/edit/index.html` | protected | working |
| `/scoreboard/` | `scoreboard/index.html` | protected | working dynamic user-registry page |
| `/users?username=...` | `users/index.html` | public | working public profile viewer |

---

## Recent Changes

| Date | Change |
|---|---|
| 2026-04-08 | Added public profile viewer at `/users?username=...`. |
| 2026-04-08 | Fixed `/users` page to load `about` from `users` instead of `user_rankings`. |
| 2026-04-08 | Fixed score hydration on `/users` so hero stats and page stats match. |
| 2026-04-08 | Updated scoreboard cards to link to the public profile page. |
| 2026-04-08 | Added inline docs to scoreboard and public profile JS files. |
| 2026-04-10 | Added standalone `/forgot-password/` and `/reset-password/` flows, plus the login recovery link. |
| 2026-04-11 | Replaced local default challenges with live Supabase-backed challenge loading in `js/challenges.js`. |
| 2026-04-13 | Fixed `/forgot-password/` to use the shared `js/env.js` + `js/supabase.js` path. |
| 2026-04-13 | Fixed `/reset-password/` so recovery session restoration, form unlock, sign-out, and redirect behave reliably. |
| 2026-04-13 | Tightened `/reset-password/` so expired or already-used email links fail closed instead of trusting an unrelated persisted session. |
| 2026-04-13 | Migrated flag verification to backend via `submit_flag` Postgres RPC, preventing frontend flag leakage. |
| 2026-04-13 | Transitioned stats and score calculation from local storage dependency entirely to the `solves` table and `user_rankings` view. |
| 2026-04-13 | Fixed `challenges.js` loader crashing by ensuring the frontend strictly queries existing columns (`id`, `title`, `description`, `category`, `points`) instead of mocking UI attributes from the DB schema. |
| 2026-04-13 | Enhanced error visibility in `challenges.js` to expose exact Supabase API errors (e.g. Postgres `UUID` vs `BIGINT` bindings) during flag submission. |
| 2026-04-14 | Completed backend rate limiting logic with `flag_attempts` tracking and dynamic penalties using Postgres functions. |
| 2026-04-14 | Fixed frontend `created_at` fetches on solves tables to correctly use `solved_at` in profile and dashboard logic. |

---

## At A Glance

### Real, Working Flows

- Login, signup, logout
- Password recovery request and reset
- Protected-route bootstrapping
- Profile creation and update
- Public profile viewing
- Supabase-backed user registry on `/scoreboard/`
- Supabase-backed challenge fetch
- Local solved-state tracking
- Realtime profile refresh from Supabase updates

### Still Prototype or Partly Mocked

- Dashboard leaderboard and first-blood sections
- Dashboard rank delta and hints display

---

## Page Guide

### `index.html`

Public login page.

- Loads shared styles plus `css/auth.css`
- Loads generated config from `js/env.js`
- Uses `js/auth.js`
- Includes `Forgot Password?` link to `/forgot-password/`
- Redirects authenticated users away from the page
- Sends successful login to `/dashboard/`

### `register/index.html`

Public signup page.

- Reuses the auth layout from `css/auth.css`
- Collects username, email, and password
- Uses `js/auth.js`
- Shows player-facing copy and a small terminal-style status area

Validation enforced in JS:

- Username: 3-24 chars, letters/numbers/underscore
- Email: standard format
- Email domain: `@gmail.com` only
- Password: minimum 8 chars

### `forgot-password/index.html`

Public recovery email request page.

- Standalone page with no navbar or footer
- Uses shared styles plus `forgot-password/forgot-password.css`
- Loads `js/env.js`
- Loads `forgot-password/forgot-password.js` as an ES module
- Calls `resetPasswordForEmail()`
- Uses `https://mkk.lazykillerking.xyz/reset-password/` as the redirect target
- Shows inline success and error states

### `reset-password/index.html`

Public password reset page reached from recovery links.

- Standalone page with no navbar or footer
- Uses `reset-password/reset-password.css`
- Loads `js/env.js`
- Loads `reset-password/reset-password.js` as an ES module
- Waits for a valid recovery session before enabling the form
- Shows a dedicated expired-link error for stale or already-used mail links
- Validates password length and confirmation client-side
- Updates password through `supabase.auth.updateUser()`
- Signs out the recovery session and redirects to `/index.html` after success

### `dashboard/index.html`

Protected landing page after auth.

Dynamic pieces:

- Navbar identity
- Joined date
- Computed score
- Computed solve count
- Performance bars
- Recent solves feed

Static or placeholder pieces:

- Leaderboard rows
- First-blood list
- Rank delta display
- Hints count

### `challenges/index.html`

Protected challenge board.

- Category filters
- Search
- Challenge grid
- Challenge detail modal

This is the heaviest client-side feature surface in the repo.

### `profile/index.html`

Protected profile page.

- Identity hero
- SVG avatar block
- Exportable hacker card
- Heatmap section
- Stat tiles
- Badge strip
- Category breakdown
- Sortable and filterable solve history table

Also loads:

- `html2canvas` from CDN
- `profile/profile.js`

### `profile/edit/index.html`

Protected profile editor.

- Live preview card
- Username, first name, last name, country, and bio fields
- Username and bio counters
- Cancel and save actions

Uses a dedicated stylesheet and an ES module controller.

### `scoreboard/index.html`

Protected scoreboard route that now acts as the dynamic user registry.

- Shared nav shell and footer
- Boot-sequence intro
- Hero metrics for total users, active users, solver count, and current-user rank
- Search and filter pills
- Top-three podium
- Paginated infinite-scroll registry grid
- Loading, empty, and end-of-list states

Important nuance:

- The route and nav label still say `Scoreboard`
- The data source is now `public.users`
- It loads `js/countdown.js`, `js/countup.js`, and `css/users.css`

### `users/index.html`

Public read-only profile page for `?username=...`.

- Intended for viewing another user's public profile without auth
- Receives traffic from scoreboard card links
- Uses live Supabase-backed profile data

---

## Shared Runtime

### `js/env.js`

Generated browser config file.

- Seeds `window.__PUBLIC_ENV__`
- Should not be edited manually
- Is currently committed to the repo

### `js/supabase.js`

Shared browser bootstrap for Supabase.

- Imports `createClient` from jsDelivr ESM
- Reads config from `window.__PUBLIC_ENV__`
- Creates a shared client with:
  - `persistSession: true`
  - `autoRefreshToken: true`
  - `detectSessionInUrl: true`
  - `storageKey: "mkk-auth"`
- Exports:
  - `supabase`
  - `requireSupabaseClient()`
  - `getSupabaseConfigError()`

### `js/session.js`

Shared auth and profile helper layer.

Responsibilities:

- Get authenticated user
- Validate usernames
- Check username availability
- Ensure a `users` row exists
- Fetch current profile
- Protect routes
- Populate shared auth UI
- Bind logout buttons
- Redirect authenticated users away from public auth pages
- Update profile rows

Important contract:

- Profile storage is assumed to live in `public.users`
- Username fallback can come from `user.user_metadata.username`

### `js/auth.js`

Controller for login and signup.

- Binds whichever auth form exists
- Performs client-side validation
- Maps Supabase errors to friendlier messages
- Uses `signInWithPassword()` for login
- Uses `signUp()` for registration
- Creates the profile row immediately if signup returns a session
- Otherwise waits until the first authenticated session

### `forgot-password/forgot-password.js`

Recovery-email request controller.

- Imports the shared client from `js/supabase.js`
- Shows setup errors if `js/env.js` has not been generated
- Validates email format
- Calls `resetPasswordForEmail()`
- Renders inline success and error feedback

### `reset-password/reset-password.js`

Recovery reset controller.

- Imports the shared client from `js/supabase.js`
- Shows setup errors if config is missing
- Waits for `PASSWORD_RECOVERY` or a matching recovery-link session
- Avoids marking valid links as expired too early, but fails closed on stale or already-used links
- Shows a three-state password strength indicator
- Validates password length and confirmation
- Calls `supabase.auth.updateUser()`
- Signs out after success and redirects to `/index.html`

---

## Main Page Controllers

### `js/dashboard-page.js`

- Protects the route with `requireAuth()`
- Hydrates navbar identity
- Reads solved state and challenge state from `localStorage`
- Computes stats through `getUserStats()`
- Updates score and solve widgets
- Builds top-five category bars
- Builds recent solve feed
- Subscribes to realtime updates for the current user row

Important nuance:

- Displayed score prefers locally computed solve totals over `profile.score`

### `js/profile-page.js`

- Protects the route with `requireAuth()`
- Hydrates navbar
- Fills username, about, and joined text
- Reads local solve and challenge state
- Computes stats
- Hands off to `window.initProfileData()` from `profile/profile.js`
- Subscribes to realtime profile updates
- Removes the loading class when finished

### `js/challenges-page.js`

- Protects the route
- Hydrates navbar
- Binds logout

All challenge rendering lives in `js/challenges.js`.

### `js/scoreboard-page.js`

- Protects the route with `requireAuth()`
- Hydrates navbar
- Runs count queries for total users, active users, solver count, and current-user rank
- Fetches paginated user batches from `public.users`
- Applies search and client-side filter pills
- Supports infinite scroll
- Renders podium and registry cards
- Subscribes to realtime refreshes from `public.users`

Important nuance:

- The page still lives at `/scoreboard/`
- Existing notes mention links targeting `/profile/{username}`, but recent route changes also introduced `/users?username=...`; verify link behavior from source before documenting future updates

---

## Feature Modules

### `js/challenges.js`

Largest logic file in the repo.

Runtime model:

- Self-executing browser script
- Loads challenges from the Supabase `challenges` table
- Stores solved-state locally in `localStorage`

Implemented behavior:

- Fetch and render live challenges
- Category filtering
- Search by challenge name
- Challenge modal
- Secure Postgres `submit_flag` backend flag verification
- Backend `solves` state tracking
- Secure rate limiting engine built entirely in Postgres `submit_flag` function.

Reality check:

- Flag verification, auth tracking, and score calculation are now fully back-end authoritative

### `js/stats.js`

Shared stats engine for dashboard and profile.

Computes:

- Total solves
- Solve rate
- Per-category totals and percentages
- Best streak
- Total score

Notable rule:

- `WELCOME` challenges are excluded from solve-rate and category analytics

### `js/nav.js`

Shared header interaction layer.

- Mobile nav toggle
- Outside-click close
- Escape close
- Breakpoint reset behavior

### `js/countdown.js`

Dual-purpose helper.

- Updates `[data-countdown]`
- Toggles header scroll styling for elements using `data-scroll-header`

The countdown is cosmetic, not event-driven.

### `js/countup.js`

Reusable number animation helper.

- Animates numeric values on countup-marked elements
- Exposes `window.runCountUp`

### `js/bars.js`

Shared progress-bar animation helper.

- Animates values from `data-bar-width`
- Used by dashboard and profile pages

### `js/feed.js`

Present in the repo but not wired into any current page.

Treat it as dormant or leftover scaffolding unless a page starts importing it.

---

## Profile Bundle

### `profile/profile.js`

Non-module script exposed through `window.initProfileData`.

Major features:

- Hero-card parallax
- Category bars
- Radar chart SVG
- Solve activity heatmap
- Tooltip behavior
- Copy-card image export flow
- Sortable history table
- Search filter over history rows
- Badge strip rendering

### `profile/profile.css`

Profile page styling.

- Hero layout
- Avatar presentation
- Hacker card styling
- Heatmap grid
- History table
- Category section
- Badge strip

### `profile/edit/edit.js`

ES module controller for profile editing.

- Protects the route
- Hydrates navbar
- Preloads the form from `auth.profile`
- Updates live username preview
- Updates live bio preview
- Validates username client-side
- Calls `updateUserProfile()`
- Redirects to `/profile?success=profile_updated`

### `profile/edit/edit.css`

Profile edit styling.

- Split layout
- Preview card
- Input states
- Counters
- Action buttons

---

## Shared Styles

| File | Purpose |
|---|---|
| `css/base.css` | Global reset, tokens, font-face declarations, body shell, footer, shared primitives |
| `css/components.css` | Navbar, glass cards, buttons, challenge cards, modals, shared sections |
| `css/animations.css` | Reveal classes, stagger timing, shared motion effects |
| `css/auth.css` | Public auth page layout, form styling, validation, recovery link styling |
| `forgot-password/forgot-password.css` | Standalone recovery-request page styling |
| `reset-password/reset-password.css` | Standalone reset page styling, strength meter, submit states |
| `css/users.css` | Scoreboard user-registry page styling |

---

## Assets

### `assets/fonts/`

Available font files include:

- JetBrains Mono
- Inter
- Montserrat
- Petrona
- Hey Comic

Not every available font is necessarily used by the current CSS.

### `assets/hieroglyphics/Hylian Language/`

PNG glyph set used decoratively in footers and profile cards.

Observed usage:

- GOODLUCK footer sequences
- MKK sequence on the profile card
- EDIT sequence on the profile edit preview

### Known Asset Mismatch

Pages reference:

- `/assets/favicon.ico`

That file is not present in the current `assets/` tree.

---

## Tooling and Scripts

### `package.json`

Small script surface:

- `sync:env`: generates `js/env.js` from `.env`
- `check:auth`: syntax-checks selected JS files with `node --check`

Dependency footprint is intentionally small:

- `@supabase/supabase-js`

### `scripts/generate-env.mjs`

Generates `js/env.js` from `.env`.

Behavior:

- Resolves project root relative to the script location
- Parses simple key/value `.env` entries
- Copies only public values
- Throws if `.env` is missing
- Writes a browser global assignment

This is the only required generation step in the repo.

---

## Runtime Data Model

### Supabase Data

Expected frontend tables & views:

#### Tables

**`public.users`** (Frontend Profile & Auth Link)
- `id` (UUID, PK)
- `username` (Text, Unique)
- `score` (Integer)
- `created_at` (Timestamptz)
- `solves_count` (Integer)
- `last_active_at` (Timestamptz)
- `first_name` (Text)
- `last_name` (Text)
- `country` (Text)
- `about` (Text)
- `is_admin` (Boolean)
- `email` (Text)
- `is_banned` (Boolean)

**`public.challenges`**
- `id` (Integer, PK)
- `title` (Text)
- `description` (Text)
- `category` (Text)
- `points` (Integer)
- `created_at` (Timestamptz)
- `solves_count` (Integer)
- `flag` (Text)

**`public.solves`**
- `id` (Integer, PK)
- `user_id` (UUID, FK to users)
- `challenge_id` (Integer, FK to challenges)
- `solved_at` (Timestamptz)

**`public.flag_attempts`** (Rate Limiting & Auditing)
- `id` (Bigint, PK)
- `user_id` (UUID, FK to users)
- `challenge_id` (Integer, FK to challenges)
- `provided_flag` (Text)
- `is_correct` (Boolean)
- `opened_at` (Timestamptz)
- `submitted_at` (Timestamptz)

**`public.user_rate_limits`**
- `user_id` (UUID, PK, FK to users)
- `cooldown_until` (Timestamptz)
- `last_attempt_at` (Timestamptz)
- `consecutive_attempts` (Integer)
- `current_penalty` (Integer)

**`public.security_events`**
- `id` (Bigint, PK)
- `user_id` (UUID, FK to auth.users)
- `username` (Text)
- `action` (Text)
- `resource` (Text)
- `details` (JSONB)
- `ip_address` (Text)
- `occurred_at` (Timestamptz)

#### Views

**`public.user_rankings`**
- Provides live computed rankings based on `score` and `solved_at`.

#### Functions (RPC)

- `submit_flag(challenge_id, user_flag)`: Secure backend flag validation, handles rate limiting, scoring, and solve records.
- `log_security_event(action, resource, details)`: Tracks suspicious activity.
- `check_user_email_domain()`: Triggered to enforce @gmail.com for auth.
- `prevent_admin_self_promotion()`: Triggered to prevent unauthorized privilege escalation.

### Browser Data

`localStorage` keys:

- `mkk-auth`: Supabase auth persistence
- `mkk_ctf_challenges_solved` / `mkk_ctf_challenges_static`: (deprecated) legacy tracker storage

### Solve Record Shape

Current frontend normalizes solve entries toward:

```js
{ id: "challenge-id", timestamp: "ISO-8601 string" }
```

Legacy string or numeric ids are still tolerated and upgraded in place.

---

## Auth and Security Notes

### What Is Protected

- Route access to dashboard, challenges, profile, profile edit, and scoreboard
- Profile reads and updates through Supabase
- Session persistence through Supabase browser auth

### What Is Not Actually Secure Yet

- Delete flow is not fully backend-authoritative

### Supabase-Specific Requirements

- `public.users` needs compatible RLS policies
- Profile creation assumes authenticated users can insert their own row
- Username availability checks are best-effort and tolerant of RLS restrictions

---

## Dev Workflow

### Install

```bash
npm install
```

### Generate Browser Config

```bash
npm run sync:env
```

### Syntax Check Selected Runtime Files

```bash
npm run check:auth
```

### Local Checklist

1. Make sure `.env` exists.
2. Run `npm run sync:env`.
3. Confirm `js/env.js` contains public config.
4. Verify Supabase Auth supports email/password.
5. Verify `public.users` exists with compatible RLS policies.

---

## Current Risks and Gaps

- `/assets/favicon.ico` is referenced but missing
- `js/feed.js` appears unused
- No automated tests
- No bundling or minification pipeline
- No server-authoritative challenge validation
- Countdown is cosmetic, not tied to an event record
- A large amount of challenge logic still lives in one browser file

---

## Documentation Rule

When the repo changes, update this file only with behavior verified from source.

Do not document intended features as if they already exist.
