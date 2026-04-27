# Phase 15: Vercel Foundation & Codified Decisions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 15-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 15-vercel-foundation-codified-decisions
**Areas discussed:** Vercel config format, Project linking + auto-deploy, Env var scope, DECIDE-01 reality check

---

## Vercel Config Format

| Option | Description | Selected |
|--------|-------------|----------|
| Keep vercel.json (Recommended) | Extend the existing 16-line vercel.json with build command, output dir, framework hint. No new dependencies, no TypeScript introduction, matches the rest of the codebase's vanilla-JS posture. The platform 'recommendation' for vercel.ts is a nicety, not a requirement — vercel.json is still fully supported. | ✓ |
| Migrate to vercel.ts | Install @vercel/config + create tsconfig.json for the config file. Aligns with current Vercel platform direction. Worth it if you anticipate dynamic config (env-aware rewrites, computed crons) but most of those needs are speculative for v1.2. | |
| Keep vercel.json AND add minimal tsconfig | Hybrid: keep vercel.json simple, but add a tsconfig.json so future TypeScript adoption is one step easier. Probably overkill for this phase. | |

**User's choice:** Keep vercel.json (Recommended)
**Notes:** Codebase is vanilla JS everywhere — no tsconfig.json, no `.ts` files in src/. Adding `@vercel/config` for one config file is friction without value. Locked as D-01.

---

## Project Linking + Auto-deploy

### Q1: Auto-deploy on master push or manual promotion?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual promotion (Recommended) | Vercel dashboard 'Promote to Production' button. Master pushes only build a Preview; you decide when to promote. Matches the milestone's 'one button-press' framing. Safer for first-deploy of a 24K-LOC app with real-user data sync. | ✓ |
| Auto-deploy on master push | Default Vercel behavior. Every commit to master ships to Production immediately. Simplest. Fine if you trust the test suite + LHCi soft-gate to catch regressions. | |
| Auto-deploy with branch protection | Auto-deploy on master, but require PR + green soft-gate before merging to master (no direct pushes). Adds friction in exchange for a safety net. | |

**User's choice:** Manual promotion (Recommended)
**Notes:** Aligns with the milestone goal phrasing ("production promotion is one button-press"). Locked as D-05.

### Q2: Which Vercel account/team owns the project?

| Option | Description | Selected |
|--------|-------------|----------|
| Personal Vercel account | Same place as atlas, marketing-dashboard, mwta, etc. Counterflux lives alongside the rest of the personal portfolio. Hobby tier free. | ✓ |
| New dedicated team | Spin up a 'counterflux' team — separate billing, separate access. Overkill for personal use unless you anticipate adding collaborators. | |

**User's choice:** Personal Vercel account
**Notes:** Hobby tier sufficient for expected EDHREC proxy volume. Locked as D-04.

---

## Env Var Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Same huxley for both (Recommended) | Production + Preview both point at the huxley project. Matches your existing pattern across Atlas/MWTA. Risk of polluting real data from a Preview is real but bounded — you control which PRs get opened. RLS still enforces household isolation; outsiders can't see anything. | ✓ |
| Separate preview Supabase | New Supabase project (counterflux-preview) just for Preview deploys. Clean isolation. Cost: maintaining two projects, two sets of RLS migrations, two precon sync targets. Worth it only if you anticipate destructive testing. | |
| Same huxley but Preview = read-only | Single Supabase, but Preview deploys use a different anon key with read-only RLS policies. Compromise: Previews surface the real data but can't modify it. Adds one new RLS policy; non-trivial migration work. | |

**User's choice:** Same huxley for both (Recommended)
**Notes:** Risk acknowledged in D-10 — PR Preview deploys can write real data. Mitigation procedural (open Previews carefully). Acceptable for personal app with two known users. Locked as D-08, D-09, D-10.

---

## DECIDE-01 Reality Check

| Option | Description | Selected |
|--------|-------------|----------|
| PROJECT.md Key Decision row only (Recommended) | Add ONE Key Decisions row in PROJECT.md: 'Household model permanent (v1.2)' with rationale citing D-38. Reword the ROADMAP.md success criterion to point at PROJECT.md instead of the stale 10-CONTEXT.md:113 reference. Done in 5 minutes. | ✓ |
| Key Decision + new auth-wall copy | Same as above plus update auth-wall messaging to make 'household / no public sign-up' explicit to anyone who lands on the site. Adds a tiny bit of UI work. | |
| Full audit — every doc that mentions deferral | Sweep PROJECT.md, REQUIREMENTS.md, ROADMAP.md, MILESTONES.md, MILESTONE-AUDIT.md for any 'deferred to v1.2' / 'public sign-up' wording and unify to 'permanent decision'. Most thorough. Probably 15–20 minutes of grep + edit. | |

**User's choice:** PROJECT.md Key Decision row only (Recommended)
**Notes:** No auth-wall UI changes. Documentation-only. The deferral comment that DECIDE-01 references in 10-CONTEXT.md no longer exists (replaced by D-38 post-ship). Reword ROADMAP success criterion #4. Locked as D-12, D-13, D-14.

---

## Closing Question

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context (Recommended) | Write 15-CONTEXT.md now with the four locked decisions plus the reality-check notes. | ✓ |
| One more question | I have one more thing to clarify. | |

**User's choice:** Ready for context

---

## Claude's Discretion

- Wording of the new PROJECT.md Key Decisions row.
- Wording of `SEED-002-nyquist-revisit.md` (follows SEED-001 frontmatter shape).
- Final exact `buildCommand` / `outputDirectory` / `framework` strings in `vercel.json`.
- Order of operations during execution.

## Deferred Ideas

- **Spellbook proxy** — Phase 16 concern. `src/services/spellbook.js:8` carries the same "wire to serverless proxy" comment as EDHREC. Should be raised during Phase 16 discuss-phase.
- **perf-soft-gate.yml target swap** — Phase 17 territory (currently uses `http-server dist` locally; UAT-01 wants Vercel Preview URL).
- **Workflow Node 20 → 24 bump** — Phase 17 nicety.
- **Edge runtime exploration / migrate vercel.json → vercel.ts / Vercel Analytics / Custom domain / Separate Supabase preview** — all v1.3+.
- **Re-enable Nyquist gate + backfill phases 7–14** — SEED-002 trigger, v1.3 decision.
