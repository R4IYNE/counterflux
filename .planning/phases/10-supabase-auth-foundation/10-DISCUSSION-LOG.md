# Phase 10: Supabase Auth Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 10-supabase-auth-foundation
**Areas discussed:** Deployment + OAuth setup, Auth UI surface + flow, Settings refactor + profile migration, RLS + store-init timing

---

## Gray Area Selection

**Presented options:**

| Option | Description | Selected |
|--------|-------------|----------|
| Deployment + OAuth setup | Supabase project choice, env vars, OAuth redirects, magic-link callback path | ✓ |
| Auth UI surface + flow | auth-modal vs settings integration, CTA placement, post-callback redirect, magic-link UX | ✓ |
| Settings refactor + profile migration | AUTH-04 field changes, avatar behaviour, first-sign-in local profile handling | ✓ |
| RLS + store-init timing | deck_cards RLS shape, Alpine store init race with auth | Deferred, then re-raised |

---

## Deployment + OAuth setup

### Which Supabase project hosts Counterflux's auth + sync tables?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse huxley (Recommended) | Existing personal Supabase project. One Google OAuth app, one project. Tables prefixed or schema-namespaced. | ✓ |
| New 'counterflux' project | Separate Supabase project, cleaner RLS, independent quota. | |

**User's choice:** Reuse huxley
**Notes:** Consistent with the "all personal apps use huxley" convention in `d:\Vibe Coding\CLAUDE.md`.

---

### How should OAuth redirect URLs be allowlisted across Vercel deploys?

| Option | Description | Selected |
|--------|-------------|----------|
| Wildcard preview + prod (Recommended) | localhost + counterflux-*.vercel.app wildcard + prod URL, allowlisted in Supabase + Google Console. | ✓ |
| Prod + localhost only | Skip preview deploys; test locally or on prod. | |
| Per-deploy manual | Add each preview URL manually. | |

**User's choice:** Wildcard preview + prod
**Notes:** Supports preview deploys for pre-prod QA of auth regressions.

---

### Which env var strategy for the Supabase URL + anon key?

| Option | Description | Selected |
|--------|-------------|----------|
| Commit .env.example + Vercel UI (Recommended) | .env.example with empty placeholders; .env.local gitignored for dev; Vercel UI for preview/prod. | ✓ |
| Inline defaults for anon key | Hardcode anon key in src/services/supabase.js; RLS enforces access. | |

**User's choice:** Commit .env.example + Vercel UI
**Notes:** Standard Vite pattern; aligns with secret-rotation hygiene.

---

### How should Counterflux's tables coexist with Atlas/MWTA in the huxley Supabase?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated 'counterflux' schema (Recommended) | CREATE SCHEMA counterflux + place 6 tables there. Clean namespacing. | ✓ |
| Public schema + cf_ prefix | public.cf_collection, public.cf_decks. Dexie names diverge. | |
| Public schema + clean names | Match Dexie 1:1. Risk of collision if Atlas/MWTA add same-named tables. | |

**User's choice:** Dedicated 'counterflux' schema
**Notes:** Prevents cross-app table name collisions; RLS policies scope cleanly inside the schema.

---

## Auth UI surface + flow

### Where does the auth UI live structurally?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated auth-modal.js (Recommended) | New src/components/auth-modal.js per ARCHITECTURE.md. Settings modal loses email field for signed-out users. | ✓ |
| Integrate into settings-modal | Signed-out settings modal renders auth form inline. Single modal, two states. | |

**User's choice:** Dedicated auth-modal.js
**Notes:** Matches ARCHITECTURE.md separation-of-concerns rationale.

---

### Where does the 'Sign in' CTA live in the app shell?

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar profile widget (Recommended) | Replace 'Set up profile' CTA. Signed-out: 'Sign in'; signed-in: user name + avatar. | ✓ |
| Topbar corner | Button near connectivity chip. | |
| Both | Sidebar + topbar for discoverability. | |

**User's choice:** Sidebar profile widget
**Notes:** One touchpoint, constant position, matches Linear/VSCode pattern.

---

### How should magic-link + Google OAuth be presented in the auth modal?

| Option | Description | Selected |
|--------|-------------|----------|
| Google prominent, magic-link below (Recommended) | Large Google button at top, OR divider, email field + SEND MAGIC LINK below. | ✓ |
| Tabbed (Email \| Google) | Two tabs, each method isolated per tab. | |

**User's choice:** Google prominent, magic-link below
**Notes:** Matches Notion/Vercel/Supabase UI; Google gets visual weight per FEATURES.md's 60-70% projection.

---

### After successful auth callback, where should the user land?

| Option | Description | Selected |
|--------|-------------|----------|
| Last screen / current route (Recommended) | Capture hash pre-redirect; navigate back after exchangeCodeForSession. | ✓ |
| Always dashboard | Navigate to /#/epic-experiment. | |
| Sign-in confirmation landing | Dedicated success screen. | |

**User's choice:** Last screen / current route
**Notes:** Preserves Vandalblast game + deck editing context.

---

### After the user submits their email for magic-link, what does the modal show?

| Option | Description | Selected |
|--------|-------------|----------|
| In-modal 'check email' state (Recommended) | Modal swaps to "Check your inbox" + Close + Resend (30s cooldown). User can dismiss. | ✓ |
| Toast + close modal | Fire toast, close modal. Less reassuring. | |
| Redirect to /sign-in-pending screen | Full-screen pending page. Jarring. | |

**User's choice:** In-modal 'check email' state
**Notes:** Non-blocking; onAuthStateChange handles callback transparently.

---

## Settings refactor + profile migration

### What does the settings modal show for signed-in users (AUTH-04)?

| Option | Description | Selected |
|--------|-------------|----------|
| Email read-only, name/avatar editable (Recommended) | EMAIL read-only; DISPLAY NAME editable + cloud-synced; AVATAR upload + 'Use Google avatar'. | ✓ |
| Email + name both read-only from auth | Name sourced from Google/email localpart. No editing. | |
| Full editing including email | Preference email separate from auth email. | |

**User's choice:** Email read-only, name/avatar editable
**Notes:** Enforces email as identity source while keeping profile personalisation.

---

### How should the avatar behave across sign-in states?

| Option | Description | Selected |
|--------|-------------|----------|
| Seed from OAuth, user-override via upload (Recommended) | First sign-in hydrates from Google avatar; user can override with upload. | ✓ |
| OAuth only, no local upload | Lose upload affordance for signed-in users. | |
| Upload only, ignore OAuth avatar | Treat avatar as local preference everywhere. | |

**User's choice:** Seed from OAuth, user-override via upload
**Notes:** Best-of-both — lossless default for Google users, flexible for customisation.

---

### On first sign-in, what happens to the user's existing local profile data?

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt user to keep or discard (Recommended) | 'You have a local profile. Use it or start fresh?' | ✓ |
| Auto-migrate silently | Copy localStorage fields into cloud profile row. | |
| Ignore local, start fresh | Create empty cloud row; localStorage untouched. | |

**User's choice:** Prompt user to keep or discard
**Notes:** Sets the precedent Phase 11 inherits for collection/decks reconciliation (PITFALLS §3).

---

### After sign-out, where does the user land?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on current screen (Recommended) | Auth flips to anonymous; profile re-hydrates from localStorage. | ✓ |
| Redirect to dashboard | Navigate to /#/epic-experiment. | |

**User's choice:** Stay on current screen
**Notes:** Local-first promise intact; minimal disruption.

---

## RLS + store-init timing

### How should RLS policies be shaped on the Supabase side?

| Option | Description | Selected |
|--------|-------------|----------|
| Denormalised user_id everywhere (Recommended) | Mirror Dexie v8; counterflux.deck_cards has user_id column; direct policy. | ✓ |
| Subquery-via-decks for deck_cards | No user_id on deck_cards; subquery policy via decks. | |

**User's choice:** Denormalised user_id everywhere
**Notes:** Dexie v8 already has user_id on every synced row — 1:1 mirror simplifies sync semantics.

---

### What's the boot order for auth vs Alpine store init (PITFALLS §8 race)?

| Option | Description | Selected |
|--------|-------------|----------|
| Local-first init, lazy-rehydrate on auth flip (Recommended) | Stores init with localStorage state; Alpine.effect re-hydrates on auth change. | ✓ |
| Block app shell behind auth | Splash stays up until getSession() resolves. | |

**User's choice:** Local-first init, lazy-rehydrate on auth flip
**Notes:** Anonymous users never pay getSession latency; matches ARCHITECTURE.md Pattern 1.

---

### When are Dexie sync hooks installed (Phase 10 foundation vs Phase 11 activation)?

| Option | Description | Selected |
|--------|-------------|----------|
| Hook install deferred to Phase 11 (Recommended) | Phase 10 ships auth + RLS + schema + UI. No outbox. | ✓ |
| Install hooks in Phase 10 as no-ops | Hooks registered now, guarded by authState.ready. | |

**User's choice:** Hook install deferred to Phase 11
**Notes:** Clean phase boundary; Phase 10 is pure identity foundation.

---

## Claude's Discretion

Areas where the user deferred to Claude for planning-time decisions:

- Magic-link "check your email" 30s resend cooldown visual (countdown vs disabled button)
- Error states (magic-link expired, Google popup cancelled, network failure during OAuth)
- Keyboard shortcut binding for auth modal open (or none)
- Exact visual shade of the sign-in CTA button in sidebar
- Google avatar URL cache-busting if user changes Google profile pic
- Sidebar widget transition animation between anonymous/authed states
- Auth modal focus management (email field focus on open)
- `schema_version` addition for the 'counterflux' Postgres schema tracking
- Whether to ship a `supabase/migrations/` directory pattern in-repo

## Deferred Ideas

See CONTEXT.md §deferred — includes Dexie sync hooks (Phase 11), reconciliation modal (Phase 11), Realtime subscriptions (Phase 11), notification bell wire-up (Phase 12), OAuth providers beyond Google (v1.2+), email/password auth (explicitly rejected in FEATURES.md), custom domain redirect update, Supabase Edge Functions, analytics/telemetry.
