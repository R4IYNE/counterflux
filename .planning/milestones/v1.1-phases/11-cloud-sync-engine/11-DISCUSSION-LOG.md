# Phase 11: Cloud Sync Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 11-cloud-sync-engine
**Areas discussed:** Reconciliation modal UX, Household sync attribution, Sync status UX, Pull strategy, Deletion semantics

---

## Gray Area Selection

User selected all 4 proposed areas + one surfaced during discussion (deletion semantics).

| Area | Label | Selected |
|------|-------|----------|
| Reconciliation modal UX (populated/populated) | First-sign-in modal design | ✓ |
| Household sync attribution (D-38 interaction) | user_id + Sharon-new-device + handoff | ✓ |
| Sync status UX + errors | Topbar chip + error modal | ✓ |
| Pull strategy on new-device sign-in | Bulk vs lazy hydration | ✓ |
| Deletion semantics (added mid-discussion) | Soft delete vs hard delete | ✓ |

---

## Area 1: Reconciliation modal UX

### Q1.1: Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| One global choice | Single modal, 3 buttons applied to all 5 tables | ✓ |
| Per-table choice | Grid, 5 independent decisions | |
| Diff-review mode | Row-level Keep Local / Keep Cloud / Keep Both | |

**User's choice:** One global choice (Recommended)
**Captured as:** D-01

### Q1.2: Merge semantics

| Option | Description | Selected |
|--------|-------------|----------|
| LWW by updated_at | Higher updated_at wins; cloud ties break cloud-wins | ✓ |
| Cloud always wins | Cloud authoritative on overlap | |
| Local always wins | Local authoritative on overlap | |

**User's choice:** Free-text "bear in mind none of my users have live data in here yet - its all been tests so far - go with what you think makes sense" → Claude picked LWW by updated_at (recommended), aligned with ARCHITECTURE.md Pattern 3.
**Captured as:** D-02

### Q1.3: Pre-commit info shown

| Option | Description | Selected |
|--------|-------------|----------|
| Counts per table | Simple summary grid | ✓ |
| Counts + sample rows | Counts + 3 sample card/deck names per side | |
| Counts + conflict count | Pre-scan overlaps (slower render) | |
| 3 buttons, no counts | Minimal UX | |

**User's choice:** Counts per table (Recommended)
**Captured as:** D-03

### Q1.4: Dismissibility

| Option | Description | Selected |
|--------|-------------|----------|
| Full lockdown | No X, no Escape, no backdrop | ✓ |
| Dismissible with 'Decide later' | 4th button defers decision | |

**User's choice:** Full lockdown (Recommended)
**Captured as:** D-04

---

## Area 2: Household sync attribution

### Q2.1: user_id on update

| Option | Description | Selected |
|--------|-------------|----------|
| Stays with original creator | user_id stable, only updated_at changes | ✓ |
| Swaps to last editor | user_id churns on every edit | |
| Separate updated_by column | Schema change (5 tables) | |

**User's choice:** Stays with original creator (Recommended)
**Captured as:** D-05

### Q2.2: Sharon signs in on new device (empty local + populated cloud)

| Option | Description | Selected |
|--------|-------------|----------|
| Silent pull, no modal | Unambiguous case — pull + splash | ✓ |
| Lightweight confirmation | Single OK button | |
| Same full reconciliation modal | Safe-by-default overkill | |

**User's choice:** Silent pull, no modal (Recommended)
**Captured as:** D-06

### Q2.3: Same-household handoff (James signs out → Sharon signs in on same browser)

| Option | Description | Selected |
|--------|-------------|----------|
| Data stays | Household is shared, no wipe | ✓ |
| Soft-clear + pull fresh | Wipe household tables, pull from cloud | |
| Show reconciliation modal | Treat as populated/populated | |

**User's choice:** Data stays (Recommended — household is shared)
**Captured as:** D-07

---

## Area 3: Sync status UX + error handling

### Q3.1: Chip shows pending count?

| Option | Description | Selected |
|--------|-------------|----------|
| Just icon + label | Minimal chip, tooltip for pending count | ✓ |
| Icon + count when non-zero | 'SYNCING (3)' style | |
| Count shown only in error state | Error-only counter | |

**User's choice:** Just icon + label (Recommended)
**Captured as:** D-08

### Q3.2: Click on ERROR chip

| Option | Description | Selected |
|--------|-------------|----------|
| Sync errors modal | Per-row Retry/Discard | ✓ |
| Toast + View errors link | Link to dedicated page | |
| Expanding chip dropdown | Cramped for >3 errors | |
| Silent retry | No UI, just retry all | |

**User's choice:** Sync errors modal (Recommended)
**Captured as:** D-09

### Q3.3: Error classification

| Option | Description | Selected |
|--------|-------------|----------|
| Transient retry silent, permanent surfaces | 5xx/429/network retry; 4xx/RLS immediate ERROR | ✓ |
| All errors surface immediately | Noisy | |
| Silent until N retries exhausted | Delayed visibility | |

**User's choice:** Transient retries silently; permanent errors immediately surface (Recommended)
**Captured as:** D-10

### Q3.4: Offline visual feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Just the chip | Minimal UI | ✓ |
| Chip + first-offline toast | Once per session reassurance | |
| Chip + persistent banner | Heavy | |

**User's choice:** Just the chip (Recommended)
**Captured as:** D-11

---

## Area 4: Pull strategy on new-device sign-in

### Q4.1: Pull approach

| Option | Description | Selected |
|--------|-------------|----------|
| Bulk pull with progress splash | Blocks app, chunked 500 rows, Phase 7 splash pattern | ✓ |
| Background pull | App usable immediately, screens populate progressively | |
| Lazy pull per screen | Stateful per-table tracking | |

**User's choice:** Bulk pull with progress splash (Recommended)
**Captured as:** D-12

### Q4.2: Mid-pull failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Error splash + RETRY button | Partial rows kept, blocked until retry | ✓ |
| Auto-retry with backoff | Splash frozen at N/M counter | |
| Unblock with ERROR chip | Let user in with partial data | |

**User's choice:** Show error splash + retry button (Recommended)
**Captured as:** D-13

### Q4.3: Skip option?

| Option | Description | Selected |
|--------|-------------|----------|
| No skip — pull is mandatory | Matches D-40 auth-wall philosophy | ✓ |
| Allow skip, empty dashboard | User can trigger pull later | |

**User's choice:** No skip — pull is mandatory (Recommended)
**Captured as:** D-14

---

## Area 5: Deletion semantics

### Q5.1: Delete model

| Option | Description | Selected |
|--------|-------------|----------|
| Soft delete with deleted_at column | Tombstones propagate via LWW | ✓ |
| Hard delete + sync_tombstones table | Separate tombstone table | |
| Hard delete + Realtime DELETE events | Breaks if offline during delete | |

**User's choice:** Soft delete with deleted_at column (Recommended)
**Captured as:** D-15

### Q5.2: Cleanup cadence

| Option | Description | Selected |
|--------|-------------|----------|
| 30 days, scheduled Supabase cron | Safe window, nightly cleanup | ✓ |
| Manual cleanup | Never auto-delete | |
| Claude's discretion | Pick standard pattern | |

**User's choice:** 30 days, scheduled Supabase function (Recommended)
**Captured as:** D-16

---

## Claude's Discretion

Items where the user delegated the decision or left as planner's call:

- Exact visual design of the 4-state sync chip (icons, colors, hover tooltip) — goes to UI-SPEC
- Reconciliation modal button copy + Mila tagline — follow Phase 10 D-16 brand voice
- Bulk-pull chunk size (500 suggested, tunable)
- sync_queue retention policy after successful flush
- sync-errors-modal layout specifics
- Whether bulk-pull failure offers a "Continue with partial data" escape
- Realtime subscription topology (6 per-table channels vs 1 schema-wide)
- `_suppressHooks` flag implementation (module boolean vs AsyncLocalStorage)
- Exponential backoff specifics (2s/4s/8s suggested)

The user provided free-text input in Q1.2 ("bear in mind none of my users have live data in here yet - its all been tests so far - go with what you think makes sense"), granting Claude full discretion on the merge-semantics decision. Recorded LWW by updated_at (the recommended option, aligned with ARCHITECTURE.md Pattern 3).

---

## Deferred Ideas

- Notification bell integration for sync errors (SYNC-08, Phase 12)
- Realtime presence ("Sharon is editing this deck")
- Per-field conflict UI (Phase 11 uses row-level LWW)
- Sync history / undo / time-travel
- Offline-only toggle (currently auto-queue)
- updated_by column for last-editor attribution
- Diff-review reconciliation mode
- Per-table reconciliation granularity
- Partial / lazy pull strategy
- Skip option on bulk-pull splash
- Multi-household support / invite flow (v2.0+)
- Realtime postgres_changes for Phase 12 market data
- Sync analytics / telemetry

No todos surfaced — `todo match-phase 11` returned empty.

---

*End of discussion log.*
