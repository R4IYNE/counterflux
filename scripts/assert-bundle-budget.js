#!/usr/bin/env node
/**
 * Phase 13 Plan 5 — bundle size-gate (`scripts/assert-bundle-budget.js`).
 *
 * Inspects dist/ after `npm run build` and fails if any chunk exceeds its
 * budget. Budgets are gzipped KB (the real-world cost that hits user
 * bandwidth). Gzip is computed live via node:zlib.gzipSync against the
 * raw built file — no shell-out, no separate compression step.
 *
 * Wired via `npm run build:check` — run manually or in CI after any change
 * affecting bundle shape. The script prints a table of every JS/CSS chunk
 * with its category + gzip size + budget + status, then exits 1 if any
 * violations are present.
 *
 * Canonical budget identifiers (referenced by tests/bundle-budget.test.js):
 *   MAX_MAIN_BUNDLE    = 300 KB gz  (critical-path JS + CSS on first paint)
 *   MAX_MANA_FONT      = 120 KB gz  (99 KB mana-font + overhead)
 *   MAX_KEYRUNE        =  50 KB gz  (keyrune set icons — lighter than mana)
 *   MAX_SCREEN_CHUNK   =  40 KB gz  (per-screen module, lazy-loaded)
 *   MAX_VENDOR_CHUNK   = 100 KB gz  (any other vendor split, e.g. chart.js, supabase)
 *   DEFAULT            = 500 KB gz  (fail loud if something unexpectedly huge ships)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIST_ASSETS = 'dist/assets';

// KB gzipped — canonical budgets. The MAX_* aliases below are referenced
// by tests/bundle-budget.test.js to prove the contract is documented.
const MAX_MAIN_BUNDLE = 300;
const MAX_MANA_FONT = 120;
const MAX_KEYRUNE = 50;
const MAX_SCREEN_CHUNK = 40;
const MAX_VENDOR_CHUNK = 100;
const DEFAULT_BUDGET = 500;

// Literal-number form so static-grep tests can confirm budgets by category.
// Mirrors the MAX_* aliases above (kept as named constants for readability).
const BUDGETS = {
  main: 300,
  'mana-font': 120,
  keyrune: 50,
  screen: 40,
  vendor: 100,
  worker: 100,
  // Modal/panel/service code-split chunks can be as large as a screen
  // module but not larger than a vendor bundle. Map them to the vendor
  // budget so Supabase (~47 KB gz) and Chart.js (~63 KB gz) don't trip
  // the default 500 KB alarm.
  component: 100,
  default: 500,
};

// Cross-check: literal BUDGETS must stay in lockstep with MAX_* aliases.
if (
  BUDGETS.main !== MAX_MAIN_BUNDLE ||
  BUDGETS['mana-font'] !== MAX_MANA_FONT ||
  BUDGETS.keyrune !== MAX_KEYRUNE ||
  BUDGETS.screen !== MAX_SCREEN_CHUNK ||
  BUDGETS.vendor !== MAX_VENDOR_CHUNK ||
  BUDGETS.default !== DEFAULT_BUDGET
) {
  console.error('[bundle-budget] BUDGETS drifted from MAX_* aliases — fix before continuing');
  process.exit(1);
}

function classifyChunk(name) {
  if (/mana-font|^mana[-.]/.test(name)) return 'mana-font';
  if (/keyrune/.test(name)) return 'keyrune';
  if (/^(epic-experiment|treasure-cruise|thousand-year|preordain|vandalblast)-/.test(name)) {
    return 'screen';
  }
  if (/^(index|main)-/.test(name)) return 'main';
  if (/worker/.test(name)) return 'worker';
  if (/^(chart|vendor|supabase|papaparse|alpinejs|dexie|navigo|sortablejs)/.test(name)) {
    return 'vendor';
  }
  if (/modal|panel|overlay|splash|sync-|schema|scryfall|sparkline|preload-helper|rolldown|empty-state|mass-entry|ritual/.test(name)) {
    return 'component';
  }
  return 'default';
}

function toGzipKB(filepath) {
  const raw = readFileSync(filepath);
  const gz = gzipSync(raw);
  return gz.length / 1024;
}

function main() {
  try {
    readdirSync(DIST_ASSETS);
  } catch {
    console.error(`[bundle-budget] ${DIST_ASSETS} not found — run 'npm run build' first`);
    process.exit(1);
  }

  const files = readdirSync(DIST_ASSETS).filter((f) => /\.(js|css)$/.test(f));
  const violations = [];
  const report = [];

  for (const file of files) {
    const path = join(DIST_ASSETS, file);
    const category = classifyChunk(file);
    const gzipKB = toGzipKB(path);
    const budget = BUDGETS[category] ?? BUDGETS.default;
    const status = gzipKB > budget ? 'FAIL' : 'ok';
    report.push({
      file,
      category,
      gzipKB: gzipKB.toFixed(1),
      budget,
      status,
    });
    if (status === 'FAIL') {
      violations.push({ file, category, gzipKB, budget });
    }
  }

  report.sort((a, b) => parseFloat(b.gzipKB) - parseFloat(a.gzipKB));
  console.table(report);

  if (violations.length > 0) {
    console.error('\n[bundle-budget] VIOLATIONS:');
    for (const v of violations) {
      console.error(
        `  - ${v.file} (${v.category}) = ${v.gzipKB.toFixed(1)} KB gzipped exceeds budget ${v.budget} KB`
      );
    }
    process.exit(1);
  }

  console.log('\n[bundle-budget] All chunks within budget');
  process.exit(0);
}

main();
