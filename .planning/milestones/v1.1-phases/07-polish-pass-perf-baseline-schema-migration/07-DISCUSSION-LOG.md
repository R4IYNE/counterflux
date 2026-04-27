# Phase 7: Polish Pass + Perf Baseline + Schema Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-14
**Mode:** discuss (interactive)

## Gray area selection

**Q: Which HIGH-IMPACT gray areas do you want to discuss?**
- Options: Schema v6 shape & PK / Migration safety net / Perf targets method / Delivery sequencing
- **Selected:** all four

**Q: Which POLISH-level gray areas do you want to discuss?**
- Options: LIVE chip / Sidebar collapse / Red accent strategy / Skip all polish
- **Selected:** LIVE chip, Sidebar collapse, Red accent strategy

## Schema v6 shape & PK

**Q: Primary key strategy for synced tables in v6?**
- Options: Migrate to text UUID now (Rec) / Keep ++id, add remote_id / Composite (user_id + local_id)
- **Selected:** Migrate to text UUID now

**Q: sync_queue / sync_conflicts shape locked now?**
- Options: Full shape now (Rec) / Minimal shape now / Tables only, no shape
- **Selected:** Full shape now

**Q: Backfill for updated_at / synced_at / turn_laps?**
- Options: Sensible defaults (Rec) / Preserve existing timestamps / Null with lazy backfill
- **Selected:** Sensible defaults

**Q: What else folded into v6?**
- Options: profile table / price_history.updated_at / schema_version meta row / Nothing else
- **Selected:** profile table, price_history.updated_at, schema_version meta row

## Migration safety net

**Q: Pre-migration backup scope?**
- Options: All user-generated tables (Rec) / Games + decks only / Everything including caches
- **Selected:** All user-generated tables

**Q: Backup format?**
- Options: localStorage JSON (Rec) / Downloadable file / Both
- **Selected:** localStorage JSON

**Q: onblocked UX?**
- Options: Blocking modal (Rec) / Toast with retry / Auto-refresh
- **Selected:** Blocking modal

**Q: Backup TTL?**
- Options: 7 days (Rec) / 1 boot / Never / 30 days
- **Selected:** 7 days

## Perf targets method

**Q: How to set TTI/LCP targets?**
- Options: Absolute numbers (Rec) / Baseline + budget / Web Vitals Good only
- **Selected:** Absolute numbers

**Q: What does `npm run perf` produce?**
- Options: Single desktop run HTML (Rec) / 3-run median JSON+HTML / Multi-URL cold+warm
- **Selected:** Single desktop run HTML

**Q: CI gate?**
- Options: Dev-only for v1.1 (Rec) / CI warn-only / CI hard fail
- **Selected:** Dev-only for v1.1

**Q: web-vitals dev UX?**
- Options: Console table (Rec) / Console + overlay toggle / Console only raw
- **Selected:** Console table per metric

## Delivery sequencing

**Q: Ship order within Phase 7?**
- Options: Polish → Perf → Schema (Rec) / Schema → Perf → Polish / Schema → Polish → Perf / Schema → Perf → polish parallel
- **Selected:** Polish → Perf → Schema

**Q: Single PR or sub-plans?**
- Options: 3 sub-plans (Rec) / Single bundled PR / Schema alone + rest bundled
- **Selected:** Split into 3 sub-plans

**Q: Baseline timing?**
- Options: Before schema (Rec) / After all Phase 7 / Both before and after
- **Selected:** Before schema — represents v1.0

## POLISH-08 LIVE chip

**Q: What happens to the LIVE chip?**
- Options: Keep with pulsing dot (Rec) / Remove entirely / Icon-only
- **Selected:** Keep with pulsing dot

## POLISH-09 Sidebar collapse

**Q: Collapsed sidebar behaviour?**
- Options: Icon rail 64px (Rec) / Fully hidden with edge handle / Icon rail + keyboard shortcut
- **Selected:** Icon rail 64px

## POLISH-02 Red accent strategy

**Q: Which surfaces absorb red (multi-select)?**
- Options: Card detail hover / Destructive CTAs / RAG red states / Active tab + bell
- **Selected:** all four

## Close-out

**Q: Ready to write CONTEXT.md?**
- Options: Create CONTEXT.md / More questions
- **Selected:** Create CONTEXT.md

---

*Discussion complete. See `07-CONTEXT.md` for the decisions payload consumed by downstream agents.*
