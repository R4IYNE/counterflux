---
phase: 13-performance-optimisation-conditional
type: findings
status: deferred
created: 2026-04-21
---

# Phase 13 — Findings & Deferred Bugs

Discoveries surfaced during Phase 13 execution that are **NOT** caused by
Phase 13 work and are **NOT** in Phase 13 scope. Captured here so they
don't slip through to v1.1 release. Each finding either gets picked up by
Plan 6 audit or a dedicated follow-up bug-fix plan.

---

## Finding 1 — Preordain "Upcoming Releases" shows 33-year-old sets

**Surfaced:** 2026-04-21 during Plan 13-03 Task 5c user smoke-test re-verification.

**Evidence:** User screenshot of Preordain screen at 2026-04-21 showing the
`UPCOMING RELEASES` panel populated with:

| Set | Release date |
| --- | --- |
| Alpha | 05 AUG 1993 |
| Beta | 04 OCT 1993 |
| Unlimited | 01 DEC 1993 |
| Arabian Nights | 17 DEC 1993 |

Today's date is **2026-04-21**. These sets are ~33 years old — they are
obviously not "upcoming". The panel appears to be sorting oldest-to-newest
from the earliest recorded set instead of filtering by `release_date > now()`
and sorting ascending from today.

**Cross-reference — Epic Experiment dashboard works correctly.** The
`renderUpcomingReleases` function at
`src/screens/epic-experiment.js:945-1007` filters sets correctly:

```javascript
const today = new Date().toISOString().slice(0, 10);
const upcoming = sets
  .filter(s => s.released_at > today)
  .sort((a, b) => a.released_at.localeCompare(b.released_at))
  .slice(0, 3);
```

So the data source + filter pattern is already proven — Preordain's
"UPCOMING RELEASES" panel either:

- (a) doesn't apply the same `released_at > today` filter, OR
- (b) reverses the sort direction (descending from epoch rather than
  ascending from today), OR
- (c) both.

**Suspected files:** `src/stores/market.js` or `src/screens/preordain.js`'s
upcoming-releases selector. The fix is likely < 10 lines — mirror the
Epic Experiment pattern or align the selector contract.

**Status:** Deferred — not caused by Phase 13. Phase 13 Plan 3 Task 5c
(honest empty-state patch + asset path fix) does not touch Preordain's
upcoming-releases selector.

**Proposed owner:** Plan 13-06 audit sweep OR a follow-up bug-fix plan
outside the Phase 13 wave.

---
