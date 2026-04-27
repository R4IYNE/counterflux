# Phase 15: Vercel Foundation & Codified Decisions - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the Vercel project for `R4IYNE/counterflux`, wire env vars for Production + Preview, extend the existing `vercel.json` with build/output/framework declarations, and codify two product decisions that v1.1 left as "deferred":

1. The "household model" auth posture (no public sign-up — existing-account credentials only) becomes a permanent Key Decision in PROJECT.md.
2. The Nyquist `VALIDATION.md` gate is disabled via `gsd-tools config-set workflow.nyquist_validation false`, with a v1.3 revisit seed planted.

**NOT in this phase:**
- The EDHREC CORS proxy itself (Phase 16).
- The `@lhci/cli` soft-gate workflow update to target Vercel Preview URLs (Phase 17).
- A custom domain (`counterflux.app` or similar) — explicit Out of Scope per REQUIREMENTS.md.
- Any auth-wall UI / messaging changes — DECIDE-01 is documentation-only.
- Any Spellbook proxy work — surfaced as a deferred Phase 16 concern (see `<deferred>`).

</domain>

<decisions>
## Implementation Decisions

### Vercel Config Format (DEPLOY-06)
- **D-01:** Keep `vercel.json` (NOT migrate to `vercel.ts`). Reason: codebase is vanilla JS everywhere — no `tsconfig.json`, no TypeScript dependencies, no `.ts` files in `src/`. Adding `@vercel/config` + a tsconfig just for one config file is friction without proportional value. The Vercel platform "recommendation" for `vercel.ts` is a nicety, not a requirement; `vercel.json` is fully supported. If TypeScript ever lands in src/, revisit.
- **D-02:** Extend the existing 16-line `vercel.json` (which already declares `Cache-Control: no-cache` headers on `/` and `/index.html`) with: explicit `buildCommand` (`npm run build`), `outputDirectory` (`dist`), and `framework` hint (`vite`). Optional but recommended: declare `installCommand: npm ci` so the build step matches `perf-soft-gate.yml` (which uses `npm ci`).
- **D-03:** Do NOT introduce redirects or rewrites in `vercel.json` for this phase — the EDHREC proxy in Phase 16 will add `/api/edhrec` routing as a Function (Vercel auto-routes `api/*.js` files), no rewrite needed in config.

### Project Linking + Deploy Strategy (DEPLOY-01, DEPLOY-03)
- **D-04:** Vercel project owned by the user's **personal Vercel account** (Hobby tier, free). Sits alongside Atlas, marketing-dashboard, MWTA, and the rest of the personal portfolio. No new team or billing setup.
- **D-05:** **Manual promotion** for Production. Master pushes build a Preview deploy only — the user clicks "Promote to Production" in the Vercel dashboard when ready. Matches the milestone's "production promotion is one button-press the user can hit when ready" framing. Configured via Vercel project setting "Production Branch" → set to `master`, "Auto Deploy" → off for Production (Preview auto-deploys stay on for PRs).
- **D-06:** PRs auto-build Preview deployments with unique `*.vercel.app` URLs — Vercel default behavior, no config needed beyond connecting the GitHub integration.
- **D-07:** The Vercel CLI is **not currently installed** locally (per session reminder). Installation (`npm i -g vercel`) is a manual user action; the planner should call it out as a one-time bootstrap step but should not assume the CLI exists when designing automation. Project linking (`vercel link`) is an interactive, one-shot user action that doesn't go in a script.

### Environment Variables (DEPLOY-02)
- **D-08:** **Same huxley Supabase project for Production AND Preview.** Both environments use the same `VITE_SUPABASE_URL` (`https://hodnhjipurvjaskcsjvj.supabase.co`) and `VITE_SUPABASE_ANON_KEY`. Matches the existing pattern across Atlas/MWTA/Counterflux personal apps. Household RLS (`shared_users` whitelist) still enforces isolation; outsiders never see anything.
- **D-09:** Two env vars total for v1.2: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Set in Vercel for **both** Production and Preview environments (NOT Development — local `.env.local` already covers dev per Phase 10 D-34). Configured via `vercel env add` CLI or the dashboard.
- **D-10:** **Risk acknowledgement:** PR Preview deploys can write real data to the real huxley Supabase. Mitigation is procedural — open Previews carefully, don't run destructive flows from Previews. Acceptable risk for a personal app with two known users (James + Sharon). If a future milestone needs blast-radius isolation, revisit with a separate `counterflux-preview` Supabase project.
- **D-11:** **Out of scope:** OIDC tokens, Vercel marketplace integrations, environment-specific branching of Supabase URLs. Two flat env vars, two environments, done.

### DECIDE-01 — Household Model Codification
- **D-12:** **Reality check:** the deferral comment that DECIDE-01 says it's removing **doesn't exist anymore**. Phase 10's archived [10-CONTEXT.md](.planning/milestones/v1.1-phases/10-supabase-auth-foundation/10-CONTEXT.md) was updated post-ship with D-38 (2026-04-18) which already documents the household-model decision in detail. The archived file is correct as-is. PROJECT.md "Out of Scope" was already updated in this milestone-scoping session (commit `b851f20`).
- **D-13:** **Scope of DECIDE-01 work:** light. Two artifacts:
  1. Add ONE row to PROJECT.md "Key Decisions" table: "Household model permanent (v1.2 decision)" with rationale citing D-38, the shared huxley project context, and the explicit decision to NOT add public sign-up.
  2. Reword ROADMAP.md Phase 15 success criterion #4 — currently references "10-CONTEXT.md:113 no longer reads as deferred" which is meaningless against the archived file. Replace with: "PROJECT.md Key Decisions table contains a 'Household model permanent (v1.2)' row; PROJECT.md Out of Scope wording matches; no auth-wall UI changes required."
- **D-14:** **No auth-wall UI changes.** DECIDE-01 is documentation-only. Anyone hitting the auth wall sees the same email+password form they see today — the household decision is not user-facing copy.

### DECIDE-02 — Nyquist Gate Disabled
- **D-15:** Run `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow.nyquist_validation false` exactly once during Phase 15 execution. Verify with `config-get`. The change is project-local (`.planning/config.json`).
- **D-16:** **Effect:** Future phases (15, 16, 17, and any v1.3+) skip the Nyquist validation gate during `/gsd:plan-phase` and `/gsd:execute-phase`. Already-shipped v1.1 phases unaffected — they were already verified through other means (119 test files, ~18K LOC, audit re-verified `passed` 2026-04-26).
- **D-17:** Plant `.planning/seeds/SEED-002-nyquist-revisit.md` capturing the trade-off so v1.3 has a deliberate moment to either re-enable the gate (and backfill phases 7–14) or leave it disabled permanently. Trigger language: "When v1.3 milestone scoping begins, OR when a phase ships with a coverage gap that VALIDATION.md would have caught."
- **D-18:** **Out of scope (per REQUIREMENTS.md):** backfilling VALIDATION.md for phases 7–14. Tests exist; the receipt artifact does not. v1.3 decides whether to backfill.

### Cache-Control Reality (DEPLOY-04)
- **D-19:** **Already done.** [vercel.json](vercel.json) already declares `Cache-Control: no-cache` headers on `/` and `/index.html` (committed during Phase 13 Plan 6 setup, even before any Vercel deploy existed). DEPLOY-04's success criterion is now a verification step: after the first Preview deploy, run `curl -sI https://<preview-url>/` and confirm the header in the response. No new config work needed.

### Build Compatibility (DEPLOY-05)
- **D-20:** No build-tool migration. Vercel auto-detects Vite from `package.json` and runs `npm run build` → outputs to `dist/`. The existing `tests/auth-bundle.test.js` and the bundle-budget guard in `scripts/assert-bundle-budget.js` continue to gate regressions in CI (perf-soft-gate.yml workflow).
- **D-21:** **Build matrix:** Vercel runs Node.js 24 LTS by default per platform note. Existing GitHub Actions workflow (`perf-soft-gate.yml`) uses Node 20. They diverge but both work — Vite 8 supports both. Updating the workflow to Node 24 is a Phase 17 nicety, not a Phase 15 requirement.

### Claude's Discretion
- Wording of the new PROJECT.md Key Decisions row (one line, citing D-38 + shared huxley + no-public-sign-up rationale) — Claude composes during execution.
- Wording of `SEED-002-nyquist-revisit.md` (follows existing SEED-001 frontmatter shape, captures the disable-vs-backfill trade-off, includes trigger conditions).
- Final exact `buildCommand` / `outputDirectory` / `framework` strings in `vercel.json` — standard Vite defaults, no controversy.
- Order of operations during execution (vercel link first vs vercel.json edit first vs env var setup first) — planner can sequence.

### Folded Todos
None — `gsd-tools todo match-phase 15` returned zero matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Vercel Platform (session-loaded knowledge)
- `vercel:knowledge-update` skill — overrides outdated LLM knowledge. Key facts for this phase: Fluid Compute is the default runtime (NOT edge), Node.js 24 LTS is the default, `vercel.ts` is recommended (but `vercel.json` is still fully supported), Vercel Postgres / KV are deprecated (irrelevant here — we use Supabase).
- `vercel:vercel-cli` skill — load when designing the Vercel CLI bootstrap (vercel link, vercel env add). Auto-loads on relevant prompts.
- `vercel:env-vars` skill — load when wiring Supabase env vars across Production + Preview.
- `vercel:deployments-cicd` skill — load when configuring the Production-branch + auto-deploy posture.

### Repo State (Phase 15 dependencies — FULL paths)
- `vercel.json` — existing 16-line config with Cache-Control headers. To be extended (D-02), not replaced.
- `package.json` — declares `npm run build` script and `dist/` Vite output directory.
- `vite.config.js` — declares `/api/edhrec` and `/api/spellbook` dev proxies (lines 7-18). Phase 16 / future Spellbook work touches these; Phase 15 does NOT.
- `.github/workflows/perf-soft-gate.yml` — existing LHCi soft-gate workflow targeting `http-server dist` locally. NOT modified by Phase 15 (Phase 17 territory).
- `lighthouserc.cjs` — existing LHCi config; not modified by Phase 15.
- `scripts/assert-bundle-budget.js` — existing bundle-budget guard; not modified by Phase 15.

### Prior Phase Decisions (Phase 10, archived)
- `.planning/milestones/v1.1-phases/10-supabase-auth-foundation/10-CONTEXT.md` D-34 — Pre-flight checklist artifact (`10-AUTH-PREFLIGHT.md`) covers Supabase project setup, Vercel env var configuration, local `.env.local` bootstrap. Phase 15 builds on this — env var keys are already documented there.
- `.planning/milestones/v1.1-phases/10-supabase-auth-foundation/10-CONTEXT.md` D-38 — Household sharing model decision. Phase 15 DECIDE-01 codifies this as a permanent product decision in PROJECT.md (was previously documented in the phase context only).
- `.planning/milestones/v1.1-phases/10-supabase-auth-foundation/10-AUTH-PREFLIGHT.md` — Pre-flight checklist; Phase 15 should reference Section "Vercel env var configuration" verbatim.

### Prior Phase Decisions (Phase 13, archived)
- `.planning/milestones/v1.1-phases/13-performance-optimisation-conditional/13-HUMAN-UAT.md` — the two pending UAT items (Test 1: soft-gate fires on real PR; Test 2: Vercel emits `Cache-Control: no-cache`) are Phase 17 verifications. Phase 15 ensures the underlying infrastructure exists (vercel.json header is already there → Test 2 prereq satisfied; Vercel project linked → Test 1 prereq satisfied).
- `.planning/milestones/v1.1-phases/13-performance-optimisation-conditional/13-CONTEXT.md` D-11 — soft-gate is intentionally `warn`-level only (never blocks merge). Phase 15 must not change this.

### Project / Roadmap (current)
- `.planning/PROJECT.md` — Current Milestone section (v1.2), Active requirements, Out of Scope, Key Decisions table (Phase 15 adds a row).
- `.planning/REQUIREMENTS.md` — DEPLOY-01..06, DECIDE-01..02 (Phase 15's 8 requirements).
- `.planning/ROADMAP.md` — Phase 15 goal, success criteria, dependency notes. Phase 15 reworks success criterion #4 (D-13).

### Existing Codebase Maps
- None at `.planning/codebase/` — no project-wide map document exists. Scout findings are captured inline in `<code_context>` below.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vercel.json` — existing 16-line config. Headers block already declares `Cache-Control: no-cache` on `/` and `/index.html`. Phase 15 extends this file, never replaces it.
- `package.json` scripts — `npm run build`, `npm run preview`, `npm run perf` already wired. Vercel `buildCommand` becomes `npm run build` verbatim; `outputDirectory` is `dist` (Vite default).
- `.github/workflows/perf-soft-gate.yml` — Phase 13's LHCi workflow is fully wired against a watched paths list including `vite.config.js`, `vercel.json`, `index.html`, `lighthouserc.cjs`. **Editing `vercel.json` in Phase 15 will trigger this workflow on the very PR that lands the change** — that's a free smoke test.
- `src/services/edhrec.js` line 4 — comment "In production, wire /api/edhrec to a serverless proxy or edge function." Phase 16 work; Phase 15 leaves this untouched.
- `src/services/spellbook.js` line 8 — same pattern. Phase 16 nominally only covers EDHREC; Spellbook is a flag-for-Phase-16 concern (see `<deferred>`).

### Established Patterns
- **Vanilla JS everywhere** — no TypeScript dependency in package.json. Discourages introducing `vercel.ts` for one config file (D-01).
- **Lazy-loaded heavy services** — Supabase client lazy-loads (Phase 10), Chart.js dynamically imported, mana-font / keyrune / material-symbols split into vendor chunks via Vite manualChunks. Phase 15 doesn't add new code, but planner should respect this principle when sequencing.
- **Bundle-budget gate** — `scripts/assert-bundle-budget.js` runs in `npm run build:check`. Phase 15's vercel.json edits don't affect bundle size; this is mentioned for completeness.
- **Atomic commits via gsd-tools commit** — every prior phase committed each artifact independently. Phase 15 should follow: vercel.json edit → commit → SEED-002 → commit → PROJECT.md Key Decisions → commit → STATE.md → commit. Planner can decide granularity.

### Integration Points
- **Vercel Git integration** — connect `R4IYNE/counterflux` repo via Vercel dashboard during `vercel link`. PR auto-builds + Preview deploys flow from this connection.
- **Vercel env var system** — set via `vercel env add VITE_SUPABASE_URL production preview` and `vercel env add VITE_SUPABASE_ANON_KEY production preview`. Two env vars × two scopes = four set operations. Or use the dashboard.
- **GSD config** — `gsd-tools config-set workflow.nyquist_validation false` writes to `.planning/config.json`. Verify with `config-get`. Atomic, fast, low-risk.
- **No new src/ files in Phase 15.** All work is config + planning artifacts.

</code_context>

<specifics>
## Specific Ideas

- **Manual promotion phrasing:** the milestone goal explicitly says "production promotion is one button-press the user can hit when ready." That phrase originated in this discussion and should reach the planner — Phase 15's success is the user being able to click "Promote to Production" in the dashboard, not Vercel auto-shipping master.
- **Risk acknowledgement on shared Supabase:** D-10 documents that Preview deploys can write real data. Plan should not silently surprise the user post-deploy by suggesting a destructive PR test flow.
- **Vercel CLI install reminder:** the session-start reminder said the CLI is not installed. The planner should include `npm i -g vercel` as an explicit Plan 1 step rather than assuming the CLI is on the PATH.
- **vercel.json watched in CI:** the perf-soft-gate workflow watches `vercel.json` (per its `paths:` list). The PR that lands Phase 15's vercel.json edits will run LHCi automatically — no extra orchestration needed for that smoke test.

</specifics>

<deferred>
## Deferred Ideas

### For Phase 16
- **Spellbook proxy (`/api/spellbook`)** — `src/services/spellbook.js` line 8 has the same "wire to a serverless proxy" comment as EDHREC. Phase 16 is scoped to EDHREC only (PROXY-01..05 wording). Worth flagging during Phase 16 discuss-phase: either include Spellbook in the same proxy work (likely low marginal cost — same pattern, different upstream) or explicitly leave it as a Phase 17/v1.3 concern with a known-broken-in-prod warning.

### For Phase 17
- **perf-soft-gate.yml target swap** — currently uses `npx http-server dist` locally; UAT-01 wants it running against the actual Vercel Preview URL. This requires a workflow rewrite to either fetch the Preview URL from a Vercel webhook / API or use Vercel's lhci-action. NOT Phase 15 work. Captured in ROADMAP Phase 17 success criterion #1.
- **Workflow Node 20 → 24 bump** — perf-soft-gate.yml uses Node 20; Vercel platform default is Node 24 LTS. Diverges but both work. Could update for parity in Phase 17.
- **Production Lighthouse run + PERF-BASELINE.md re-baseline** — UAT-02 territory.

### For v1.3 (post-production-traffic data)
- **Edge runtime exploration** — explicit Out of Scope for v1.2 (REQUIREMENTS.md). Mentioned only because Vercel platform note actively *recommends against* edge runtime now (Fluid Compute is the default). v1.3 should NOT revisit unless a specific Function needs sub-50ms cold-start that Fluid Compute can't deliver.
- **Custom domain (counterflux.app or similar)** — explicit Out of Scope for v1.2. User decision post-deploy.
- **Separate Supabase project for Preview** — D-10 risk. Re-evaluate if Preview-pollution incidents occur.
- **Migrate vercel.json → vercel.ts** — D-01 deferred. Revisit when TypeScript first lands in src/ (likely never for Counterflux, but never say never).
- **Vercel Analytics / Sentry / Logflare** — explicit Out of Scope per REQUIREMENTS.md. Web Vitals already cover core perf telemetry; no observability stack until needed.
- **Re-enable Nyquist gate + backfill phases 7–14** — SEED-002 trigger. v1.3 decision.

### Reviewed Todos (not folded)
None — `gsd-tools todo match-phase 15` returned zero matches; nothing to review.

</deferred>

---

*Phase: 15-vercel-foundation-codified-decisions*
*Context gathered: 2026-04-27*
