---
phase: 11
slug: cloud-sync-engine
status: approved
reviewed_at: 2026-04-18
shadcn_initialized: false
preset: none
created: 2026-04-18
---

# Phase 11 — UI Design Contract

> Visual and interaction contract for the cloud sync engine shipped in Phase 11: the 4-state topbar sync-status chip (SYNC-07), the first-sign-in reconciliation modal (SYNC-04, D-01..D-04 — **milestone-load-bearing safety guardrail**), the sync-errors modal (D-09), the bulk-pull splash for new-device first sign-in (D-12..D-14), and the supporting toast inventory (D-10, D-11).
>
> Anchored to the canonical Neo-Occult Terminal tokens declared in `src/styles/main.css` `@theme` and baseline `01-UI-SPEC.md` (v1.0). Phase 10 extended the canonical tokens onto auth surfaces; Phase 11 extends them onto sync surfaces. **No new tokens, no new fonts, no new shadows, no new border-radii.** If a decision can't be made using an existing `--color-*` / `--spacing-*` / font family, the decision is wrong.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Alpine.js 3.15 + Tailwind v4 + Vite; shadcn not applicable — no React) |
| Preset | not applicable |
| Component library | none — vanilla-DOM modals matching `src/components/migration-blocked-modal.js` (blocking) and `src/components/settings-modal.js` (dismissible) patterns; topbar chip extends the existing Alpine template `index.html` lines 288-327 |
| Icon library | Material Symbols Outlined (existing `index.html` link) — chip glyphs, modal affordances, splash spinner |
| Display font | Syne (self-hosted, 400/700) |
| Body font | Space Grotesk (self-hosted, 400/700) |
| Mono font | JetBrains Mono (self-hosted, 400/700) |
| CSS framework | Tailwind v4 via `@theme` in `src/styles/main.css` — use `var(--color-*)` or Tailwind utility; never hard-code hex. Inline-style parity with existing vanilla-DOM modals is acceptable to keep diffs minimal. |
| Border radius | 0px everywhere (Organic Brutalism, no exceptions) |

**Anchor:** `src/styles/main.css` lines 3-40. **Canonical baseline:** `.planning/milestones/v1.0-phases/01-foundation-data-layer/01-UI-SPEC.md`. **Immediate precedent:** `.planning/phases/10-supabase-auth-foundation/10-UI-SPEC.md` for modal patterns + auth surface copy voice. All downstream components must reference these, not re-derive them.

**Source:** CONTEXT.md D-01..D-16; CLAUDE.md `Visual Identity` block; `src/styles/main.css` @theme tokens.

---

## Spacing Scale

Declared values (already in `@theme`, multiples of 4):

| Token | Value | Tailwind utility | Usage in Phase 11 |
|-------|-------|------------------|-------------------|
| xs | 4px | `p-1` / `gap-1` | Chip icon-to-label gap; tooltip internal padding; vertical gap inside stacked reconciliation count rows (`Local: 45 cards` / `Household: 120 cards`) |
| sm | 8px | `p-2` / `gap-2` | Chip horizontal padding (matches existing chip `px-sm py-xs`); gap between sync-errors-modal row columns (table / op / timestamp); pulse-dot → label gap in `SYNCED`/`SYNCING…` states |
| md | 16px | `p-4` / `gap-4` | Reconciliation modal field-to-field vertical rhythm; sync-errors modal row vertical padding; splash heading → body gap |
| lg | 24px | `p-6` / `gap-6` | Reconciliation modal body → action stack gap; sync-errors modal header-to-first-row gap; splash body → progress bar gap |
| xl | 32px | `p-8` | Modal outer padding (top/left/right/bottom) — identical to Phase 7 migration-blocked-modal, Phase 10 first-sign-in-prompt, settings-modal 32px inset |
| 2xl | 48px | `p-12` | Sync-pull splash vertical padding (centred progress block); reconciliation modal top breathing-room on very tall viewports (body stays centred) |
| 3xl | 64px | `p-16` | Not used in this phase |

**Layout constants (derived, not in `@theme`):**

| Constant | Value | Rationale |
|----------|-------|-----------|
| Reconciliation modal card width | **480px fixed** | Slightly wider than Phase 10 first-sign-in prompt (440px) — the count-comparison grid needs ~100px more horizontal room to display `Local: 45 cards, 3 decks, 10 games, 8 watchlist` + `Household: 120 cards, 8 decks, 15 games, 12 watchlist` without line-wrapping. Still within the established "consequential decision" card footprint family (settings 420, first-sign-in 440, reconciliation 480). |
| Reconciliation modal backdrop | `rgba(11, 12, 16, 0.95)` | Matches `migration-blocked-modal.js` + `first-sign-in-prompt.js` — the **0.95 variant** (not 0.85 dismissible-modal alpha) is the lockdown signal. Anything the user can't dismiss gets the heavier backdrop. |
| Sync-errors modal card width | **520px fixed** | Wider than reconciliation because each row displays 4 columns (table, op, timestamp, retry/discard actions) + must breathe at 14px body. Matches Phase 8 precon-browser card footprint for comparable list-of-rows UIs. |
| Sync-errors modal backdrop | `rgba(11, 12, 16, 0.85)` | Matches `settings-modal.js` — dismissible modal uses 0.85 alpha. User can Escape/X/backdrop-click out. |
| Sync-pull splash | **100vw × 100vh, full opacity `#0B0C10`** | Same pattern as Phase 7 bulk-data splash and Phase 10 auth-callback overlay. Full viewport blocks the app during hydration. |
| Topbar chip height | **24px** (matches existing chip `px-sm py-xs` on 11/mono/700 label) | Zero visual change to topbar layout — the chip's bounding box is identical to v1.0 `LIVE`/`OFFLINE`/`STALE 3H`. Only the label + icon set + colour swap. |
| Chip internal icon size | **12px** | 12 = 3 × 4pt. Matches the 8px dot + padding the current chip reserves (dot is `w-2 h-2 = 8px` plus 4px visual centring). Material Symbols at 12px is readable at 1× pixel density — tested by Phase 9 Vandalblast counter glyphs. |
| Chip tooltip width | auto (`max-width: 280px`) | Shrink-wraps around pending-count copy `12 pending changes.` on one line; wraps gracefully for longer strings via `max-width` cap. Matches Phase 8 precon-browser tooltip footprint. |
| Sync-errors row height | **56px minimum** | Accommodates 14/400 table name on row 1 + 11/mono/400 timestamp on row 2 + 32px-tall Retry/Discard buttons on the right — same row anatomy as Phase 6 dashboard notification list items. |
| Retry/Discard row-action button | **32 × 72px** (height × width) | Compact — the user may need to hit 5+ of these in a failure burst. 32px vertical matches the existing mass-entry row-action buttons; 72px width fits `RETRY` / `DISCARD` at 11/mono/700 with 8px horizontal padding. |
| Splash progress bar | **320 × 8px** (width × height) | Matches Phase 7 bulk-data splash progress bar dimensions exactly. No divergence. |
| Modal close icon button | **32 × 32px** hit target, 20px glyph centred | Identical to Phase 10 / Phase 8 / Phase 7 close buttons. One icon-button footprint across the app. |
| Reconciliation/splash enter/exit transition | **200ms ease-out** (open) / **150ms ease-in** (close); splash is 0ms (instant — full-screen blocker) | Matches Phase 10 modal motion constants. |

Exceptions: none. Every value above reduces to a multiple of 4.

**Source:** CONTEXT.md D-03 (count-comparison grid), D-09 (dismissible errors modal), D-12 (bulk-pull splash reuses Phase 7 pattern); existing `settings-modal.js` / `migration-blocked-modal.js` / `first-sign-in-prompt.js` / `splash-screen.js` dimensions.

---

## Typography

Four-role scale. Sizes and weights map 1:1 to the canonical 01-UI-SPEC scale.

| Role | Size | Weight | Line Height | Family | Letter spacing | Case | Usage in Phase 11 |
|------|------|--------|-------------|--------|----------------|------|-------------------|
| Display | 48px | 700 | 1.1 | Syne | -0.02em | normal | **Not used in this phase** (reserved for screen heroes) |
| Heading | 20px | 700 | 1.2 | Syne | 0.01em | UPPERCASE | Reconciliation modal title (`DATA ON BOTH SIDES`); sync-errors modal title (`SYNC ERRORS`); sync-pull splash title (`SYNCING HOUSEHOLD DATA`); splash error title (`SYNC FAILED`) |
| Body | 14px | 400 (regular) or 700 (emphasis) | 1.5 | Space Grotesk | normal | normal | Reconciliation body copy (`Mila found data on both sides…`); reconciliation count values (`45 cards, 3 decks, 10 games, 8 watchlist` — 400) and section labels (`Local` / `Household (cloud)` — 700); sync-errors row table name (`collection`, `decks` — 400); splash body copy (`Grabbing your household archive…`) |
| Label | 11px | 400 or 700 | 1.3 | JetBrains Mono | 0.15em | UPPERCASE | Every CTA (`MERGE EVERYTHING`, `KEEP LOCAL`, `KEEP CLOUD`, `RETRY`, `DISCARD`, `RETRY SYNC`, `CLOSE`); every chip label (`SYNCED`, `SYNCING…`, `OFFLINE`, `SYNC ERROR`); section overlines (`LOCAL`, `HOUSEHOLD`, `PENDING CHANGES`, `FAILED AT`); sync-errors timestamps (`12:43:07`); splash progress caption (`SYNCED 127 / 845 CARDS`) |

**Label weight guidance** (continues the canonical pattern):

| Context | Weight |
|---------|--------|
| Data values, timestamps, inline counts (`12 PENDING`, `12:43:07`, chip pending-count tooltip body) | 400 |
| CTAs, section overlines, chip state labels (`MERGE EVERYTHING`, `SYNCED`, `LOCAL` / `HOUSEHOLD`) | 700 |

**Two weights only: 400 and 700.** No medium. No semibold.

**Source:** 01-UI-SPEC.md Typography table, reused verbatim. Phase 10 precedent confirmed by `first-sign-in-prompt.js` line 127-144 inline styles.

---

## Color

Neo-Occult Terminal 60/30/10 distribution. Every hex below is already in `@theme` (`src/styles/main.css` lines 4-17).

| Role | Token | Value | Tailwind utility | Usage in Phase 11 |
|------|-------|-------|------------------|-------------------|
| Dominant (60%) | `--color-background` | `#0B0C10` | `bg-background` | Backdrops (0.85 dismissible / 0.95 lockdown), sync-pull splash background (full opacity), reconciliation modal count-row chip inset (`bg-background + border-ghost`) |
| Dominant (60%) | `--color-surface` | `#14161C` | `bg-surface` | Reconciliation modal card, sync-errors modal card, sync-errors row background, splash progress-bar track, chip default background (inherits topbar surface) |
| Secondary (30%) | `--color-surface-hover` | `#1C1F28` | `bg-surface-hover` | Secondary CTAs (`KEEP LOCAL`, `KEEP CLOUD` — see note below), `DISCARD` row-action button, sync-errors row hover, chip hover background |
| Secondary (30%) | `--color-border-ghost` | `#2A2D3A` | `border-border-ghost` | Every 1px border — modal edges, sync-errors row separators, count-chip borders, chip default border (matches `px-sm py-xs` chip neutrality), splash progress-bar track border |
| Secondary (30%) | `--color-text-primary` | `#EAECEE` | `text-text-primary` | Reconciliation body copy, modal headings, sync-errors row table names, splash body copy, primary CTA text on blue accent |
| Secondary (30%) | `--color-text-muted` | `#7A8498` | `text-text-muted` | Reconciliation reassurance line, section overlines, sync-errors timestamps, splash caption (`SYNCED 127 / 845 CARDS`), chip `SYNCING…` label, chip tooltip body |
| Secondary (30%) | `--color-text-dim` | `#4A5064` | `text-text-dim` | Disabled sync-errors row buttons (when retry is in-flight); inactive state glyphs |
| **Accent (10%)** — Izzet blue | `--color-primary` | `#0D52BD` | `bg-primary` / `text-primary` / `border-primary` | **`MERGE EVERYTHING` primary CTA background ONLY** (the empathetic default — keep both sides' data); **`RETRY SYNC` primary CTA background on splash error state**; **`RETRY` row-action text + hover glow**; chip `SYNCING…` spinner stroke colour; chip `SYNCED` **check-icon tint** |
| **Accent (10%)** — Izzet red | `--color-secondary` | `#E23838` | `text-secondary` / `border-secondary` | **Destructive only** — chip `SYNC ERROR` icon + label tint; sync-errors modal title glow (subtle — this surface *is* the error state); `DISCARD` row-action button hover glow; reconciliation modal `KEEP LOCAL` / `KEEP CLOUD` **text tint on hover only** (hover = "you are about to choose destructively" warning); splash error state icon + `SYNC FAILED` heading tint |
| Success | `--color-success` | `#2ECC71` | `text-success` | Chip `SYNCED` **pulse-dot** colour (mirrors existing `LIVE` pulse pattern at `index.html` line 313 — `.cf-live-dot` class reused verbatim); reconciliation post-commit confirmation toast icon tint; splash completion flash (200ms before splash unmounts) |
| Warning | `--color-warning` | `#F39C12` | `text-warning` | Chip `OFFLINE` state icon + label tint (same token as Phase 7's `STALE` chip; offline is a "degraded, not broken" semantic, not red) |
| Glow (blue) | `--color-glow-blue` | `rgba(13,82,189,0.3)` | `shadow-[0_0_12px_var(--color-glow-blue)]` | `MERGE EVERYTHING` hover glow; `RETRY SYNC` hover glow; chip `SYNCING…` halo when spinner is active |
| Glow (red) | `--color-glow-red` | `rgba(226,56,56,0.25)` | `shadow-[0_0_8px_var(--color-glow-red)]` | `DISCARD` row-action hover glow; sync-errors modal X close hover glow; chip `SYNC ERROR` state halo (subtle — always-on at 0.15 alpha, not just hover) |

### Accent reserved for

`#0D52BD` (blue) is reserved in Phase 11 for:

1. **`MERGE EVERYTHING` primary CTA background** — the empathetic default in the reconciliation modal. LWW merge preserves both sides' data; blue = the "do the thing that keeps your work" colour, consistent with Phase 10 `KEEP LOCAL PROFILE` using blue.
2. **`RETRY SYNC` primary CTA background** on the splash error state — the one-click recovery action.
3. **`RETRY` row-action text** in the sync-errors modal — per-row recovery; text-only (no background), blue text + hover glow.
4. **Chip `SYNCED` check-icon tint** — minimal: the check glyph gets blue, the pulse-dot stays success-green (matches existing `cf-live-dot`). This pairs "everything's good" with the brand accent in a single small surface.
5. **Chip `SYNCING…` spinner stroke + halo** — active work signal.

`#E23838` (red) is reserved in Phase 11 for:

1. **Chip `SYNC ERROR` state** — icon + label tint + always-on 0.15-alpha halo. The chip is the single channel for sync errors per D-11; red is the load-bearing signal.
2. **Sync-errors modal title subtle tint** — 20/700 `SYNC ERRORS` heading stays text-primary as the default; a 1px `border-secondary` accent runs under the heading as the error-context cue.
3. **`DISCARD` row-action button hover glow** — destructive (irreversibly drops a pending change).
4. **`KEEP LOCAL` / `KEEP CLOUD` hover-tint only** in the reconciliation modal — both are destructive (each discards the *other* side). Hover reveals the text-secondary tint; default state stays neutral so neither button dominates. Rationale: the user should feel the weight on hover, not at rest — resting red on a forced-choice button would bias toward `MERGE EVERYTHING` by intimidation alone.
5. **Splash error state `SYNC FAILED` heading + icon tint** — the manual-RETRY surface.

### Never use accent for

- The chip background — stays transparent over topbar surface; state colour lives in icon + label + glow only.
- The reconciliation modal card edge — stays `border-border-ghost`. The *lockdown* is conveyed by the 0.95 backdrop + absence of X close, not by a red frame.
- The sync-errors modal card edge — stays `border-border-ghost`. It's a list, not an alarm.
- `KEEP LOCAL` / `KEEP CLOUD` resting backgrounds — stay `bg-surface-hover`. Only hover surfaces the destructive-red text tint.
- Section overlines (`LOCAL`, `HOUSEHOLD`, `PENDING CHANGES`) — stay `text-text-muted`. Overlines are chrome, not accent-worthy.
- The sync-pull splash background — stays full-opacity `bg-background`. Matches Phase 7 bulk-data splash.

### Distribution audit

After Phase 11 ships, the composite surfaces (topbar chip in any state + reconciliation modal open + sync-errors modal open + sync-pull splash visible) should yield roughly 60% `bg-background` + `bg-surface` footprint, 30% border-ghost + text-muted + surface-hover (chrome, labels, row backgrounds, secondary CTAs), and 10% accent distributed as: one `bg-primary` button per modal open (`MERGE EVERYTHING` / `RETRY SYNC`) + the chip's state-coloured icon + the chip's pulse-dot + per-row `RETRY` text + occasional `text-secondary` tints (chip error state, destructive hover). No surface outside this split exists — Phase 11 introduces zero brand-colour exceptions.

**Source:** CONTEXT.md D-08 (chip state-coloured icon + label), D-10 (error classification — red is for actionable failures), D-11 (offline = warning, not error), 01-UI-SPEC.md Color section, Phase 10 `first-sign-in-prompt.js` `KEEP LOCAL PROFILE` blue precedent.

---

## Component Anatomy

### 1. Topbar Sync-Status Chip (SYNC-07, D-08) — **REFACTOR of existing connectivity chip**

Replaces the existing connectivity chip at `index.html` lines 288-327. **Not a parallel chip — an in-place refactor.** The v1.0 `LIVE`/`OFFLINE`/`STALE` chip was a proxy for "is your card data fresh?"; Phase 11's chip is a proxy for "is your user data sync'd?". In v1.1 there is no reason to render both — after auth-wall closes (D-40) the user is authed, sync is the authoritative connectivity signal, and the old chip's semantics (bulk-data staleness) become redundant (bulk-data refresh is silent background work, not user-actionable).

**Mount location:** same slot, same surrounding flex layout (`<div class="flex items-center gap-md">` — right section of topbar).

**Binding source:** `Alpine.store('sync').status` — one of `'synced' | 'syncing' | 'offline' | 'error'`.

```
topbar right section (unchanged layout)
┌─ 24px tall chip, px-sm py-xs, transparent bg, border-ghost 1px ─┐
│  [icon 12px]   LABEL                                             │
└──────────────────────────────────────────────────────────────────┘
  ↑ title/tooltip attr: "12 pending changes. Last synced 12:43:07."
```

**Four state variants:**

| State | Left glyph (Material Symbols, 12px) | Label (11/mono/700) | Label + glyph tint | Halo / dot |
|-------|--------------------------------------|---------------------|-------------------|------------|
| `synced` | `check` | `SYNCED` | `text-primary` (blue) glyph + `text-text-primary` label | Success-green pulse-dot **at the left of the glyph** — reuses existing `cf-live-dot` class verbatim (POLISH-08 precedent; matches `LIVE` state's animation) |
| `syncing` | `progress_activity` (auto-rotates via `animation: cf-spin 1s linear infinite`) | `SYNCING…` | `text-primary` glyph + `text-text-muted` label | `shadow: 0 0 8px var(--color-glow-blue)` on the chip's bounding box — subtle presence, not distracting |
| `offline` | `cloud_off` | `OFFLINE` | `text-warning` (#F39C12) glyph + `text-warning` label | static dot (non-pulsing) — `w-2 h-2 bg-warning` — matches existing `STALE` state pattern at `index.html` line 314-315 |
| `error` | `error` | `SYNC ERROR` | `text-secondary` (#E23838) glyph + `text-secondary` label | `shadow: 0 0 8px var(--color-glow-red)` **always on** (not just hover — the chip is a persistent alarm) + static red dot `w-2 h-2 bg-secondary` |

**Tooltip contract (via `title` attribute):**

| State | Tooltip body |
|-------|--------------|
| `synced` | `Last synced {HH:MM:SS}.` (local time) |
| `syncing` | `{N} pending changes.` (interpolated — pulls `Alpine.store('sync').pending_count`) |
| `offline` | `No connection. Changes saved locally; will sync when you're back online.` |
| `error` | `Sync failed. Click to review.` |

**Interaction contract:**

| State | Cursor | Click action |
|-------|--------|--------------|
| `synced` | default | no-op (chip is informational only — matches existing chip behaviour) |
| `syncing` | default | no-op |
| `offline` | default | no-op (D-11 — offline UX is chip-only, no click-to-details) |
| `error` | `cursor: pointer` | **opens `sync-errors-modal`** (D-09) |

**Reduced motion:** the `progress_activity` spinner stops rotating in `prefers-reduced-motion: reduce`; glyph swaps to a static dot. The success pulse-dot already respects reduced motion per existing Phase 7 `@media (prefers-reduced-motion: reduce)` block covering `cf-pulse`.

**Keyboard:** `role="status"` + `aria-live="polite"` on the chip container so screen readers announce state changes without being abrasive. `aria-label` interpolates the full tooltip body (state + pending count or timestamp or error hint). When in `error` state, the chip renders as `<button type="button">` (not `<div>`) so keyboard users can tab to it and hit Enter to open the sync-errors modal. In all other states it renders as `<div role="status">`.

**Collapsed behaviour (topbar unchanged):** topbar does not collapse. Chip stays visible at all viewport widths.

### 2. Reconciliation Modal — `src/components/reconciliation-modal.js` (NEW) — **MILESTONE-LOAD-BEARING LOCKDOWN** (SYNC-04, D-01..D-04)

Vanilla-DOM **blocking** modal. Mirrors `first-sign-in-prompt.js` mount pattern exactly — the Escape-blocker in capture phase, the backdrop `e.preventDefault()`, the `bg-background*0.95` backdrop, the z-70 placement. This is Phase 11's equivalent of Phase 10's D-16 prompt — the ONE screen where an accidental dismiss could silently destroy 5000 cards of data.

Mounted to `document.body` on first authed sign-in **only if** both sides are populated: `localStorage/Dexie has populated synced tables` AND `Supabase cloud has populated rows for this household`. Empty-local-only or empty-cloud-only cases are silent (D-06 — Sharon on fresh device sees the sync-pull splash instead; James with populated local + empty cloud silently pushes local → cloud with no modal).

```
┌─ 100vw × 100vh, rgba(11,12,16,0.95) backdrop, z-70 ─────────────────┐
│                                                                       │
│      ┌─ bg-surface, 480px, 1px border-ghost, 32px pad, z-71 ────┐  │
│      │                                                            │  │
│      │              DATA ON BOTH SIDES                            │  │  ← Syne 20/700 uppercase
│      │                                                            │  │
│      │  Mila found data on both sides. Which should she keep?    │  │  ← 14/400/text-primary body
│      │                                                            │  │
│      │  ┌─ count-comparison grid ──────────────────────────────┐ │  │
│      │  │                                                        │ │  │
│      │  │  LOCAL                              HOUSEHOLD (CLOUD) │ │  │  ← 11/mono/700/text-muted
│      │  │  ─────────                          ───────────────── │ │  │     overlines + 1px border
│      │  │                                                        │ │  │     ghost separator below
│      │  │  45 cards                           120 cards         │ │  │  ← 14/400/text-primary
│      │  │  3 decks                            8 decks           │ │  │     values, right-aligned
│      │  │  10 games                           15 games          │ │  │     within each column
│      │  │  8 watchlist                        12 watchlist      │ │  │
│      │  │                                                        │ │  │
│      │  └────────────────────────────────────────────────────────┘ │  │
│      │                                                            │  │
│      │  ┌──────────────────────────────────────────────────────┐ │  │
│      │  │             MERGE EVERYTHING                          │ │  │  ← 40px primary CTA,
│      │  └──────────────────────────────────────────────────────┘ │  │     bg-primary, the default
│      │                                                            │  │
│      │  ┌──────────────────────────────────────────────────────┐ │  │
│      │  │             KEEP LOCAL                                │ │  │  ← 40px secondary CTA,
│      │  └──────────────────────────────────────────────────────┘ │  │     bg-surface-hover, border
│      │                                                            │  │     ghost; hover → red text
│      │  ┌──────────────────────────────────────────────────────┐ │  │
│      │  │             KEEP CLOUD                                │ │  │  ← 40px secondary CTA,
│      │  └──────────────────────────────────────────────────────┘ │  │     identical treatment
│      │                                                            │  │
│      │  Merge uses last-write-wins by updated_at. The other two  │  │  ← 11/mono/400/text-muted
│      │  options replace one side entirely and are irreversible.  │  │     legal-fine-print clarity
│      │                                                            │  │
│      └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Count-comparison grid (D-03):**

- 2-column CSS grid, 16px gap, 24px bottom margin from body copy → grid → action stack.
- Each column: overline (`LOCAL` / `HOUSEHOLD (CLOUD)`), 1px `border-border-ghost` separator below the overline (full column width), then 4 stacked count rows.
- Count rows: `{N} {table_name}` — e.g. `45 cards`, `3 decks`, `10 games`, `8 watchlist`. **Zero-counts render as `0 cards` not `—`** (consistency over cleverness; user can visually compare columns at a glance).
- **No sample rows, no conflict pre-count** (D-03 rationale: a full overlap scan pre-render is slow for 5000-card collections; counts are enough to gauge scale).
- Profile table **excluded** from the count comparison (Phase 10 already reconciled profile via the `WELCOME BACK` prompt).

**Button stack (D-01):**

Vertical stack, not a horizontal row. Rationale: three buttons in a horizontal row forces the user to eyeball which is primary and risks the "wall of buttons" anti-pattern; a vertical stack with `MERGE EVERYTHING` at top (highlighted accent) + `KEEP LOCAL` + `KEEP CLOUD` beneath (secondary treatment) naturally conveys the recommended default. 16px gap between each button.

| Button | Resting state | Hover state | Click action |
|--------|---------------|-------------|--------------|
| `MERGE EVERYTHING` | `bg-primary` (#0D52BD) + `text-text-primary` label | `shadow: 0 0 12px var(--color-glow-blue)` | Kicks off the LWW merge pipeline (D-02): for each row existing on both sides, the side with the higher `updated_at` wins; ties go to cloud; unresolvable cases (e.g. `deck_cards` atomic-merge edge cases) land in `sync_conflicts`. Modal closes on merge start; chip flips to `SYNCING…`; success toast `Archive merged.` |
| `KEEP LOCAL` | `bg-surface-hover` + 1px `border-border-ghost` + `text-text-primary` label | **Label tint flips to `text-secondary` (#E23838)** + no background change — the red reveal is the "this is destructive" cue | Discards cloud rows, pushes local → cloud wholesale. Modal closes; chip flips to `SYNCING…`; success toast `Local archive kept. Cloud overwritten.` |
| `KEEP CLOUD` | identical treatment to `KEEP LOCAL` | identical | Discards local rows, pulls cloud → local wholesale. Modal closes; chip flips to `SYNCING…`; success toast `Cloud archive kept. Local replaced.` |

**Lockdown (D-04 — non-negotiable):**

- **No X close button.** The header has only the title `DATA ON BOTH SIDES`; no icon button to the right.
- **Escape key disabled.** Capture-phase `keydown` listener on `document` that calls `e.preventDefault()` + `e.stopPropagation()` for `Escape` while the modal is mounted. Pattern mirrors `first-sign-in-prompt.js` lines 153-159.
- **Backdrop click disabled.** Click handler on the overlay element that `e.preventDefault()`s when `e.target === promptEl`. Pattern mirrors `first-sign-in-prompt.js` line 110.
- **No browser-back intercept.** If the user navigates back via browser back-button, the modal does NOT block the navigation (would require intercepting the History API, which is an anti-pattern and creates worse UX than letting them navigate away; the modal will simply re-open on the next app boot because the reconciliation state is idempotent — the `populated/populated` condition persists until the user picks an option).
- **Z-index 70.** Same as Phase 10 first-sign-in prompt. Sits above auth-modal (60), settings-modal (60), and the sync-pull splash (which is z-80 but will have unmounted before this prompt renders — reconciliation happens *after* any empty-cloud pull-splash has completed).

**Accessibility:**

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="reconciliation-heading"`, `aria-describedby="reconciliation-body"`.
- Focus trap inside the card — tab from `KEEP CLOUD` wraps to `MERGE EVERYTHING`; shift-tab from `MERGE EVERYTHING` wraps to `KEEP CLOUD`.
- Autofocus lands on `MERGE EVERYTHING` (the empathetic default).
- **Colour-independence:** the red hover tint on `KEEP LOCAL`/`KEEP CLOUD` is reinforced by the legal-fine-print body copy below the stack (`"The other two options replace one side entirely and are irreversible."`) — screen reader users hear the warning as body content, not as a colour cue.

**In-progress state (after user clicks an option):**

The clicked button enters a disabled visual state — background stays the same, label swaps to `MERGING…` / `KEEPING LOCAL…` / `KEEPING CLOUD…` (11/mono/700, `text-text-muted`), the other two buttons disable (opacity 0.5, `cursor: not-allowed`). The modal stays mounted until the sync engine confirms the operation started (not finished — a 5000-card merge can take 30+ seconds; we want the user to see the topbar chip flip to `SYNCING…` rather than stare at a frozen modal). Modal unmounts as soon as the sync engine returns control (typically <500ms — enqueuing is fast; the actual flush happens in the background).

**Error path:** If the merge/keep-local/keep-cloud operation fails mid-commit (e.g. Supabase outage), the modal stays mounted, the clicked button resets, and a toast fires: `Reconciliation failed. Check your connection and try again.` (error). User can click again.

### 3. Sync-Errors Modal — `src/components/sync-errors-modal.js` (NEW, D-09)

Vanilla-DOM **dismissible** modal. Mirrors `settings-modal.js` mount pattern — Escape + X + backdrop-click all close. Mounted to `document.body` on chip click when `sync.status === 'error'`.

```
┌─ 100vw × 100vh, rgba(11,12,16,0.85) backdrop, z-60 ──────────────┐
│                                                                    │
│     ┌─ bg-surface, 520px, 1px border-ghost, 32px pad, z-61 ─┐   │
│     │                                                          │   │
│     │  SYNC ERRORS                                   [X]       │   │  ← Syne 20/700 + close icon
│     │  ──────────────────────────────────────────             │   │     1px border-secondary rule
│     │                                                          │   │     (subtle error-context cue)
│     │                                                          │   │
│     │  3 changes failed to sync. Retry or discard each.       │   │  ← 14/400/text-primary body
│     │                                                          │   │
│     │  ┌─ row ────────────────────────────────────────────┐ │   │
│     │  │  decks                           [RETRY]         │ │   │  ← 14/400 table name
│     │  │  12:43:07 · RLS rejected         [DISCARD]       │ │   │  ← 11/mono/400/text-muted
│     │  └────────────────────────────────────────────────────┘ │   │     meta line
│     │                                                          │   │
│     │  ┌─ row ────────────────────────────────────────────┐ │   │
│     │  │  collection                      [RETRY]         │ │   │
│     │  │  12:43:12 · 422 constraint       [DISCARD]       │ │   │
│     │  └────────────────────────────────────────────────────┘ │   │
│     │                                                          │   │
│     │  ┌─ row ────────────────────────────────────────────┐ │   │
│     │  │  deck_cards                      [RETRY]         │ │   │
│     │  │  12:44:01 · Network failure      [DISCARD]       │ │   │
│     │  └────────────────────────────────────────────────────┘ │   │
│     │                                                          │   │
│     │  ┌─────────────────────────────────────────────────┐   │   │
│     │  │               CLOSE                              │   │   │  ← 40px secondary CTA,
│     │  └─────────────────────────────────────────────────┘   │   │     bg-surface-hover
│     │                                                          │   │
│     └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

**Row anatomy:**

Each row is a 2-column flex with `min-height: 56px`, `padding: 16px`, `bg-surface`, and a 1px `border-border-ghost` **bottom** border on all rows except the last (no top border on first, no bottom border on last — matches Phase 8 precon-browser list-row treatment).

- **Left column:** stacks vertically, `gap: 4px`.
  - Row 1: table name in 14/400/text-primary (e.g. `decks`, `collection`, `deck_cards`, `games`, `watchlist`, `profile`). **Lowercased** — matches the Dexie/Postgres table identifiers users will see in docs/error messages.
  - Row 2: meta line in 11/mono/400/text-muted — `{HH:MM:SS} · {error_classification}` — where `error_classification` is a **human-readable short label** mapped from the Supabase error code (not the raw code). Mapping table below.
- **Right column:** `flex-direction: column`, `gap: 8px`, `justify-content: center`.
  - `RETRY` button (32×72, transparent bg, 1px `border-border-ghost`, 11/mono/700, `text-primary` blue; hover: `shadow: 0 0 8px var(--color-glow-blue)` + slight `bg-surface-hover`).
  - `DISCARD` button (32×72, `bg-surface-hover`, 1px `border-border-ghost`, 11/mono/700, `text-text-primary`; hover: text tint flips to `text-secondary` + `shadow: 0 0 8px var(--color-glow-red)`).

**Error classification labels (D-10 mapping — planner-facing contract):**

| Supabase error code | Meta-line label |
|---------------------|-----------------|
| 400 (validation) | `Invalid data` |
| 401 (not authenticated) | `Signed out` |
| 403 (RLS rejection) | `RLS rejected` |
| 409 (conflict) | `Row conflict` |
| 422 (constraint) | `422 constraint` (kept technical — indicates a schema-level mismatch, dev-debuggable) |
| Network/fetch failure | `Network failure` |
| 5xx / timeout | *(these do NOT appear in this modal — transient errors retry silently per D-10; if they end up dead-lettered somehow, label = `Unknown error`)* |

**Row sort order (Claude's discretion — chosen):** **Newest first (descending by `detected_at`).** Rationale: the user's mental model after an error burst is "what just happened?" — most-recent-first answers that question. Matches Phase 6 dashboard notification list ordering.

**Row interactions:**

| Button | Click | Immediate feedback | Success | Failure |
|--------|-------|--------------------|---------|---------|
| `RETRY` | Re-enqueues the row in `sync_queue` with a fresh attempt counter; the flush pipeline picks it up | Button swaps to `RETRYING…` (11/mono/700/text-muted), disables; `DISCARD` also disables for this row only | Row **removes from the list with a 200ms fade-out**; toast `Change retried.` (info); if this was the last row in the list, the modal auto-closes after the toast fires + chip flips back to `SYNCING…` then `SYNCED` | Row stays in place; button resets; toast `Still couldn't sync. Try again later or discard.` (error) |
| `DISCARD` | Hard-deletes the row from `sync_queue`; the pending change is abandoned | Button swaps to `DISCARDING…`, disables; `RETRY` also disables for this row only | Row removes from list with 200ms fade-out; toast `Change discarded.` (info, neutral — no success-green because the user just threw work away); if last row, modal auto-closes + chip transition as above | Row stays; toast `Couldn't discard. Try again.` (error) |

**No per-row confirmation dialog.** The `DISCARD` button itself is the confirmation (the label names the consequence, matches Phase 10 `DISCARD CHANGES` precedent). Dialog-on-dialog is friction, not safety — the user who clicked `DISCARD` on this specific row knows what they want.

**Empty state:** If the user opens the modal and all rows have been retried/discarded in the background (e.g. reconnect while modal was mounting), the row list renders an empty-state block instead:

```
┌─ empty state ─────────────────────────────┐
│                                             │
│               ✓                             │  ← Material Symbols `check_circle`,
│            (48px, text-success)             │     success tint
│                                             │
│           ALL CAUGHT UP                     │  ← Syne 20/700
│                                             │
│     Mila hasn't found any sync errors      │  ← 14/400/text-muted
│     to review.                              │
│                                             │
└───────────────────────────────────────────┘
```

**Close interactions:**

- X icon top-right (identical shape to settings-modal X — 32×32 hit target, 20px `close` glyph, `text-muted` default, `text-secondary` on hover with `glow-red`).
- Escape key.
- Backdrop click.
- `CLOSE` button at the bottom of the modal (always present, 40px `bg-surface-hover`, label `CLOSE`).

**Z-index 60.** Same level as settings-modal — the two are mutually exclusive (user doesn't have sync errors while signed out; user can't open settings-modal with the errors-modal already open — closing one before the other is a natural sequencing).

**Accessibility:**

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="sync-errors-heading"`.
- Row list is a `<ul>` with each row as `<li>`; screen readers announce count on open (`3 changes failed to sync`).
- Focus trap inside the card; autofocus lands on X close (non-consequential — there's no safe "primary action" for this list; the user arrived here to triage).

### 4. Sync-Pull Splash — `src/components/sync-pull-splash.js` (NEW, D-12..D-14)

Full-screen blocking splash. **Reuses Phase 7 `splash-screen.js` visual pattern** — same 100vw × 100vh `bg-background` full-opacity overlay, same centred progress block, same Mila image with pulse animation, same Syne heading + Space Grotesk body + progress-bar + caption layout. Different data source.

Mounts when first-sign-in detects **empty local + populated cloud** (Sharon on a fresh device — D-06). Also mounts when user triggers a manual full-pull via the sync engine's diagnostic path (out of scope for Phase 11 — deferred).

```
┌─ 100vw × 100vh, bg-background (full opacity), z-80 ────────────────┐
│                                                                      │
│                                                                      │
│                        (Mila pulse image)                            │  ← existing Mila image +
│                                                                      │     cf-pulse animation
│                                                                      │
│                                                                      │
│               SYNCING HOUSEHOLD DATA                                 │  ← Syne 20/700/text-primary
│                                                                      │
│          Grabbing your household archive…                            │  ← 14/400/text-primary
│                                                                      │
│                                                                      │
│       ┌────────────────────────────────────────────┐                │  ← 320×8 progress bar
│       │████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░│                │     bg-surface track
│       └────────────────────────────────────────────┘                │     bg-primary fill
│                                                                      │
│                  SYNCED 127 / 845 CARDS                              │  ← 11/mono/400/text-muted
│                                                                      │     caption
│                                                                      │
│                                                                      │
│         Mila's pulling every shelf off the rack.                     │  ← 14/400/text-muted Mila
│                                                                      │     tagline (rotates if pull
│                                                                      │     takes >8s)
└──────────────────────────────────────────────────────────────────────┘
```

**Progress caption:** the `SYNCED {N} / {M} CARDS` format is for the collection table only (the bulk of the data). When pulling other tables, the caption updates per table: `SYNCED {N} / {M} DECKS`, `SYNCED {N} / {M} GAMES`, etc. When all tables complete, caption flashes to `HOUSEHOLD READY` for 200ms before splash fades out.

**Mila taglines (Claude's discretion — chosen to ship, rotate every 8s if the pull is slow):**

1. `Mila's pulling every shelf off the rack.` (opener)
2. `Dusting off your household archive.`
3. `Reuniting cards, decks, and games.`
4. `Mila prefers things in their rightful place.`
5. `Almost there — the last pages are coming in.`

Voice check: arcane (`archive`, `rightful place`), terse (short sentences), slightly mischievous (`pulling every shelf off the rack`). Matches Phase 10 `Mila's recalibrating the sigils.` precedent.

**Error state (D-13):**

If the pull fails mid-stream (network failure, Supabase timeout, RLS hiccup), the splash transitions in-place — progress bar freezes at the current fill, Mila image pauses animation, body content swaps to:

```
┌─ 100vw × 100vh, bg-background ─────────────────────────────────────┐
│                                                                      │
│                          ✕                                          │  ← Material Symbols `error`,
│                   (48px, text-secondary)                             │     red tint, static
│                                                                      │
│                    SYNC FAILED                                       │  ← Syne 20/700/text-secondary
│                                                                      │
│        Couldn't finish syncing your household data.                  │  ← 14/400/text-primary
│        Your local archive has {N} of {M} cards so far.              │
│                                                                      │
│           ┌──────────────────────────────┐                          │
│           │         RETRY SYNC           │                          │  ← 40px primary CTA,
│           └──────────────────────────────┘                          │     bg-primary
│                                                                      │
│        Check your connection and try again.                          │  ← 11/mono/muted helper
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Partial pulls preserved (D-13).** The splash body explicitly communicates what was retrieved (`{N} of {M} cards`) — Dexie keeps those rows; retry resumes from where it failed (the sync engine maintains a cursor per table).

**No `Continue with partial data` escape hatch (planner's discretion — chosen: decline).** D-13 left this open; the decision here is **to NOT offer partial-data-ok escape.** Rationale: a user who signs in wants the full household archive; partial data is a silent data-loss risk ("why don't I see James's deck?"). The retry loop is cheap; the escape hatch creates a confusing "is my sync broken forever?" mental model. Matches D-14's "no skip option" philosophy end-to-end.

**Success state (completion):** progress bar hits 100%, caption flashes `HOUSEHOLD READY` in `text-success`, splash holds for 200ms (confirmation flash matching Phase 10 auth-callback success pattern), then fades out over 300ms (`opacity 1 → 0`). The underlying app is revealed with data populated; chip is already `SYNCED`.

**Z-index 80** — sits above everything except the reconciliation modal (z-70 modal unmounts before splash mounts; splash unmounts before user can trigger reconciliation; state-machine guarantees no overlap).

**Close interactions:** none during pull. The splash is a lockdown surface (matches D-14). During error state, the only dismissal path is `RETRY SYNC` → success → splash fades.

**Accessibility:**

- `role="status"` + `aria-live="polite"` on the progress caption so screen readers announce `SYNCED 127 / 845 CARDS` updates at a measured cadence (throttled — the hook emits updates at 10% intervals, matching Phase 7 migration splash pattern `$store.bulkdata.migrationProgress`).
- Error state swaps to `role="alertdialog"` + `aria-labelledby="sync-fail-heading"` + autofocuses `RETRY SYNC`.
- Reduced motion: Mila image pulse stops; progress bar fill updates via `transition: width 0.3s ease-out` → `0ms` — width changes are instant increments, no smooth animation.

---

## Interaction & Motion

| Surface | Transition | Duration | Easing |
|---------|------------|----------|--------|
| Reconciliation modal open | `opacity 0 → 1` backdrop + `scale 0.96 → 1` card (heavier than dismissible modal — consequential decision deserves presence, matches Phase 10 first-sign-in prompt) | 240ms | ease-out |
| Reconciliation modal close (after user picks) | `opacity 1 → 0` | 180ms | ease-in |
| Reconciliation button hover (`MERGE EVERYTHING`) | `box-shadow: 0 0 12px var(--color-glow-blue)` fade-in | 150ms | ease-out |
| Reconciliation button hover (`KEEP LOCAL`, `KEEP CLOUD`) | `color: text-text-primary → text-secondary` (text tint only, no bg change) | 120ms | ease-out |
| Sync-errors modal open | `opacity 0 → 1` backdrop + `scale 0.98 → 1` card (matches settings-modal motion) | 200ms | ease-out |
| Sync-errors modal close | `opacity 1 → 0` | 150ms | ease-in |
| Sync-errors row fade-out (after successful retry/discard) | `opacity 1 → 0` + `height: auto → 0` | 200ms | ease-out |
| Sync-errors `RETRY` hover | `box-shadow: 0 0 8px var(--color-glow-blue)` + `bg: transparent → bg-surface-hover` | 120ms | ease-out |
| Sync-errors `DISCARD` hover | `color: text-text-primary → text-secondary` + `box-shadow: 0 0 8px var(--color-glow-red)` | 120ms | ease-out |
| Sync-pull splash open | Instant (full-screen blocker — no fade-in; matches Phase 7 bulk-data splash) | 0ms | n/a |
| Sync-pull splash close (success) | `opacity 1 → 0` fade-out | 300ms | ease-out |
| Sync-pull splash error swap (in-splash body content change) | `opacity` cross-fade of body content (Mila image + progress bar → error icon + RETRY block) | 180ms | ease-out |
| Sync-pull splash progress bar fill | `width: {prev}% → {next}%` | 300ms | ease-out |
| Chip state transition (any → any) | Instant swap (icon + label + tint change simultaneously) | 0ms | n/a |
| Chip `SYNCING…` spinner rotation | CSS `@keyframes cf-spin` rotation (existing pattern, reused from Phase 10 auth-callback spinner) | 1000ms infinite | linear |
| Chip `SYNCED` pulse-dot | existing `cf-live-dot` class animation (POLISH-08 precedent) | existing | existing |
| Chip `SYNC ERROR` glow halo | Always-on at 0.15 alpha — **not** a hover-only effect | n/a (static) | n/a |

**Reduced motion:** extend the existing `@media (prefers-reduced-motion: reduce)` block in `main.css` (already covers `cf-pulse`, Phase 8 panel, Phase 9 Vandalblast surfaces, Phase 10 auth-modal + first-sign-in prompt + auth-callback spinner) to add reconciliation-modal, sync-errors-modal, sync-pull-splash, and chip spinner (`progress_activity` rotation). All durations collapse to 0.01ms. The chip spinner swaps to a static `sync` glyph (no rotation) — the label text `SYNCING…` still communicates the state.

**Keyboard shortcuts:** None added in Phase 11. Chip click + modal entry is the single documented path. A keyboard shortcut for "open sync errors modal" was considered but declined — error state is rare and the chip is always visible/clickable in that state.

---

## Copywriting Contract

All terminal chrome + CTAs use JetBrains Mono 11/700 uppercase. Body copy uses Space Grotesk sentence-case. Voice = Mila arcane-terse, established in Phase 10.

### Topbar sync-status chip

| State | Visible label | Tooltip body |
|-------|---------------|--------------|
| `synced` | `SYNCED` | `Last synced {HH:MM:SS}.` |
| `syncing` | `SYNCING…` | `{N} pending changes.` (interpolated from `sync.pending_count`; `0 pending changes.` is acceptable on first flush) |
| `offline` | `OFFLINE` | `No connection. Changes saved locally; will sync when you're back online.` |
| `error` | `SYNC ERROR` | `Sync failed. Click to review.` |

### Reconciliation modal

| Element | Copy |
|---------|------|
| Modal heading | `DATA ON BOTH SIDES` |
| Modal body | `Mila found data on both sides. Which should she keep?` |
| Local column overline | `LOCAL` |
| Cloud column overline | `HOUSEHOLD (CLOUD)` |
| Count row format | `{N} cards` / `{N} decks` / `{N} games` / `{N} watchlist` — lowercased tables, cardinal numbers. Zero-counts rendered explicitly (`0 decks`, not `—`). |
| Primary CTA | `MERGE EVERYTHING` |
| Secondary CTA | `KEEP LOCAL` |
| Tertiary CTA | `KEEP CLOUD` |
| In-progress label (merge) | `MERGING…` |
| In-progress label (keep-local) | `KEEPING LOCAL…` |
| In-progress label (keep-cloud) | `KEEPING CLOUD…` |
| Legal-fine-print line | `Merge uses last-write-wins by updated_at. The other two options replace one side entirely and are irreversible.` |
| Post-merge success toast | `Archive merged.` (success) |
| Post-keep-local success toast | `Local archive kept. Cloud overwritten.` (success) |
| Post-keep-cloud success toast | `Cloud archive kept. Local replaced.` (success) |
| Post-commit failure toast | `Reconciliation failed. Check your connection and try again.` (error) |

**Voice anchor:** `Mila found data on both sides. Which should she keep?` — arcane attribution (Mila is the familiar doing the finding), terse imperative question, no apology. Matches Phase 10 `Mila will keep your local profile either way — you can still sign out and revert.` pattern (Mila as subject, explicit action).

### Sync-errors modal

| Element | Copy |
|---------|------|
| Modal heading | `SYNC ERRORS` |
| X close tooltip | `Close sync errors` |
| Body summary line | `{N} changes failed to sync. Retry or discard each.` (interpolated count; singular form `1 change failed to sync. Retry or discard it.`) |
| Row table name | `{table_name}` lowercased (`collection`, `decks`, `deck_cards`, `games`, `watchlist`, `profile`) |
| Row meta line | `{HH:MM:SS} · {error_classification}` — classification labels per mapping table above |
| Row `RETRY` button | `RETRY` |
| Row `DISCARD` button | `DISCARD` |
| Row `RETRY` in-progress label | `RETRYING…` |
| Row `DISCARD` in-progress label | `DISCARDING…` |
| Bottom CLOSE button | `CLOSE` |
| Empty-state heading | `ALL CAUGHT UP` |
| Empty-state body | `Mila hasn't found any sync errors to review.` |
| Per-row retry success toast | `Change retried.` (info) |
| Per-row retry failure toast | `Still couldn't sync. Try again later or discard.` (error) |
| Per-row discard success toast | `Change discarded.` (info — neutral, not success-tinted; user just threw work away) |
| Per-row discard failure toast | `Couldn't discard. Try again.` (error) |

### Sync-pull splash

| Element | Copy |
|---------|------|
| Splash heading | `SYNCING HOUSEHOLD DATA` |
| Splash body | `Grabbing your household archive…` |
| Progress caption (per-table) | `SYNCED {N} / {M} CARDS` / `SYNCED {N} / {M} DECKS` / `SYNCED {N} / {M} GAMES` / `SYNCED {N} / {M} WATCHLIST ITEMS` / `SYNCED {N} / {M} PROFILE ROWS` |
| Progress caption (completion flash) | `HOUSEHOLD READY` |
| Mila tagline 1 | `Mila's pulling every shelf off the rack.` |
| Mila tagline 2 | `Dusting off your household archive.` |
| Mila tagline 3 | `Reuniting cards, decks, and games.` |
| Mila tagline 4 | `Mila prefers things in their rightful place.` |
| Mila tagline 5 | `Almost there — the last pages are coming in.` |
| Error heading | `SYNC FAILED` |
| Error body | `Couldn't finish syncing your household data. Your local archive has {N} of {M} cards so far.` |
| Error CTA | `RETRY SYNC` |
| Error helper | `Check your connection and try again.` |
| Success completion toast | *(none — the splash fade-out itself is the confirmation; the topbar chip immediately shows `SYNCED`)* |

### Voice rules

- UPPERCASE + JetBrains Mono for all terminal CTAs, field labels, section overlines, chip labels, progress captions. No exceptions.
- Sentence-case for body copy and toast bodies. Conversational confirmation, not shouted.
- Mila's voice surfaces in: reconciliation modal body (`Mila found data on both sides…`), sync-pull splash taglines (5 variants), sync-errors empty state body (`Mila hasn't found any sync errors to review.`). Arcane + terse + never apologetic.
- Numbers as digits (`127 / 845`, `12:43:07`), never spelled out.
- Table names rendered lowercased and unchanged from their schema identifiers (`collection`, `decks`, `deck_cards`, `games`, `watchlist`, `profile`). Don't humanize to `Collection` or `Deck Cards` — the monospace row layout benefits from the technical clarity, and developer-fluent users recognize the schema names from the preflight/runbook docs.
- Error copy always pairs a problem statement with a next action (`Check your connection and try again`, `Retry or discard each`, `Try again later or discard`). No dead-ends.
- The word "conflict" appears exactly once in user copy — inside the error-classification meta line (`Row conflict`). Everything else uses "sync" / "reconciliation" / "merge" — "conflict" is developer vocabulary that risks sounding ominous.
- **CTAs are noun-anchored where disambiguation matters.** `MERGE EVERYTHING` (not bare `MERGE` — names the scope); `RETRY SYNC` (not bare `RETRY` — distinguishes from the per-row action); `SIGN IN TO SYNC` (Phase 10 precedent). `RETRY` / `DISCARD` / `CLOSE` are bare verbs — their surrounding per-row context is enough.

### Destructive actions in Phase 11

| Action | Confirmation approach |
|--------|----------------------|
| `KEEP LOCAL` (reconciliation) | **The modal itself is the confirmation.** Three explicit buttons, impossible to dismiss by accident (Escape + backdrop + no-X lockdown). Hover red tint + legal-fine-print line reinforce the irreversibility. No `window.confirm`. |
| `KEEP CLOUD` (reconciliation) | Same as above. |
| `DISCARD` (sync-errors row) | **No `window.confirm` dialog.** The label names the consequence (`DISCARD` not `CANCEL`), the hover tint flips red, and the action is per-row (damage ceiling is one pending change, not the full archive). Reversible by not sync'ing again — the row remains in the queue until the user explicitly discards. No dialog-on-dialog. |
| Reconciliation mid-commit cancel | **Not supported.** Once the user clicks `MERGE EVERYTHING` / `KEEP LOCAL` / `KEEP CLOUD`, the operation cannot be cancelled — the modal's in-progress state disables the other two buttons; the commit proceeds. Rationale: partial-commit rollback is a CRDT-class problem (deferred; v1.1 uses LWW), and the user's choice is already explicit via the three-way lockdown. |

---

## Accessibility

| Dimension | Contract |
|-----------|----------|
| Colour contrast | All chip state tints validated against topbar `bg-surface #14161C`: `SYNCED` text-primary on surface = 15.7:1 (AAA); `SYNCING…` text-muted `#7A8498` on surface = 4.6:1 (AA body); `OFFLINE` text-warning `#F39C12` on surface = 8.1:1 (AAA); `SYNC ERROR` text-secondary `#E23838` on surface = 5.2:1 (AA body). Reconciliation modal body on `bg-surface` = 15.7:1. `MERGE EVERYTHING` white on `#0D52BD` = 7.0:1 (AAA). `KEEP LOCAL`/`KEEP CLOUD` resting (text-primary on surface-hover) = 14.1:1 (AAA). Sync-errors row meta (text-muted on surface) = 4.6:1 (AA body). |
| Keyboard navigation | **Chip:** focusable only in `error` state (renders as `<button>`); in other states it's a `<div role="status">`. **Reconciliation modal:** tab order = `MERGE EVERYTHING` → `KEEP LOCAL` → `KEEP CLOUD` → wrap. No escape exit. Focus trap. Autofocus `MERGE EVERYTHING`. **Sync-errors modal:** tab order = X close → first row RETRY → first row DISCARD → second row RETRY → second row DISCARD → … → last row DISCARD → CLOSE → wrap to X. Focus trap. Autofocus X close (non-consequential landing). **Splash:** no focusable elements in pull state (blocking display only); error state autofocuses `RETRY SYNC`. |
| Focus ring | `2px solid var(--color-primary)` with `outline-offset: 2px` on every focusable surface. Matches Phase 10 contract. Never suppress. |
| Screen reader labels | **Chip (any state):** `role="status"` (or `role="button"` in error state) + `aria-live="polite"` + `aria-label="Sync status: {state}. {tooltip_body}"` — screen readers announce the full state + context on each change. **Reconciliation modal:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="reconciliation-heading"`, `aria-describedby="reconciliation-body"`. Count-comparison grid: wrap each column in `<section aria-labelledby="local-heading">` / `<section aria-labelledby="cloud-heading">` so screen readers announce the section context for each count. Buttons inherit visible text (`MERGE EVERYTHING`, `KEEP LOCAL`, `KEEP CLOUD`) — no overrides needed. **Sync-errors modal:** `role="dialog"` + `aria-modal="true"` + `aria-labelledby="sync-errors-heading"`. Row list wrapped in `<ul role="list">`; each row is `<li>` with `aria-label="{table_name} {op}, failed {timestamp}, {error_classification}"` on the `<li>` so screen readers get the full row context without needing to tab through the buttons to discover it. **Splash:** `role="status"` + `aria-live="polite"` on caption element. Error state: `role="alertdialog"` + autofocus on `RETRY SYNC`. |
| ARIA live regions | Chip: `aria-live="polite"` — announces state changes without being abrasive. Splash progress caption: `aria-live="polite"` — announces at 10% intervals (throttled by the progress hook, matching Phase 7 bulk-data splash). Sync-errors modal body summary (`{N} changes failed to sync`): `aria-live="polite"` — re-announces when rows are retried/discarded and the count decreases. |
| Focus trap | Reconciliation modal, sync-errors modal, and splash error state all trap focus inside the card. Pattern matches Phase 10 `auth-modal.js` focus-trap utility. |
| Focus restoration | Reconciliation modal unmounts → focus lands on the topbar chip (which is now `SYNCING…`). Sync-errors modal close → focus returns to the topbar chip (still in error state until retry succeeds). Splash unmount → focus lands on the first element of the destination screen (same as any route change — no special handling). |
| Reduced motion | All Phase 11 transitions honour `prefers-reduced-motion: reduce` per the `main.css` block extension. Chip spinner stops rotating (swaps to static `sync` glyph). Progress bar fill becomes instant. Modal enter/exit durations collapse to 0.01ms. |
| Colour-independence | Chip states never rely on colour alone — the icon shape (`check` / `progress_activity` / `cloud_off` / `error`) and the label text (`SYNCED` / `SYNCING…` / `OFFLINE` / `SYNC ERROR`) both carry the state. Reconciliation `KEEP LOCAL`/`KEEP CLOUD` hover-red is reinforced by the legal-fine-print body line. Sync-errors `DISCARD` hover-red is reinforced by the button label itself naming the consequence. |

---

## Empty States

| Surface | State | Heading | Body | CTA |
|---------|-------|---------|------|-----|
| Chip | Never empty — always renders one of the four states; the *pre-auth* state falls under Phase 10 auth-wall (chip doesn't exist pre-auth because the topbar doesn't render pre-auth-wall) | n/a | n/a | n/a |
| Reconciliation modal | Never empty — the modal only mounts when populated/populated is detected. Empty-local or empty-cloud cases skip this modal entirely (empty-local → sync-pull splash; empty-cloud → silent push) | n/a | n/a | n/a |
| Sync-errors modal | All errors cleared in background while modal was opening (race condition) | `ALL CAUGHT UP` | `Mila hasn't found any sync errors to review.` | `CLOSE` (bottom button only; no retry-all cue because there's nothing to retry) |
| Sync-pull splash | User on fresh device, cloud also empty (impossible pre-condition — falls back to silent init; splash never renders) | n/a | n/a | n/a |

---

## Error States

| Surface | Trigger | Heading | Body | CTA |
|---------|---------|---------|------|-----|
| Chip | Permanent sync error (4xx/5xx after retry budget exhausted; RLS rejection; 422 constraint) | *(chip tints red, label swaps to `SYNC ERROR`)* | Tooltip: `Sync failed. Click to review.` | Click opens sync-errors modal |
| Chip | Offline (transient) | *(chip tints warning, label swaps to `OFFLINE`)* | Tooltip: `No connection. Changes saved locally; will sync when you're back online.` | *(none — chip is informational only per D-11)* |
| Reconciliation modal | User-triggered merge/keep-local/keep-cloud fails mid-commit | *(modal stays mounted; clicked button resets)* | Toast: `Reconciliation failed. Check your connection and try again.` | User can re-click any of the three buttons |
| Sync-errors modal | Row-level retry fails | *(row stays in place, button resets)* | Toast: `Still couldn't sync. Try again later or discard.` | Row `RETRY`/`DISCARD` still actionable |
| Sync-errors modal | Row-level discard fails | *(row stays in place, button resets)* | Toast: `Couldn't discard. Try again.` | Row `DISCARD` still actionable |
| Sync-pull splash | Mid-pull failure (network, Supabase timeout, RLS hiccup) | `SYNC FAILED` | `Couldn't finish syncing your household data. Your local archive has {N} of {M} cards so far.` | `RETRY SYNC` (primary CTA); partial pull preserved in Dexie |

**Design principle:** Every error pairs a human-readable problem statement with a concrete next action. Raw Supabase error codes never reach the user; the sync-errors modal's meta-line classification labels are the closest technical vocabulary surfaces (`RLS rejected`, `422 constraint`) — tolerable because the sync-errors modal is a triage surface for a developer-fluent audience (personal app, known household). No generic "Something went wrong" anywhere.

---

## Toasts (wired through existing `toast.js` store)

| Scenario | Type | Copy |
|----------|------|------|
| Reconciliation: merge commit started | success | `Archive merged.` |
| Reconciliation: keep-local commit started | success | `Local archive kept. Cloud overwritten.` |
| Reconciliation: keep-cloud commit started | success | `Cloud archive kept. Local replaced.` |
| Reconciliation: any commit fails | error | `Reconciliation failed. Check your connection and try again.` |
| Sync-errors row retry success | info | `Change retried.` |
| Sync-errors row retry failure | error | `Still couldn't sync. Try again later or discard.` |
| Sync-errors row discard success | info | `Change discarded.` |
| Sync-errors row discard failure | error | `Couldn't discard. Try again.` |
| Sync-pull splash completion | *(none)* | *(splash fade-out + chip `SYNCED` is confirmation)* |
| Sync-pull splash retry success (after error) | *(none — handled inline in splash)* | n/a |

**No offline toast.** D-11 is explicit: the chip is the sole offline indicator. No banner, no toast, no modal. A user who drops offline sees the chip flip to `OFFLINE` and keeps working; local writes continue via Dexie.

**No sync-status transition toasts.** The chip is authoritative — transient transitions (`SYNCING…` → `SYNCED`) happen every 500ms during heavy flush activity and would be toast spam.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — project uses Alpine.js, not React |
| Third-party UI registry | none | not applicable |
| NPM (sync-adjacent) | `@supabase/supabase-js@2.103.x` (already installed in Phase 10, AUTH-01) — Phase 11 uses its Realtime subscription API + `.schema('counterflux').from()` query builder for push/pull; no new package dependency | Gate not required — package pre-vetted in Phase 10 RESEARCH.md §Stack; lazy-loaded per AUTH-01 |

Phase 11 ships zero third-party UI registry imports. Every new component (`reconciliation-modal.js`, `sync-errors-modal.js`, `sync-pull-splash.js`) is authored in `src/components/*.js` as vanilla-DOM modules matching the v1.0 + Phase 7/8/9/10 codebase pattern.

---

## Component Inventory (files touched)

| File | Disposition | Reason |
|------|-------------|--------|
| `src/components/reconciliation-modal.js` | **New** — vanilla-DOM blocking modal mirroring `first-sign-in-prompt.js` lockdown pattern (Escape-blocker in capture phase, backdrop `preventDefault`, no X close); 3-button forced-choice stack; count-comparison grid | SYNC-04, D-01..D-04 |
| `src/components/sync-errors-modal.js` | **New** — vanilla-DOM dismissible modal mirroring `settings-modal.js` mount pattern (Escape + X + backdrop close); row list with per-row RETRY/DISCARD actions; empty state | D-09 |
| `src/components/sync-pull-splash.js` | **New** — full-screen splash mirroring Phase 7 `splash-screen.js` visual pattern (Alpine data component); progress bar + per-table caption + rotating Mila taglines; error state with RETRY SYNC | D-12..D-14 |
| `index.html` | **Edit** — topbar connectivity-chip Alpine template (lines 288-327) replaced with sync-status chip bound to `Alpine.store('sync').status`; chip renders as `<button>` in error state (click opens sync-errors modal). Add `<div id="cf-reconciliation-root">` + `<div id="cf-sync-errors-root">` + `<div id="cf-sync-pull-splash-root">` near `<body>` bottom if modals need named mount roots (or mount to `body` directly — planner's discretion). | SYNC-07, D-08, D-09 |
| `src/utils/connectivity.js` | **Deprecate / replace** — the `getConnectivityStatus(isOnline, bulkDataUpdatedAt)` helper's return shape becomes irrelevant when the chip's data source is `sync.status` instead of `(isOnline, bulkDataUpdatedAt)`. Options for planner: (a) delete the file entirely and update any imports to consume `sync.status` directly; (b) repurpose as `getSyncStatus(sync)` wrapper. **Recommendation: delete** — the store is the single source of truth, a wrapper is dead weight. | SYNC-07 |
| `src/stores/sync.js` | **New** — Alpine store with shape `{ status, pending_count, last_error, last_synced_at, init(), flush(), retry(id), discard(id) }`; subscribes to sync-engine internal state | CONTEXT.md code_context "Alpine store" requirement |
| `src/services/sync-engine.js` | **New** — push/pull/flush core logic; module-scoped `_suppressHooks` flag; debounced flush scheduler; exponential backoff (2s/4s/8s per D-10) | SYNC-02, SYNC-03, SYNC-05, D-10 |
| `src/services/sync-reconciliation.js` | **New** — 4-state detection logic + modal orchestration on first authed sign-in; composes with `reconciliation-modal.js` | SYNC-04, D-01..D-06 |
| `src/services/sync-pull.js` | **New** — bulk pull with progress events for the splash; per-table chunked pulls (500 rows per request — tunable); error classification + partial-pull preservation | D-12..D-14 |
| `src/db/schema.js` | **Edit** — Dexie v9 additive bump: `deleted_at timestamptz NULL` column on 5 synced tables (collection, decks, deck_cards, games, watchlist); add `creating`/`updating`/`deleting` hooks that enqueue into `sync_queue`. Profile table is excluded from soft-delete (per D-15). | D-15, SYNC-02 |
| `src/main.js` | **Edit** — `Alpine.effect` that initializes sync engine on first `auth.status === 'authed'` transition (after bulk-data download, after profile hydrate); wires reconciliation check and sync-pull splash orchestration | CONTEXT.md code_context "Alpine.effect" requirement |
| `src/styles/main.css` | **Extend** — add Phase 11 surfaces to the existing `@media (prefers-reduced-motion: reduce)` block (reconciliation modal, sync-errors modal, sync-pull splash, chip spinner). Add `cf-chip-error-halo` utility class if the `0 0 8px var(--color-glow-red)` always-on shadow feels verbose in the template. No new colour tokens. No new spacing tokens. | Reduced motion contract, chip error halo |

**Do NOT touch in this phase:**

- `src/components/toast.js` (existing store handles all Phase 11 toasts; info/success/warning/error cover every Phase 11 surface).
- `src/components/migration-blocked-modal.js` (reused as a pattern reference only — no edits).
- `src/components/first-sign-in-prompt.js` (Phase 10 artifact, reused as a lockdown pattern reference only — no edits).
- `src/components/settings-modal.js` (Phase 10 artifact, reused as a dismissible modal pattern reference only — no edits in Phase 11).
- `src/components/splash-screen.js` (Phase 7 artifact, reused as a splash pattern reference only — no edits in Phase 11).
- `src/components/auth-modal.js` / `src/components/auth-callback-overlay.js` / `src/components/auth-wall.js` (all Phase 10 artifacts, no Phase 11 changes).
- `src/stores/auth.js` / `src/stores/profile.js` (Phase 10 contracts are stable — Phase 11 consumes them, doesn't edit them).
- Notification bell (`topbar.js` bell region) — SYNC-08 is explicitly Phase 12.

---

## Visual Regression Anchors

For the executor + auditor: these are the eight QA anchors the finished Phase 11 must visibly demonstrate.

1. **Chip replaces, doesn't duplicate** — Open Counterflux post-auth. The topbar right section shows exactly ONE chip where the v1.0 `LIVE`/`OFFLINE`/`STALE` chip used to live. No parallel chips. Chip state matches `Alpine.store('sync').status`.
2. **Chip four-state fidelity** — Manually induce each state: (a) network connected + no pending changes → `SYNCED` with check glyph + success pulse-dot; (b) typing into a deck → brief `SYNCING…` with rotating spinner + blue halo; (c) disable network in DevTools → `OFFLINE` with cloud-off glyph + warning-amber tint; (d) simulate a 422 response → `SYNC ERROR` with error glyph + red tint + always-on red halo + cursor: pointer on hover.
3. **Reconciliation modal lockdown** — Sign in on a device with populated local AND populated cloud. Modal mounts. Press Escape → nothing. Click backdrop → nothing. Try to close via browser back — modal re-mounts on next page load (state is idempotent). Only way out is to click one of the three buttons.
4. **Reconciliation count fidelity** — Modal renders actual counts from local Dexie + cloud Supabase. A user with `45 cards, 3 decks, 10 games, 8 watchlist` locally sees exactly those numbers in the `LOCAL` column. Profile is NOT counted in either column. Zero-counts render explicitly (`0 watchlist`), not as em-dashes.
5. **Reconciliation hover-red reveal** — Hover `KEEP LOCAL`. Label text flips from `text-primary` to `text-secondary` (red). Resting state is neutral. Same for `KEEP CLOUD`. `MERGE EVERYTHING` shows blue glow on hover, not red.
6. **Sync-errors modal row list** — Chip in error state. Click chip → sync-errors modal opens. Row list renders with 4+ failed entries sorted newest-first. Each row shows table name + meta line + RETRY + DISCARD. Click RETRY on one row → button swaps to `RETRYING…`; on success the row fades out over 200ms; if this was the last row, modal auto-closes + chip transitions error → syncing → synced. Toast `Change retried.` fires on success.
7. **Sync-pull splash on fresh device** — Sign in on a fresh browser (empty local Dexie) with a populated household cloud. Full-screen splash mounts with Mila image, `SYNCING HOUSEHOLD DATA` heading, progress bar, `SYNCED 127 / 845 CARDS` caption ticking forward. Caption switches to `SYNCED 2 / 8 DECKS` when the pipeline advances to the decks table. On completion, caption flashes `HOUSEHOLD READY` in success-green, splash fades over 300ms, app is revealed with data populated.
8. **Sync-pull splash error + retry** — Kill network mid-pull. Splash freezes at current fill, body swaps to error content with `SYNC FAILED` heading + `Your local archive has {N} of {M} cards so far.` body + `RETRY SYNC` button. Restore network, click `RETRY SYNC`. Pull resumes from where it failed (cursor preserved); on completion, splash fades normally.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
