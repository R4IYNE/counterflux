---
id: SEED-002
status: dormant
planted: 2026-04-28
planted_during: v1.2 Deploy the Gatewatch (milestone scoping reset)
trigger_when: At v1.3 milestone scoping, OR when a phase ships with a coverage gap that VALIDATION.md would have caught
scope: Small-Medium
---

# SEED-002: Revisit Nyquist VALIDATION.md gate — re-enable for v1.3 or accept permanent disable

## Why This Matters

The Nyquist validation gate (`workflow.nyquist_validation`) requires every phase to ship a `VALIDATION.md` mapping each requirement to the test file(s) proving it works. It's a defensive paperwork gate — "tests exist AND we wrote down which test proves which requirement."

v1.1 shipped 8 phases (7–14, 47 plans, 119 test files, ~18K LOC of tests) without producing per-phase VALIDATION.md receipts. The tests are real and verified — the missing artifact is documentation. Backfilling 8 archived phases is process debt that returns no functional value when the underlying coverage already exists.

**v1.2 decision (2026-04-28):** disable the gate via `gsd-tools config-set workflow.nyquist_validation false`. Phases 15–16 (EDHREC proxy + UAT pass) ship without VALIDATION.md.

**The trade-off this seed captures:** Disabling means no formal coverage receipts going forward — relying on test discipline instead. v1.3 needs a deliberate moment to either re-enable the gate (and decide what to do about the 8 archived phases) or accept permanent disable as the project's posture.

## When to Surface

**Trigger:** v1.3 milestone scoping during `/gsd:new-milestone`, OR earlier if any phase ships with a coverage gap that VALIDATION.md would have caught (i.e. a tested-feature-that-broke pattern that the receipt-mapping discipline would have flagged during plan-checking).

This seed should be presented at the requirements-defining step of v1.3 with three options:

1. **Leave disabled permanently** — accept that VALIDATION.md is not part of this project's process. Tests are the receipt. Drop the seed.
2. **Re-enable for v1.3 forward only** — `config-set workflow.nyquist_validation true`. New phases ship VALIDATION.md; archived phases stay paperwork-light. Hybrid posture.
3. **Re-enable + backfill phases 7–14** — most thorough. ~8 retroactive runs of `/gsd:validate-phase` to generate VALIDATION.md for each archived phase. Estimated 1–2 hours per phase = a small dedicated v1.3 phase of its own.

## Scope Estimate

- **Option 1 (leave disabled):** Zero work. Drop the seed.
- **Option 2 (re-enable forward only):** 1 command. Affects future phases only.
- **Option 3 (re-enable + backfill):** Small-Medium. 8 phases × ~1–2h each = a 1-plan phase or weekend's worth of ratification.

## Breadcrumbs

Related code and decisions in the current codebase:

- `.planning/config.json` — `workflow.nyquist_validation: false` was set in v1.2 milestone scoping reset (2026-04-28).
- `.planning/REQUIREMENTS.md` — v1.2 DECIDE-02 captured this decision; absorbed into milestone-level cleanup during scoping reset.
- `.planning/PROJECT.md` Out of Scope section — documents the disable + revisit posture.
- `.planning/milestones/v1.1-MILESTONE-AUDIT.md` — re-verified `passed` 2026-04-26 across all 8 v1.1 phases via alternative coverage analysis (not VALIDATION.md). Demonstrates that paperwork and verification are separable.
- v1.1 phase test counts (per phase SUMMARY.md files in `.planning/milestones/v1.1-phases/`) — strong baseline evidence that coverage exists even without per-phase receipts.

## Notes

- The gate disable is project-local (`.planning/config.json`), not global. Other GSD projects (Atlas, MWTA, etc.) keep their own setting.
- If a v1.3 phase ships with a regression that a coverage receipt would have caught, treat that as the strongest signal to flip the gate back on (option 2 or 3). Don't pre-emptively re-enable on theoretical grounds.
- This is the second seed of the project — first was SEED-001 (catalog/userdata storage split). Pattern: surface long-running architectural / process decisions at milestone boundaries with deliberate trigger conditions.
