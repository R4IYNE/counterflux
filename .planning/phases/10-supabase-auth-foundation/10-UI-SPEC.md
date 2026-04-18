---
phase: 10
slug: supabase-auth-foundation
status: approved
reviewed_at: 2026-04-17
revised_at: 2026-04-18
shadcn_initialized: false
preset: none
created: 2026-04-17
---

# Phase 10 — UI Design Contract

> **REVISION (D-40, 2026-04-18) — auth-wall boot gate added (permanent).**
>
> Counterflux is an auth-gated product. On boot, if `auth.status !== 'authed'` and the route is not `/auth-callback`, a full-screen non-dismissible `auth-wall` covers the app. Visual: Syne 48px `COUNTERFLUX` brand heading, 11px mono `THE AETHERIC ARCHIVE` tagline, reuses auth-modal card layout (420px max-width, `#14161C` bg, `#2A2D3A` border, 32px padding), includes Google + OR + EMAIL + PASSWORD + SIGN IN (same as D-39 auth-modal). Mila tagline below card: `Mila only lets members through the gate.` No X close, no Escape, no backdrop dismiss. Background: solid `#0B0C10` (full viewport). Sign-in success flips `auth.status → 'authed'` which closes the wall via `Alpine.effect`.
>
> The auth-modal component and sidebar Sign In CTA remain in the codebase as dead code for now (cleanup deferred to a future phase).
>
> **REVISION (D-39, 2026-04-18) — magic-link removed; email+password replaces it.**
>
> The shared huxley Supabase project sends magic-link emails branded as "huxley" across all apps, which is confusing. For Counterflux, email+password auth sidesteps the email-branding problem and is acceptable for a 2-user personal app with known users.
>
> **Sections below that reference magic-link flow are superseded for the auth-modal component.** Google OAuth sections, design tokens, typography, spacing, colour, and all non-auth-modal components remain as-approved. Specific changes:
>
> - Auth-modal body renders EMAIL + PASSWORD fields + `SIGN IN` CTA (not SEND MAGIC LINK)
> - In-modal `CHECK YOUR INBOX` swap state is obsolete — removed
> - 30-second resend cooldown + `RESEND MAGIC LINK` button — obsolete
> - On successful sign-in: modal closes directly (no in-modal confirmation)
> - Inline credential error: `Invalid email or password.` (new)
> - Toast inventory: add "Signed in." success toast; "Too many attempts..." warning; "Couldn't sign in..." error
>
> Google OAuth + callback overlay + sidebar profile widget + settings modal are unchanged.
> CONTEXT.md D-39 has the full change log.



> Visual and interaction contract for the Supabase identity layer shipped in Phase 10: the new standalone auth-modal (AUTH-02 + AUTH-03), signed-in/signed-out refactor of settings-modal (AUTH-04), sidebar profile widget swap (AUTH-04), first-sign-in profile-migration prompt (D-16..D-20), and `/#auth-callback` transition UX (D-06, D-11).
>
> Anchored to the canonical Neo-Occult Terminal tokens declared in `src/styles/main.css` `@theme` and baseline 01-UI-SPEC.md. Every value below already exists — this spec maps existing tokens onto new identity surfaces. **No new tokens, no new fonts, no new shadows.** If a decision can't be made using an existing `--color-*` / `--spacing-*` / font family, the decision is wrong.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Alpine.js 3.15 + Tailwind v4 + Vite; shadcn not applicable — no React) |
| Preset | not applicable |
| Component library | none — vanilla-DOM modals matching `src/components/migration-blocked-modal.js` and `src/components/settings-modal.js` patterns |
| Icon library | Material Symbols Outlined (via `index.html` link) for UI chrome; Google "G" SVG mark inlined in auth-modal for brand fidelity |
| Display font | Syne (self-hosted, 400/700) |
| Body font | Space Grotesk (self-hosted, 400/700) |
| Mono font | JetBrains Mono (self-hosted, 400/700) |
| CSS framework | Tailwind v4 via `@theme` in `src/styles/main.css` — **use `var(--color-*)` or Tailwind utility**; never hard-code hex. Existing `settings-modal.js` currently hard-codes hexes (legacy pattern) — Phase 10's refactor is the opportunity to lean harder on utilities where practical, but inline-style parity with the existing modal is acceptable to keep the diff minimal. |
| Border radius | 0px everywhere (Organic Brutalism, no exceptions) |

**Anchor:** `src/styles/main.css` lines 3-40. **Canonical baseline:** `.planning/milestones/v1.0-phases/01-foundation-data-layer/01-UI-SPEC.md`. All downstream components must reference these, not re-derive them.

**Source:** CONTEXT.md D-08 (new component), D-13/D-14 (modal split), CLAUDE.md `Visual Identity` block, 01-UI-SPEC.md Design System table.

---

## Spacing Scale

Declared values (already in `@theme`, multiples of 4):

| Token | Value | Tailwind utility | Usage in Phase 10 |
|-------|-------|------------------|-------------------|
| xs | 4px | `p-1` / `gap-1` | Icon-to-label gap inside Google button; internal padding on "RESEND in 27s" countdown chip; vertical gap inside stacked meta rows (name + email under avatar) |
| sm | 8px | `p-2` / `gap-2` | Button internal padding vertical; stacked field-label → input gap; gap between OR divider strokes and the `OR` label |
| md | 16px | `p-4` / `gap-4` | Field-to-field vertical rhythm in auth-modal and settings-modal; auth-modal Google-button → OR → email-input block gap; avatar → name-column gap |
| lg | 24px | `p-6` / `gap-6` | Modal section padding between header and body; between body and action row; "Sign in to sync" CTA card's internal padding in signed-out settings |
| xl | 32px | `p-8` | Modal outer padding (top/left/right/bottom) — identical to existing settings-modal 32px inset |
| 2xl | 48px | `p-12` | Auth-callback transition screen vertical padding (centred spinner + caption) |
| 3xl | 64px | `p-16` | Not used in this phase |

**Layout constants (derived, not in `@theme`):**

| Constant | Value | Rationale |
|----------|-------|-----------|
| Auth modal card width | **420px fixed** | Matches existing settings-modal `max-width: 420px` (line 19) — one modal footprint across all identity surfaces. |
| Auth modal backdrop | `rgba(11, 12, 16, 0.85)` | Matches existing settings-modal backdrop (line 15) identically. |
| First-sign-in prompt card width | **440px fixed** | Matches `migration-blocked-modal.js` `max-width: 440px` (line 24) — reuses the established "consequential decision" card footprint. |
| Auth-callback overlay width | **100vw × 100vh** | Full-screen splash-style overlay; centred 320px content block inside. |
| Google button height | **40px** (`h-10`) | 40px = 10 × 4pt, matches standard Google-brand-guidelines-recommended sign-in-button height. |
| Email input height | **40px** | Matches Google button so the stacked controls are visually balanced. |
| Magic-link SEND button height | **40px** | Matches. |
| OR divider block height | **32px** (two 16px halves with the label centred) | Composed of two 1px ghost-border rules + an 11px/mono/`text-muted` "OR" label with 8px horizontal padding of `bg-surface` to punch a hole in the rule. |
| Avatar preview (modal) | **56 × 56px** (`w-14 h-14`) | Matches existing settings-modal avatar (line 132) — zero change. |
| Sidebar profile-widget avatar | **32 × 32px** | Matches v1.0 sidebar avatar dimensions; no change. |
| Sidebar anonymous "SIGN IN" CTA height | **36px** | Single-line CTA; 9 × 4pt accommodates an 11px mono label with 12px vertical padding. |
| Resend-cooldown countdown width | auto (`min-content`) | Shrink-wraps around `RESEND IN 27s` label; no layout shift between disabled + enabled states (both states ship the same button with swapped text + `aria-disabled`). |
| Close icon button | **32 × 32px** hit target, 20px glyph centred | Matches every other icon button in the app (precon browser, mass entry, settings modal). |
| Modal enter/exit transition | **200ms ease-out** | Matches Phase 8 panel + Phase 7 sidebar collapse (one motion constant across the app). |

Exceptions: none. Every value above reduces to a multiple of 4.

**Source:** CONTEXT.md D-10 (layout), D-12 (resend cooldown), existing `settings-modal.js` + `migration-blocked-modal.js` dimensions.

---

## Typography

Four-role scale. Sizes and weights map 1:1 to the canonical 01-UI-SPEC scale.

| Role | Size | Weight | Line Height | Family | Letter spacing | Case | Usage in Phase 10 |
|------|------|--------|-------------|--------|----------------|------|-------------------|
| Display | 48px | 700 | 1.1 | Syne | -0.02em | normal | **Not used in this phase** (reserved for screen heroes) |
| Heading | 20px | 700 | 1.2 | Syne | 0.01em | UPPERCASE | Auth modal title (`SIGN IN`); magic-link sent state title (`CHECK YOUR INBOX`); first-sign-in prompt title (`WELCOME BACK`); settings modal title (`SETTINGS`, unchanged); auth-callback overlay title (`COMPLETING SIGN-IN`) |
| Body | 14px | 400 (regular) or 700 (bold values) | 1.5 | Space Grotesk | normal | normal | Magic-link confirmation copy (`We sent a link to you@email.com…`); first-sign-in Mila copy; signed-in email value (400); signed-in display-name input text (400); OAuth-error toast body |
| Label | 11px | 400 or 700 | 1.3 | JetBrains Mono | 0.15em | UPPERCASE | Every CTA (`SIGN IN WITH GOOGLE`, `SEND MAGIC LINK`, `RESEND IN 27s`, `KEEP LOCAL PROFILE`, `START FRESH`, `SIGN OUT`, `USE GOOGLE AVATAR`, `UPLOAD PHOTO`, `SAVE PROFILE`, `DISCARD CHANGES`); field labels (`EMAIL`, `DISPLAY NAME`, `AVATAR`); meta (`SIGNED IN AS`, `COOLDOWN`); OR divider letters; callback-overlay caption |

**Label weight guidance** (continues the canonical pattern):

| Context | Weight |
|---------|--------|
| Data values, timestamps, inline status (`SIGNED IN AS`, cooldown counter) | 400 |
| CTAs, field labels, section overlines (`EMAIL`, `SIGN IN`, `SIGN OUT`) | 700 |

**Two weights only: 400 and 700.** No medium. No semibold.

**Source:** 01-UI-SPEC.md Typography table, reused verbatim.

---

## Color

Neo-Occult Terminal 60/30/10 distribution. Every hex below is already in `@theme`.

| Role | Token | Value | Tailwind utility | Usage in Phase 10 |
|------|-------|-------|------------------|-------------------|
| Dominant (60%) | `--color-background` | `#0B0C10` | `bg-background` | Backdrop (at 0.85 alpha), text-input insets, Google button background (fallback when brand white reads too hot against the dark modal — see note below) |
| Dominant (60%) | `--color-surface` | `#14161C` | `bg-surface` | Modal card background, first-sign-in prompt card, auth-callback overlay content block, "Sign in to sync" CTA card in signed-out settings |
| Secondary (30%) | `--color-surface-hover` | `#1C1F28` | `bg-surface-hover` | Secondary CTA background (`DISCARD CHANGES`, `CLOSE MODAL`, `RESEND` cooldown state), Google button hover, email-input hover, "Start fresh" button default background |
| Secondary (30%) | `--color-border-ghost` | `#2A2D3A` | `border-border-ghost` | Every 1px border — modal edge, email input, OR divider rules, Google button border, first-sign-in prompt card, read-only email chip |
| Secondary (30%) | `--color-text-primary` | `#EAECEE` | `text-text-primary` | Card body copy, CTA text on primary CTAs, modal headings, display-name input value |
| Secondary (30%) | `--color-text-muted` | `#7A8498` | `text-text-muted` | Field labels, helper text (`We'll send you a link…`), OR divider glyph, resend-cooldown countdown, read-only email value, "SIGNED IN AS" meta |
| Secondary (30%) | `--color-text-dim` | `#4A5064` | `text-text-dim` | Disabled CTA text (`SEND MAGIC LINK` when email blank), inactive state glyphs |
| **Accent (10%)** — Izzet blue | `--color-primary` | `#0D52BD` | `bg-primary` / `text-primary` / `border-primary` | **Primary CTA backgrounds ONLY** (`SEND MAGIC LINK`, `KEEP LOCAL PROFILE`, `SAVE PROFILE`); active focus ring on email input; sidebar "SIGN IN" CTA background; first-sign-in prompt primary action; field-label overline colour (matches existing settings-modal pattern at line 42) |
| **Accent (10%)** — Izzet red | `--color-secondary` | `#E23838` | `text-secondary` / `border-secondary` | **Destructive only** — `SIGN OUT` button hover glow; X close icon hover on auth-modal and first-sign-in prompt; inline validation error text (`Enter a valid email address`); auth-error toast left border (inherits existing `toast.js` error mapping) |
| Success | `--color-success` | `#2ECC71` | `text-success` | Auth-callback "✓ SIGNED IN" confirmation state (200ms flash before redirect) |
| Warning | `--color-warning` | `#F39C12` | `text-warning` | Magic-link-sent state icon tint (the `mail` glyph that replaces the form); gentle "your session is on the way" semantic — not blue (not a primary action), not red (not an error) |
| Glow (blue) | `--color-glow-blue` | `rgba(13,82,189,0.3)` | `shadow-[0_0_12px_var(--color-glow-blue)]` | Sidebar "SIGN IN" CTA active/hover glow; email input focus-within glow |
| Glow (red) | `--color-glow-red` | `rgba(226,56,56,0.25)` | `shadow-[0_0_8px_var(--color-glow-red)]` | `SIGN OUT` button hover glow; modal X close hover glow |

### Google button colour treatment

Google brand guidelines ship both "light" and "dark" button variants. On Counterflux's dark modal, use the **dark-theme brand variant**:

- Background: `#131314` (Google's official dark-button background — fractionally darker than our `--color-background`, within 1 step on the luminance ladder; do not substitute our token, brand fidelity matters here)
- Border: `1px solid #8E918F` (Google's official dark-button border)
- Text colour: `#E3E3E3`
- "G" mark: full-colour Google G SVG (inlined) — never mono
- Hover: `#1F1F1F` background with same border
- Focus-visible: `2px solid var(--color-primary)` outline, offset 2px

**Exception rationale:** The Google "G" mark + brand colour is the single surface in the app where Counterflux's palette yields to an external brand requirement. This is a Google Identity Services requirement (Google's Terms of Service) and a trust signal for OAuth. It is declared here as the **only** sanctioned colour exception in Phase 10.

### Accent reserved for

`#0D52BD` (blue) is reserved for:
1. Primary CTA backgrounds — `SEND MAGIC LINK`, `SAVE PROFILE`, `KEEP LOCAL PROFILE`
2. Sidebar "SIGN IN" CTA background (anonymous profile-widget state)
3. Email input `:focus-within` border + 12px `glow-blue` box-shadow
4. First-sign-in prompt primary button (`KEEP LOCAL PROFILE` — preserves user's existing work, the empathetic default)
5. Field-label overline colour (inherits the existing settings-modal pattern at line 123 — `EMAIL`, `DISPLAY NAME`, `AVATAR` labels all render in primary)
6. Auth-callback overlay spinner stroke colour

`#E23838` (red) is reserved for:
1. `SIGN OUT` button text + hover glow — destructive, irreversible-feeling (session gone, even though local data stays)
2. Modal X close hover state (auth-modal, first-sign-in prompt) — matches the existing mass-entry X pattern
3. Inline field validation errors (`Enter a valid email address`, `This doesn't look like an email`)
4. Auth-error toast left border (already wired in `toast.js` — `error` type → `--color-secondary`)

### Never use accent for

- The Google button background (brand colour exception above; do NOT override with `bg-primary`)
- The OR divider (stays `text-muted` on `border-border-ghost`)
- Field labels in signed-in settings modal (stay `text-primary` at 11/mono/700 — the overline treatment stays blue per existing line 123)
- Modal card backgrounds (stay `bg-surface`)
- `CLOSE MODAL` / `DISCARD CHANGES` / secondary CTA backgrounds (stay `bg-surface-hover`)
- Magic-link-sent confirmation icon (uses `text-warning` per table above — gently tan, not accent-loud)

### Distribution audit

After Phase 10 ships, opening auth-modal, settings-modal, first-sign-in prompt, or the auth-callback overlay should yield roughly 60% `bg-background` + `bg-surface` footprint, 30% border-ghost + text-muted + surface-hover (chrome, labels, secondary CTAs, read-only email chip), and 10% `bg-primary` (one primary CTA per modal, one focus ring) + sprinkled `text-secondary` (sign-out, validation, X hover). The Google button is the only surface outside this split — one 40px × 280px rectangle per modal open, brand-compliant.

**Source:** CONTEXT.md D-10 (Google prominent), D-13 (sign-out bottom), existing `settings-modal.js` inline-hex usage, 01-UI-SPEC.md Color section, Google Identity Services brand guidelines.

---

## Component Anatomy

### 1. `src/components/auth-modal.js` (NEW) — AUTH-02 + AUTH-03

Vanilla-DOM modal, mirrors `settings-modal.js` mount pattern. Mounted to `document.body`, centred backdrop 0.85 alpha, `z-index: 60` (settings-modal already uses 60 — auth-modal can share the level because the two are mutually exclusive: settings opens only for signed-in users; signed-out sidebar click opens auth).

```
┌─ backdrop rgba(11, 12, 16, 0.85), 100vw × 100vh, z-60 ─────────────┐
│                                                                     │
│        ┌─ card: bg-surface, 420px, 1px border-ghost, 32px pad ─┐   │
│        │                                                         │   │
│        │  SIGN IN                                        [X]    │   │  ← Syne 20/700 + close icon btn
│        │  ────────────────────────────────────────────────      │   │     (1px border-ghost rule, 24px mt)
│        │                                                         │   │
│        │  ┌─────────────────────────────────────────────┐      │   │
│        │  │ [G]  SIGN IN WITH GOOGLE                    │      │   │  ← 40px Google button,
│        │  └─────────────────────────────────────────────┘      │   │     brand-compliant dark theme
│        │                                                         │   │
│        │  ─────────────────── OR ──────────────────────         │   │  ← 11/mono/muted, ghost rules L+R
│        │                                                         │   │
│        │  EMAIL                                                  │   │  ← 11/mono/700/primary overline
│        │  ┌─────────────────────────────────────────────┐      │   │
│        │  │ you@email.com                               │      │   │  ← 40px input, bg-background
│        │  └─────────────────────────────────────────────┘      │   │     border-ghost; focus → primary + glow
│        │                                                         │   │
│        │  ┌─────────────────────────────────────────────┐      │   │
│        │  │            SEND MAGIC LINK                   │      │   │  ← 40px primary CTA, label 11/mono/700
│        │  └─────────────────────────────────────────────┘      │   │
│        │                                                         │   │
│        │  We'll send you a one-time link. No password needed.   │   │  ← 11/mono/muted helper text
│        │                                                         │   │
│        └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**State machine:**

| State | Visible surfaces | Notes |
|-------|------------------|-------|
| `idle` | Google button enabled; email blank; `SEND MAGIC LINK` disabled (`text-dim` on `bg-surface-hover`) | Default on modal open. Autofocus lands on email input (Claude's discretion → chosen: autofocus email — Google flow typically doesn't need typing, so the keyboard-first user is always the email-flow user). |
| `email-typing` | `SEND MAGIC LINK` enables when email matches `^[^\s@]+@[^\s@]+\.[^\s@]+$` | Debounced `input` event; no network call. |
| `email-invalid` (on blur) | Inline error text below input: `Enter a valid email address` in 11/mono/text-secondary | Clears on next `input` event. |
| `google-pending` | Google button shows inline spinner glyph (`progress_activity`, Material Symbols) + text `OPENING GOOGLE…` in place of `SIGN IN WITH GOOGLE`; email field disabled; X close disabled (prevents tearing down the Supabase popup listener mid-flow) | Brief (typically <500ms before popup opens). |
| `google-popup-open` | Google button remains in `google-pending` visual state; modal stays open behind the popup | Supabase's `signInWithOAuth` opens a new tab/window; Counterflux awaits the callback. Modal itself is non-interactive but still rendered. |
| `magic-link-sending` | `SEND MAGIC LINK` shows inline spinner glyph + text `SENDING…`; disabled | Typically <400ms. Rate-limited by Supabase to prevent abuse. |
| `magic-link-sent` | **In-modal swap** (D-12) to the Magic-Link Sent State (anatomy #2 below) | Swaps card body content; header and X close remain. No navigation. |
| `google-cancelled` (user closed popup) | Modal returns to `idle`; toast fires: `Google sign-in cancelled. Try again or use a magic link.` (info toast, not error) | Non-destructive; user can retry immediately. |
| `google-error` (Supabase returns an error) | Modal returns to `idle`; toast fires: `Couldn't sign in with Google. Check your connection and try again.` (error toast) | Log the Supabase error to console for debugging; never surface the raw message to the user. |
| `magic-link-error` (network / Supabase API failure) | Modal returns to `idle`, email field re-enables; toast fires: `Couldn't send magic link. Check your connection and try again.` (error toast) | |
| `magic-link-rate-limited` (Supabase rate-limit response) | Modal stays on `idle`; toast fires: `Magic link blocked — too many attempts. Wait a minute and try again.` (warning toast) | Supabase default is 4 per hour per email. |

**Close interactions:**
- X icon top-right (32×32, Material Symbols `close` at 20px, `text-muted` default, `text-secondary` on hover with `glow-red` shadow, `aria-label="Close sign in"`)
- `Escape` key
- Click on backdrop (event target === modal element)
- All three must also tear down the auth-modal (no leaked event listeners — matches existing settings-modal `escHandler` cleanup pattern at line 113).

**Focus restoration:**
- On open: autofocus email input.
- On close (any mechanism): return focus to the sidebar "SIGN IN" CTA button.

### 2. Magic-Link Sent State (in-modal swap, D-12)

Swaps the modal body after `magic-link-sending` resolves. Same card, same X close, same header (`SIGN IN`) — only the body changes.

```
┌─ card body (swapped content) ───────────────────────────────┐
│                                                               │
│                         ✉                                    │  ← Material Symbols `mail` at 48px,
│                                                               │     text-warning (#F39C12)
│                                                               │
│                    CHECK YOUR INBOX                           │  ← Syne 20/700
│                                                               │
│   We sent a link to you@email.com. Click it to sign in.      │  ← Space Grotesk 14/400/text-primary
│                                                               │     (user's email interpolated)
│                                                               │
│   Close this modal and keep working — your session will      │  ← 14/400/text-muted
│   activate automatically when you click the link.            │
│                                                               │
│   ┌────────────────────────┐  ┌──────────────────────┐      │
│   │     CLOSE MODAL        │  │  RESEND IN 27s       │      │  ← Two 40px CTAs, flex:1 each,
│   └────────────────────────┘  └──────────────────────┘      │     8px gap
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Layout:** 32px padding top on the mail icon; 24px below it to the `CHECK YOUR INBOX` heading; 16px to the first body line; 16px to the second body line; 24px to the action row.

**Resend cooldown visual (Claude's discretion — chosen):**

Single button that swaps text + `aria-disabled` based on cooldown state. **No separate countdown chip, no separate disabled variant — one button, two states.** This is the lowest-cognition implementation (the user sees the same spatial control morph, not two controls swap).

| Cooldown state | Button background | Button text | Text colour | aria-disabled |
|----------------|-------------------|-------------|-------------|---------------|
| `cooldown-active` (seconds remaining > 0) | `bg-surface-hover` + `border-border-ghost` | `RESEND IN 27s` (countdown ticks every 1s) | `text-text-muted` | `true` |
| `cooldown-ready` (0 seconds) | `bg-surface-hover` + `border-border-ghost` (same as cooldown-active so state isn't emphasised — this is a secondary action) | `RESEND MAGIC LINK` | `text-text-primary` | `false` |
| `resending` (click fired) | Same | `SENDING…` + inline spinner | `text-text-muted` | `true` |
| `resent` (success) | Same | `RESEND IN 30s` (cooldown restarts) | `text-text-muted` | `true` |

**Countdown implementation note (for planner):** Use `setInterval(fn, 1000)` anchored to `Date.now()` at send time; compute `remaining = max(0, 30 - floor((Date.now() - sentAt) / 1000))`. Immune to background-tab throttling the same way the Phase 9 turn timer is (wall-clock, not interval counter). Clear interval on modal close.

**CLOSE MODAL button:** `bg-surface-hover` + `border-border-ghost`, label `CLOSE MODAL`, 11/mono/700. Closes the modal and dismisses — the pending magic-link session stays valid; `onAuthStateChange` will catch the activation when the user clicks their email link, regardless of whether the modal is open at that moment (D-12 rationale). The `CLOSE MODAL` label (vs bare `CLOSE`) reinforces the invitation to keep working with Counterflux while the magic link waits.

### 3. `/#auth-callback` Transition Overlay (D-06, D-11)

Full-screen overlay shown during the PKCE code exchange (typically <500ms, but cold-cache cases can stretch to 1-2s). Mounted by the router as soon as `/auth-callback` is matched, torn down after `exchangeCodeForSession` resolves and the router navigates to the captured pre-auth route.

```
┌─ 100vw × 100vh, bg-background (full opacity, splash-style) ────────┐
│                                                                      │
│                                                                      │
│                                                                      │
│                          ∞                                          │  ← 48px Material Symbols
│                    (spinning glyph)                                  │     `progress_activity`, text-primary
│                                                                      │
│                                                                      │
│                 COMPLETING SIGN-IN…                                  │  ← Syne 20/700/text-primary
│                                                                      │
│           Routing back to where you left off.                        │  ← 14/400/text-muted
│                                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Mila flavour option (Claude's discretion — chosen to ship):** Replace the generic caption with a Mila voice line: `Mila's recalibrating the sigils. One second.` — 14/400/text-muted, same position. This uses the established Mila voice (arcane + terse) without adding a visual element. Single-line, truncates if viewport is absurdly narrow.

**Success flash (200ms before navigate):** Spinner stops, glyph swaps to Material Symbols `check_circle` in `text-success`, heading swaps to `SIGNED IN`, then router navigates to captured hash. Purpose: confirms to the user that the round trip succeeded before the content re-renders. Duration deliberately short — do not linger.

**Error state (code exchange fails — expired link, malformed URL, Supabase outage):**

```
                      ✕
              (static glyph, text-secondary)

              SIGN-IN LINK EXPIRED

   This link is older than 60 minutes or has already been used.
   Try sending a fresh magic link.

        ┌──────────────────────────────┐
        │    BACK TO COUNTERFLUX       │  ← primary CTA, returns to captured
        └──────────────────────────────┘     route and re-opens auth-modal
```

Primary CTA: 40px × 280px, `bg-primary`, label `BACK TO COUNTERFLUX`. Clicking navigates to the captured pre-auth route and opens auth-modal with a small info toast: `Send a fresh magic link to sign in.`

### 4. First-Sign-In Profile Migration Prompt (D-16..D-20)

Centre-screen prompt, **heavier visual treatment than auth-modal** — this is a consequential fork in the road. Reuses the `migration-blocked-modal.js` 440px card footprint + full-opacity `bg-background * 0.95` backdrop pattern (the user's attention must be on this decision; nothing else on screen should compete).

Triggers **only if** `localStorage.getItem('cf_profile')` yields a non-empty name OR avatar (D-20 — skip entirely for new-new users).

```
┌─ 100vw × 100vh, rgba(11, 12, 16, 0.95) backdrop, z-70 ─────────────┐
│                                                                      │
│       ┌─ bg-surface, 440px, 1px border-ghost, 32px pad, z-71 ──┐   │
│       │                                                          │   │
│       │                 WELCOME BACK                             │   │  ← Syne 20/700
│       │                                                          │   │
│       │  ┌──── 56×56 avatar preview ─────┐                      │   │
│       │  │                                │   James Arnall       │   │  ← 14/700 name, existing
│       │  │       [local avatar or        │                       │   │     local profile rendered
│       │  │        initials fallback]     │   SIGNED IN AS        │   │     in same shape as
│       │  └────────────────────────────────┘  james@arnall.dev   │   │     settings-modal avatar
│       │                                                          │   │     block (consistency)
│       │  You had a local profile before signing in.             │   │  ← 14/400/text-primary body
│       │  Keep using it for your new account, or start fresh?    │   │
│       │                                                          │   │
│       │  ┌────────────────────────────────────────────────┐   │   │
│       │  │           KEEP LOCAL PROFILE                   │   │   │  ← 40px primary CTA, bg-primary
│       │  └────────────────────────────────────────────────┘   │   │
│       │                                                          │   │
│       │  ┌────────────────────────────────────────────────┐   │   │
│       │  │           START FRESH                           │   │   │  ← 40px secondary CTA,
│       │  └────────────────────────────────────────────────┘   │   │     bg-surface-hover +
│       │                                                          │   │     border-border-ghost
│       │  Mila will keep your local profile either way —         │   │  ← 11/mono/muted reassurance
│       │  you can still sign out and revert.                     │   │     (anchors D-19 contract)
│       │                                                          │   │
│       └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- `KEEP LOCAL PROFILE` → upsert `counterflux.profile` with localStorage values (D-17), close prompt, toast `Profile synced to cloud.`
- `START FRESH` → upsert minimal row from OAuth/email identity (D-18), close prompt, toast `Cloud profile created.`
- `Escape`: disabled. This is a required decision; user cannot bypass by accident. No X close icon either.
- Backdrop click: disabled. Same reason.

**Rationale for the lockdown:** This prompt ships *once* per user. Making it impossible to dismiss by accident is worth ~0.5s of friction for the user — the cost of getting it wrong (silently destroying a local profile, or silently discarding a Google avatar) is disproportionate.

**Z-index:** 70 — above auth-modal (60), above settings-modal (60). This is the highest-priority surface in the Phase 10 stack.

### 5. Settings Modal — Signed-In State (refactor per D-13)

Refactor of `src/components/settings-modal.js`. Same 420px footprint, same header, same 32px padding. Body content swaps based on `auth.status`.

```
┌─ bg-surface, 420px, 32px padding ──────────────────────────┐
│  SETTINGS                                          [X]      │  ← existing header
│                                                              │
│  SIGNED IN AS                                                │  ← 11/mono/700/text-muted
│                                                              │     overline
│  ┌─ read-only chip ────────────────────────────────────┐   │
│  │ james@arnall.dev                                    │   │  ← 14/400/text-primary in a
│  └──────────────────────────────────────────────────────┘   │     bg-background + border-ghost
│                                                              │     32px-tall chip (not an input)
│                                                              │
│  ┌─ 56×56 avatar ─┐                                         │
│  │                │   ┌────────────┐  ┌────────────────┐  │
│  │  [avatar img   │   │ UPLOAD     │  │ USE GOOGLE     │  │  ← existing upload + new Google
│  │   or initials] │   │ PHOTO      │  │ AVATAR         │  │     avatar button, 11/mono/700
│  │                │   └────────────┘  └────────────────┘  │     bg-surface-hover
│  └─────────────────┘    (label-styled, existing pattern)    │
│                          REMOVE (existing subtle text btn)  │
│                                                              │
│  DISPLAY NAME                                                │  ← 11/mono/700/primary overline
│  ┌──────────────────────────────────────────────────────┐   │
│  │ James Arnall                                          │   │  ← 40px input, existing shape
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ 40px ──────────────┐  ┌─ 40px ──────────────────────┐  │
│  │    SAVE PROFILE      │  │     DISCARD CHANGES         │  │  ← noun-anchored action row
│  └──────────────────────┘  └─────────────────────────────┘  │     (replaces bare SAVE/CANCEL;
│                                                              │     see Copywriting Contract)
│  ─────────────────────────────────────────────────          │  ← 1px border-ghost separator,
│                                                              │     24px top + bottom margin
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  SIGN OUT                             │   │  ← 40px full-width, transparent bg,
│  └──────────────────────────────────────────────────────┘   │     1px border-border-ghost,
│                                                              │     text-secondary (#E23838),
│                                                              │     hover: bg-secondary/10 +
│                                                              │     glow-red shadow
└──────────────────────────────────────────────────────────────┘
```

**Key differences vs current `settings-modal.js`:**

| Element | Current (signed-out today) | Refactored (signed-in) |
|---------|----------------------------|------------------------|
| Email field | Editable 40px input | Read-only 32px chip with `bg-background` + `border-border-ghost`, `text-primary`, no focus ring (not interactive) |
| `SIGNED IN AS` overline | Not present | New 11/mono/700/text-muted overline above the email chip |
| Save / Cancel CTAs | Bare `SAVE` / `CANCEL` labels | Noun-anchored `SAVE PROFILE` / `DISCARD CHANGES` — clarifies what is being saved and what is being thrown away (display name + avatar edits). `DISCARD CHANGES` reads as an action rather than a bail-out, which is the correct semantic when the user may have typed into the display-name field. |
| "Use Google avatar" button | Not present | **Conditionally rendered** — only if `auth.user.user_metadata.avatar_url` exists. Placed to the right of "UPLOAD PHOTO". If Google is not the auth provider (magic-link user without a Google-linked identity), **the button is omitted entirely** (not disabled, not hidden with opacity — removed from the DOM). D-15 rationale: don't tease a feature the user can't use. |
| Sign Out button | Not present | New — separator rule + 40px full-width destructive-styled button at bottom. On click: calls `auth.signOut()`, closes modal (D-21), profile store re-hydrates to local — all without navigation. |

**Avatar priority (D-15):** Rendered by a helper that checks, in order: `profile.avatar_url_override` (user-uploaded) → `auth.user.user_metadata.avatar_url` (Google) → initials fallback. The `USE GOOGLE AVATAR` button sets `avatar_url_override = null` so the Google URL becomes visible again; the `UPLOAD PHOTO` button sets `avatar_url_override = <dataurl>`.

### 6. Settings Modal — Signed-Out State (refactor per D-14)

Same footprint as today's modal plus one added surface at the top.

```
┌─ bg-surface, 420px, 32px padding ──────────────────────────┐
│  SETTINGS                                          [X]      │
│                                                              │
│  ┌─ bg-surface-hover, 24px pad, 1px border-primary ─────┐  │  ← new: "Sync CTA card"
│  │                                                        │  │     border accent = primary
│  │   Sign in to sync across devices                      │  │  ← 14/700/text-primary
│  │                                                        │  │
│  │   Your collection, decks, and games stay on this      │  │  ← 14/400/text-muted (2 lines max)
│  │   device — but you can sync them to the cloud.        │  │
│  │                                                        │  │
│  │   ┌────────────────────────────────────────────────┐ │  │
│  │   │            SIGN IN TO SYNC                      │ │  │  ← 40px primary CTA,
│  │   └────────────────────────────────────────────────┘ │  │     opens auth-modal,
│  │                                                        │  │     closes settings-modal
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  AVATAR                                                      │  ← existing avatar row
│  [56×56 preview]  UPLOAD PHOTO  REMOVE                       │
│                                                              │
│  DISPLAY NAME                                                │  ← existing field
│  [40px input: James Arnall]                                  │
│                                                              │
│  EMAIL                                                       │  ← existing field (local-only —
│  [40px input: james@arnall.dev]                              │     kept per D-14; signed-out
│                                                              │     users can still write here,
│                                                              │     cloud doesn't own it yet)
│                                                              │
│  [SAVE PROFILE] [DISCARD CHANGES]                            │  ← same noun-anchored action row
│                                                              │     as signed-in state
└──────────────────────────────────────────────────────────────┘
```

**Key differences vs today's modal:**

| Element | Today | Refactored (signed-out) |
|---------|-------|-------------------------|
| Sync CTA card | Not present | New — 24px padded card at the top, `bg-surface-hover` + 1px `border-primary` (not ghost-border — this is the only in-modal surface that uses primary as a border, exactly to pull the eye). |
| Sync CTA button label | — | `SIGN IN TO SYNC` — mirrors the card heading, reinforces benefit clarity (not a bare "SIGN IN"). |
| Save / Cancel CTAs | Bare `SAVE` / `CANCEL` | Upgraded to `SAVE PROFILE` / `DISCARD CHANGES` in step with the signed-in refactor. One label vocabulary across both states avoids surprise when a user signs in and the action row shifts identity. |
| Rest of modal | Unchanged | Unchanged. |

**`SIGN IN TO SYNC` CTA behaviour:** Click closes settings-modal, opens auth-modal. This means users can open settings → see the CTA → click through to auth without interrupting their flow. Rationale: some users will explore settings before signing in (checking "is this an account-less app?") and the CTA needs to be **in the place they'll look**.

### 7. Sidebar Profile Widget (refactor per D-09)

Replaces today's "Set up profile" CTA at the sidebar bottom.

**Anonymous state:**

```
┌─ sidebar bottom, 240px width (or 64px collapsed) ───┐
│                                                      │
│  ┌─ 36px × 216px (12px inset), bg-primary ──────┐  │
│  │         SIGN IN                               │  │  ← 11/mono/700/text-text-primary CTA
│  └────────────────────────────────────────────────┘  │     hover: glow-blue shadow
│                                                      │
│  (existing version string below, unchanged)          │
└──────────────────────────────────────────────────────┘
```

Collapsed (64px rail): single 36×36 icon button with Material Symbols `login` glyph, `bg-primary`, `aria-label="Sign in"`, tooltip on hover = `Sign in`.

Click opens auth-modal.

**Authed state:**

```
┌─ sidebar bottom ────────────────────────────────────┐
│                                                      │
│  ┌─ 56px row, transparent bg, hover bg-surface ──┐  │
│  │  ┌─32×32┐  James Arnall                       │  │  ← 32px avatar (user-uploaded →
│  │  │avatar│  james@arnall.dev                   │  │     Google avatar_url → initials)
│  │  └──────┘  14/700/text-primary                 │  │     + 11/mono/muted email below
│  │            11/mono/muted                       │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  (version string)                                    │
└──────────────────────────────────────────────────────┘
```

Collapsed (64px rail): just the 32×32 avatar, centred, `aria-label="Open settings"`, tooltip = display name.

Click opens settings-modal.

**Transition between states (Claude's discretion — chosen):** Instant swap, no fade/slide. Reason: the state change only happens at sign-in or sign-out — moments where the user *wants* fast visible feedback, not a 200ms reveal. Matches Phase 1's "Instant content swap, no transition animation" (D-11) pattern for route changes. Reduces perceptual complexity.

---

## Interaction & Motion

| Surface | Transition | Duration | Easing |
|---------|------------|----------|--------|
| Auth modal open | `opacity 0 → 1` backdrop + `scale 0.98 → 1` card | 200ms | ease-out |
| Auth modal close | `opacity 1 → 0` | 150ms | ease-in |
| Magic-link-sent swap (within modal) | `opacity` cross-fade of body content (header stays mounted) | 180ms | ease-out |
| Google button hover | `background-color` `#131314 → #1F1F1F` | 120ms | ease-out |
| Email input focus | `border-color` + `box-shadow` (glow-blue) | 150ms | ease-out |
| Primary CTA hover (`SEND MAGIC LINK`, `SAVE PROFILE`, `KEEP LOCAL PROFILE`, `SIGN IN TO SYNC`) | `box-shadow: 0 0 12px var(--color-glow-blue)` fade-in | 150ms | ease-out |
| `SIGN OUT` hover | `background-color` transparent → `rgba(226,56,56,0.1)` + `box-shadow: 0 0 8px var(--color-glow-red)` | 120ms | ease-out |
| Resend cooldown tick | Text content swap every 1s — no transition (instant) | 0ms | n/a |
| First-sign-in prompt open | `opacity 0 → 1` backdrop + `scale 0.96 → 1` card (slightly more dramatic than auth-modal — consequential decision deserves presence) | 240ms | ease-out |
| First-sign-in prompt close | `opacity 1 → 0` | 180ms | ease-out |
| Sidebar profile widget anonymous ↔ authed | Instant swap | 0ms | n/a |
| Auth-callback overlay spinner | CSS `@keyframes` rotation (existing `cf-spin` pattern from Phase 9 if present, otherwise a 1s-duration rotate keyframe) | 1000ms infinite | linear |
| Auth-callback overlay success flash | Spinner → check icon swap, `opacity 0 → 1` | 180ms | ease-out |
| Settings modal signed-in ↔ signed-out re-render | Instant (same modal element, body content replaced) | 0ms | n/a |

**Reduced motion:** extend the existing `@media (prefers-reduced-motion: reduce)` block in `main.css` (already covers `cf-pulse`, Phase 8 panel, Phase 9 Vandalblast surfaces) to add auth-modal, first-sign-in prompt, and the auth-callback spinner. All durations collapse to 0.01ms. The spinner swaps to a static glyph (no rotation) with caption text unchanged — the overlay still conveys "we're working on it" without the motion cue.

**Keyboard shortcuts:** None added in Phase 10. The sidebar click is the single documented entry point (D-09). A keyboard shortcut is listed in CONTEXT.md Claude's Discretion but is explicitly declined here — every new keyboard shortcut has a discoverability cost, and v1.1 already ships enough new shortcuts in Phases 8 + 9. Revisit in v1.2 if usage data supports it.

---

## Copywriting Contract

All terminal chrome + CTAs use JetBrains Mono 11/700 uppercase. Body copy uses Space Grotesk sentence-case.

### Auth modal

| Element | Copy |
|---------|------|
| Modal header | `SIGN IN` |
| X close tooltip | `Close sign in` |
| Google CTA | `SIGN IN WITH GOOGLE` |
| OR divider label | `OR` |
| Email field label | `EMAIL` |
| Email placeholder | `you@email.com` |
| Magic-link CTA (idle, email invalid) | `SEND MAGIC LINK` (disabled) |
| Magic-link CTA (email valid) | `SEND MAGIC LINK` |
| Magic-link CTA (sending) | `SENDING…` |
| Email invalid inline error | `Enter a valid email address.` |
| Helper text below CTA | `We'll send you a one-time link. No password needed.` |
| Google pending | `OPENING GOOGLE…` |

### Magic-link sent state

| Element | Copy |
|---------|------|
| Swapped heading | `CHECK YOUR INBOX` |
| Primary body | `We sent a link to {email}. Click it to sign in.` (user's email interpolated) |
| Secondary body | `Close this modal and keep working — your session will activate automatically when you click the link.` |
| Close CTA | `CLOSE MODAL` |
| Resend CTA (cooldown active) | `RESEND IN {Ns}` (ticks every second) |
| Resend CTA (ready) | `RESEND MAGIC LINK` |
| Resend CTA (sending) | `SENDING…` |
| Resend success toast | `Fresh magic link on the way.` |

### Auth-callback overlay

| Element | Copy |
|---------|------|
| Heading (pending) | `COMPLETING SIGN-IN…` |
| Caption (pending) | `Mila's recalibrating the sigils. One second.` |
| Heading (success 200ms flash) | `SIGNED IN` |
| Heading (error — link expired / reused) | `SIGN-IN LINK EXPIRED` |
| Error body | `This link is older than 60 minutes or has already been used. Try sending a fresh magic link.` |
| Error CTA | `BACK TO COUNTERFLUX` |
| Post-error toast | `Send a fresh magic link to sign in.` |
| Heading (error — generic) | `COULDN'T FINISH SIGN-IN` |
| Generic error body | `Something went wrong routing your session back. Try again or use a magic link.` |
| Generic error CTA | `BACK TO COUNTERFLUX` |

### First-sign-in profile migration prompt

| Element | Copy |
|---------|------|
| Heading | `WELCOME BACK` |
| Name preview | `{localStorage.profile.name}` (existing value, unchanged) |
| Email chip | `SIGNED IN AS` / `{auth.user.email}` |
| Body | `You had a local profile before signing in. Keep using it for your new account, or start fresh?` |
| Primary CTA | `KEEP LOCAL PROFILE` |
| Secondary CTA | `START FRESH` |
| Reassurance line | `Mila will keep your local profile either way — you can still sign out and revert.` |
| Post-keep toast | `Profile synced to cloud.` |
| Post-fresh toast | `Cloud profile created.` |

### Settings modal (signed-in)

| Element | Copy |
|---------|------|
| Overline above email | `SIGNED IN AS` |
| Email value | `{auth.user.email}` (read-only) |
| Avatar label | `AVATAR` |
| Upload photo CTA | `UPLOAD PHOTO` (existing) |
| Use Google avatar CTA | `USE GOOGLE AVATAR` |
| Remove avatar CTA | `REMOVE` (existing) |
| Display name label | `DISPLAY NAME` |
| Save CTA | `SAVE PROFILE` — noun-anchored, replaces legacy bare `SAVE`. Disambiguates from any future "save deck / save collection / save setting" action and anchors the label to the "Profile updated." success toast already declared on the next line. |
| Cancel CTA | `DISCARD CHANGES` — noun-anchored, replaces legacy bare `CANCEL`. Communicates the actual effect (display-name + avatar edits are thrown away) rather than a generic "bail out" semantic, and keeps parity with the destructive-but-reversible tone of the surrounding modal. |
| Sign out CTA | `SIGN OUT` |
| Save success toast | `Profile updated.` (existing) |
| Sign-out success toast | `Signed out. Your data stays on this device.` (anchors D-22 — explicitly reassures that local Dexie is untouched) |
| Sign-out error toast | `Couldn't sign out. Check your connection and try again.` |
| Use Google avatar success toast | `Google avatar applied.` |

### Settings modal (signed-out — additive)

| Element | Copy |
|---------|------|
| Sync CTA card heading | `Sign in to sync across devices` |
| Sync CTA card body | `Your collection, decks, and games stay on this device — but you can sync them to the cloud.` |
| Sync CTA button | `SIGN IN TO SYNC` — mirrors the card heading, keeps benefit-clarity in the CTA itself (not a bare `SIGN IN`). |
| Save CTA | `SAVE PROFILE` (same noun-anchored label as the signed-in state — one vocabulary across both auth states) |
| Cancel CTA | `DISCARD CHANGES` (same noun-anchored label as the signed-in state) |

### Sidebar profile widget

| Element | Copy |
|---------|------|
| Anonymous CTA | `SIGN IN` |
| Anonymous CTA tooltip (collapsed sidebar) | `Sign in` |
| Authed widget name line | `{profile.name}` or `{auth.user.user_metadata.full_name}` or `{auth.user.email.split('@')[0]}` (priority order) |
| Authed widget email line | `{auth.user.email}` |
| Authed widget aria-label | `Open settings — signed in as {name}` |

> **Sidebar CTA note:** The sidebar `SIGN IN` label stays bare (not `SIGN IN TO SYNC`) because the widget is spatially anchored, persistent chrome — the user sees it constantly, and a single verb + subject on repeat chrome reads cleaner than a 3-word phrase. The settings-modal sync CTA, by contrast, is only visible when the user explicitly opens settings; there, the longer benefit-clarity label earns its keep. Same action, different surface, different copy budget.

### Toasts (wired through existing `toast.js` store)

| Scenario | Type | Copy |
|----------|------|------|
| Magic-link sent (first try) | info | `Magic link sent. Check your inbox.` |
| Magic-link resent | info | `Fresh magic link on the way.` |
| Magic-link rate-limited | warning | `Magic link blocked — too many attempts. Wait a minute and try again.` |
| Magic-link network error | error | `Couldn't send magic link. Check your connection and try again.` |
| Google popup cancelled | info | `Google sign-in cancelled. Try again or use a magic link.` |
| Google OAuth error | error | `Couldn't sign in with Google. Check your connection and try again.` |
| Callback code exchange error | error (in-overlay, not toast) | *(handled inline in overlay — no toast)* |
| Sign-in success (post-callback) | success | `Welcome, {display name}.` (Mila-flavoured: uses the user's name, not a generic "Signed in") |
| Sign-out success | success | `Signed out. Your data stays on this device.` |
| Sign-out error | error | `Couldn't sign out. Check your connection and try again.` |
| Profile sync (after first-sign-in keep-local) | success | `Profile synced to cloud.` |
| Profile sync (after first-sign-in start-fresh) | success | `Cloud profile created.` |
| Profile save (existing path) | success | `Profile updated.` (existing, unchanged) |
| Google avatar applied | success | `Google avatar applied.` |

### Voice rules

- UPPERCASE + JetBrains Mono for all terminal CTAs, field labels, section overlines, countdown chips. No exceptions.
- Sentence-case for body copy and toast bodies. Conversational confirmation, not shouted.
- Mila's voice surfaces in: the auth-callback overlay caption (`Mila's recalibrating the sigils. One second.`) and post-sign-in toast (`Welcome, {name}.`). Arcane + terse. Never apologetic.
- Numbers as digits (`30s`, `60 minutes`), never spelled out.
- The word "password" appears exactly zero times in user-facing copy (Counterflux is passwordless — mentioning passwords would confuse the mental model).
- Error copy always pairs a problem statement with a next action (`...try sending a fresh magic link`, `...check your connection and try again`, `...wait a minute and try again`). No dead-ends.
- **CTAs are noun-anchored.** Labels name what the action operates on (`SAVE PROFILE`, `DISCARD CHANGES`, `SEND MAGIC LINK`, `CLOSE MODAL`, `SIGN IN TO SYNC`) rather than relying on bare verbs (`SAVE`, `CANCEL`, `SEND`, `CLOSE`, `OK`). Exception: single-word CTAs where the surrounding context fully disambiguates — the sidebar `SIGN IN` (persistent chrome, one action), `REMOVE` (sits next to the avatar it removes), `START FRESH` (its sibling `KEEP LOCAL PROFILE` tells the user what "fresh" means), `SIGN OUT` (universally understood, and the destructive styling reinforces it).

### Destructive actions in Phase 10

| Action | Confirmation approach |
|--------|----------------------|
| Sign out | **No `window.confirm` dialog.** Single click → session cleared → toast surfaces `Signed out. Your data stays on this device.`. Rationale: the destructive signal is already in the button colour (secondary red + glow-red on hover), the local data is untouched (D-22), and the user can simply sign back in. Confirmation dialogs for reversible actions are friction, not safety. |
| Discard changes (`DISCARD CHANGES` in settings modal) | **No `window.confirm` dialog.** The label itself names the consequence (changes discarded, not "cancelled"). Pressing the button reverts the display-name + avatar fields to their last-saved values and closes the edit mode. The user can re-enter edits if they misclicked. Reversible action; no dialog-on-top-of-dialog. |
| Clear local profile (`REMOVE` avatar, blank display name, save) | No confirmation — non-destructive, fully reversible by re-entering. Existing pattern. |
| "Start fresh" in first-sign-in prompt | **The prompt itself is the confirmation.** Two explicit buttons, impossible to dismiss by accident (Escape + backdrop disabled). "Start fresh" does not delete the localStorage profile per D-19 — it's still there if the user signs out. No dialog-on-top-of-dialog. |

---

## Accessibility

| Dimension | Contract |
|-----------|----------|
| Colour contrast | Primary CTA white on `#0D52BD` = 7.0:1 (AAA). Text-primary `#EAECEE` on `bg-surface #14161C` = 15.7:1 (AAA). Text-muted `#7A8498` on `#14161C` = 4.6:1 (AA body). Text-secondary `#E23838` on `#14161C` = 5.2:1 (AA body — validated for error copy + sign-out label). Google button text `#E3E3E3` on Google's `#131314` = 13.4:1 (AAA). |
| Keyboard navigation | Auth modal tab order: Google button → email input → SEND MAGIC LINK → X close. Magic-link-sent state: CLOSE MODAL → RESEND. First-sign-in prompt: KEEP LOCAL PROFILE → START FRESH (no other focusable surfaces — Escape and backdrop are disabled). Settings modal (signed-in): X close → SIGNED IN AS chip (skipped, not focusable) → avatar UPLOAD → USE GOOGLE AVATAR (if present) → REMOVE → DISPLAY NAME → SAVE PROFILE → DISCARD CHANGES → SIGN OUT. Settings modal (signed-out): X → sync-CTA SIGN IN TO SYNC → AVATAR UPLOAD → REMOVE → DISPLAY NAME → EMAIL → SAVE PROFILE → DISCARD CHANGES. |
| Focus ring | `2px solid var(--color-primary)` with `outline-offset: 2px` on every focusable surface except the Google button, which uses its own `2px solid var(--color-primary)` outline with 2px offset (Google brand guidelines don't prescribe a focus style; we supply one that matches the rest of the app). Never suppress. |
| Screen reader labels | Auth modal: `aria-labelledby` pointing to the `SIGN IN` heading. X close: `aria-label="Close sign in"`. Google button: `aria-label="Sign in with Google"`. Email input: `aria-label="Email"` + linked `<label>`. SEND MAGIC LINK button: inherits visible text. Resend button in cooldown: `aria-label="Resend magic link — available in 27 seconds"` (interpolated seconds). First-sign-in prompt: `role="dialog"` + `aria-modal="true"` + `aria-labelledby="welcome-back-heading"` + `aria-describedby="welcome-back-body"`. Sidebar profile widget (anonymous): `aria-label="Sign in"`. Sidebar profile widget (authed): `aria-label="Open settings — signed in as {name}"`. Sign out button: `aria-label="Sign out"` (visible text is clear enough, but explicit for screen readers). Settings modal save/cancel: `aria-label="Save profile"` / `aria-label="Discard changes"` inherit visible text — no override needed. |
| ARIA live regions | Magic-link-sent body content (the `CHECK YOUR INBOX` swap) wraps in `aria-live="polite"` so screen readers announce the new state without being abrasive. Resend countdown is **not** wrapped in `aria-live` — announcing every second would be deafening; the button's `aria-label` update on click is sufficient. |
| Focus trap | Auth modal, first-sign-in prompt, and settings modal all trap focus inside the card (tab from last element wraps to first). Implement via a thin `focus-trap` utility inside each component's open handler — no library required. |
| Focus restoration | Auth modal close → focus returns to the sidebar "SIGN IN" CTA (anonymous) or to whatever triggered it. Settings modal close → focus returns to the sidebar profile widget. First-sign-in prompt closes into settings-modal being auto-hidden → focus lands on the sidebar profile widget. Auth-callback overlay unmounts → focus lands on the first element of the destination screen (same behaviour as any route change — no special handling needed). |
| Reduced motion | All Phase 10 transitions honour `prefers-reduced-motion: reduce` (durations → 0.01ms, spinner stops rotating but keeps caption). |
| Colour-independence | Error states never rely on colour alone — inline error text always includes the word `Enter…` / `Couldn't…` / `Check…`; the `text-secondary` tint reinforces but does not substitute. |

---

## Empty States

| Surface | State | Heading | Body | CTA |
|---------|-------|---------|------|-----|
| Auth modal | Default (no interaction yet) | `SIGN IN` | *(none — the modal itself is the empty state)* | Google + magic-link |
| Settings modal (signed-out) | User has never signed in | Standard form + sync-CTA card at top | `Your collection, decks, and games stay on this device — but you can sync them to the cloud.` | `SIGN IN TO SYNC` |
| Sidebar profile widget | Anonymous | `SIGN IN` | *(widget body)* | *(the CTA is the widget)* |
| First-sign-in prompt | User has no localStorage profile | **Prompt is skipped entirely (D-20)** — fresh cloud row written silently | n/a | n/a |

---

## Error States

| Surface | Trigger | Heading | Body | CTA |
|---------|---------|---------|------|-----|
| Auth modal | Email field fails regex on blur | *(inline, under input)* | `Enter a valid email address.` | *(none — clears on next input)* |
| Auth modal | Magic-link send network failure | Toast (error) | `Couldn't send magic link. Check your connection and try again.` | *(toast only; modal returns to idle)* |
| Auth modal | Magic-link rate-limited by Supabase | Toast (warning) | `Magic link blocked — too many attempts. Wait a minute and try again.` | *(toast only)* |
| Auth modal | Google OAuth popup cancelled | Toast (info) | `Google sign-in cancelled. Try again or use a magic link.` | *(toast only; modal returns to idle)* |
| Auth modal | Google OAuth returns error | Toast (error) | `Couldn't sign in with Google. Check your connection and try again.` | *(toast only)* |
| Auth-callback overlay | Code exchange fails — expired link | `SIGN-IN LINK EXPIRED` | `This link is older than 60 minutes or has already been used. Try sending a fresh magic link.` | `BACK TO COUNTERFLUX` → opens auth-modal |
| Auth-callback overlay | Code exchange fails — generic | `COULDN'T FINISH SIGN-IN` | `Something went wrong routing your session back. Try again or use a magic link.` | `BACK TO COUNTERFLUX` |
| Settings modal (signed-in) | Sign-out network failure | Toast (error) | `Couldn't sign out. Check your connection and try again.` | *(toast only; modal stays open with signed-in state)* |
| Settings modal (signed-in) | Display-name save fails | Toast (error) | `Couldn't save profile. Check your connection and try again.` | *(toast only; modal stays open with unsaved edits)* |
| First-sign-in prompt | Upsert profile row fails | Toast (error) | `Couldn't save profile to cloud. Working locally for now.` | *(toast only; prompt closes; profile stays local — the next profile save attempt can retry)* |

**Design principle:** Every error pairs a human-readable problem statement with a concrete next action. No raw Supabase error codes ever reach the user. No generic "Something went wrong" — always append the recovery path.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — project uses Alpine.js, not React |
| Third-party | none | not applicable |
| NPM (auth-adjacent) | `@supabase/supabase-js@2.103.x` (AUTH-01) | Added via `npm install`. Established open-source library, 30k+ GitHub stars, maintained by Supabase PBC. Lazy-imported only — not in the unauthenticated cold-boot bundle. Vetted in RESEARCH.md §Stack. |

Phase 10 ships zero third-party UI registry imports. Every new component is authored in `src/components/*.js` as vanilla-DOM modules matching the existing v1.0 + Phase 7/8/9 codebase pattern.

---

## Component Inventory (files touched)

| File | Disposition | Reason |
|------|-------------|--------|
| `src/components/auth-modal.js` | **New** — vanilla-DOM modal mirroring `settings-modal.js` mount pattern; two body states (idle / magic-link-sent) swap via DOM replacement | AUTH-02 + AUTH-03, D-08, D-10, D-12 |
| `src/components/first-sign-in-prompt.js` | **New** — vanilla-DOM modal mirroring `migration-blocked-modal.js` mount pattern (no Escape / backdrop dismiss; consequential decision) | D-16..D-20 |
| `src/components/auth-callback-overlay.js` | **New** — splash-style full-screen overlay mounted by router on `/auth-callback` match; torn down after `exchangeCodeForSession` resolves + navigation fires | D-06, D-11 |
| `src/components/settings-modal.js` | **Refactor** — branch on `Alpine.store('auth').status` at render time; signed-in path adds `SIGNED IN AS` chip + `USE GOOGLE AVATAR` button (conditional) + separator + `SIGN OUT` button; both paths upgrade the action row from bare `SAVE`/`CANCEL` to noun-anchored `SAVE PROFILE`/`DISCARD CHANGES`; signed-out path adds the sync-CTA card at top with a `SIGN IN TO SYNC` button | D-13, D-14 |
| `src/components/sidebar.js` | **Edit** — profile-widget click handler branches on `auth.status`; anonymous shows `SIGN IN` CTA, authed shows name + avatar opening settings-modal. Label `Set up profile` / `displayName` binding swaps out. (Layout is rendered via Alpine directives in `index.html`; the `.js` helper just provides the branch.) | D-09 |
| `index.html` | **Edit** — sidebar profile widget Alpine template gets signed-in / signed-out branch. Add `<div id="cf-auth-modal-root">` + `<div id="cf-first-sign-in-root">` empty mount points near `<body>` bottom if the modals need named roots (or they can mount to `body` directly — Claude's discretion during planning). | D-09, D-13 |
| `src/stores/auth.js` | **New** — Alpine store with shape from D-30: `{ status, user, session, signInMagic, signInGoogle, signOut, init }`; subscribes to Supabase `onAuthStateChange` and flips `status` | D-28, D-30, AUTH-05 |
| `src/stores/profile.js` | **Refactor** — add `_source: 'local'|'cloud'` field, `avatar_url_override`, `hydrate()` method; subscribe to auth store via `Alpine.effect` and re-hydrate on status flip | D-13, D-15, D-21, D-28 |
| `src/services/supabase.js` | **New** — single `createClient()` call site with PKCE flow config (D-07) | D-03, D-07 |
| `src/router.js` | **Edit** — register `/auth-callback` route **first** (before other routes); on match, mount `auth-callback-overlay.js` and call `exchangeCodeForSession` | D-06 |
| `src/main.js` | **Edit** — register `initAuthStore()` before router resolve; wire `Alpine.effect` bridging auth → profile hydrate; do NOT eager-import `src/services/supabase.js` | D-28, D-29 |
| `src/styles/main.css` | **Extend** — add Phase 10 entries to the existing `@media (prefers-reduced-motion: reduce)` block; optionally add `cf-auth-google-btn` utility class if the brand-colour hex values feel verbose in the component file | Reduced motion contract |

**Do NOT touch in this phase:**
- `src/components/toast.js` (existing store handles all Phase 10 toasts; no new toast types needed — info/success/warning/error cover every Phase 10 surface)
- `src/components/migration-blocked-modal.js` (reused as a pattern reference only — no edits to the file itself)
- `src/components/topbar.js` (no topbar sign-in button per D-09)
- Any Dexie schema file (D-32 — zero hooks this phase)
- Any sync-related file (all Phase 11)

---

## Visual Regression Anchors

For the executor + auditor: these are the seven QA anchors the finished Phase 10 must visibly demonstrate.

1. **Lazy-load discipline** — Open DevTools Network tab, cold-boot the app as anonymous, navigate every screen: **no `supabase-js` chunk loads**. Only when the user clicks the sidebar `SIGN IN` CTA does the chunk fetch. (Not strictly visual, but the promise of AUTH-01 and the foundation for every other Phase 10 surface behaving correctly.)
2. **Google button brand fidelity** — Open auth-modal. Google button renders with the official "G" multi-colour SVG, dark-theme `#131314` background, `#8E918F` 1px border, `#E3E3E3` text. No `bg-primary` tint, no mono G mark.
3. **In-modal swap without screen takeover** — Submit a magic-link email. The modal body swaps to `CHECK YOUR INBOX` with the warning-tinted mail icon. The X close still works. Clicking `CLOSE MODAL` dismisses the modal; the Counterflux app behind it is still usable — not blocked by an overlay. Clicking the magic link in the user's email (separate tab) activates the session transparently; `onAuthStateChange` fires; the app's sidebar profile widget flips from anonymous to authed without the user revisiting the tab.
4. **Pre-auth route preservation** — Anonymous user navigates to `/#/thousand-year-storm/{deckId}`, clicks sidebar `SIGN IN`, completes Google OAuth. The auth-callback overlay shows for <2s, then the app lands back at `/#/thousand-year-storm/{deckId}` — not the dashboard.
5. **First-sign-in prompt, then skipped** — First sign-in with a non-empty localStorage profile triggers the `WELCOME BACK` prompt. Clicking `KEEP LOCAL PROFILE` closes it and writes the cloud row. Sign out and sign back in → prompt does not appear a second time (the cloud row exists, so there's nothing to reconcile). A user with no localStorage profile never sees the prompt on first sign-in.
6. **Sign-out preserves local data** — Sign in, add a card to collection, sign out. Collection count unchanged. Settings modal (if reopened) shows the signed-out view with the sync-CTA card at top. The route the user was on is unchanged — no navigation.
7. **Google avatar conditional button** — Sign in with Google → settings modal shows three avatar CTAs in a row (`UPLOAD PHOTO`, `USE GOOGLE AVATAR`, `REMOVE`). Sign in with magic link (no Google identity) → settings modal shows only two avatar CTAs (`UPLOAD PHOTO`, `REMOVE`). The `USE GOOGLE AVATAR` button is **not rendered** at all for magic-link users — not disabled, not hidden, absent.
8. **Noun-anchored settings CTAs** — Open settings modal (signed-in or signed-out). Action row reads `SAVE PROFILE` / `DISCARD CHANGES`, never bare `SAVE` / `CANCEL`. Tab order matches the accessibility contract. `SAVE PROFILE` hover shows the glow-blue shadow; `DISCARD CHANGES` uses `bg-surface-hover` (secondary treatment — reversible, non-destructive action styling).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

*Generated by gsd-ui-researcher 2026-04-17. Revised 2026-04-17 — fixed copywriting BLOCK (SAVE → SAVE PROFILE, CANCEL → DISCARD CHANGES); applied optional FLAGs (CLOSE → CLOSE MODAL in magic-link-sent state, SIGN IN → SIGN IN TO SYNC on settings-modal sync card). Anchored to `src/styles/main.css` `@theme` tokens and canonical `.planning/milestones/v1.0-phases/01-foundation-data-layer/01-UI-SPEC.md`. All decisions pre-populated from `10-CONTEXT.md` D-08..D-22 (identity UX) + D-28..D-31 (store init UX) + Claude's Discretion items resolved inline — no new user input required.*
