# Topbar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move static navigation (brand + 5-screen links + auth/profile widget) from the global left sidebar into the existing top bar; delete the sidebar.

**Architecture:** Chrome-level UI refactor following Approach 1 from [docs/superpowers/specs/2026-05-10-topbar-nav-design.md](docs/superpowers/specs/2026-05-10-topbar-nav-design.md). Minimal blast radius — no new contextual-sidebar abstraction, no per-screen layout work. Each screen reclaims the left edge and renders full-width. Treasure Cruise's add-card workbench and Thousand-Year Storm's three-panel layout are internal to those screens and untouched.

**Tech Stack:** Vanilla JS + Alpine.js 3.15 + Tailwind v4 (no PostCSS plugins; CSS-first `@theme`). Tests use Vitest with static-grep on `index.html` (existing pattern from `tests/topbar-bulkdata-pill.test.js`).

**Spec amendment caught during plan-writing:** the spec listed `profile avatar (Phase 10)` as an existing topbar element. Inspection of `index.html:211-249` shows it's actually in the sidebar (anonymous → SIGN IN button; authed → avatar + name + email row). This plan therefore includes migrating the profile widget to the topbar — without this, deleting the sidebar would orphan the only sign-in surface.

---

## File Structure

| File | Role | Action |
|---|---|---|
| `index.html` | App shell markup. Sidebar `<aside>` block (~lines 117-249) holds brand + nav + profile widget. Topbar `<header>` block (~lines 257-440+) holds COUNTERFLUX h1 + search + sync chip + bulk-data pill + bell. | Modify: delete `<aside>`, restructure `<header>` to host brand + nav + profile widget + existing chrome. |
| `src/components/topbar.js` | Alpine component data — currently only `handleSearch()`. | Modify: add `screenNavLinks` getter, `handleNavClick(screen)`, `navItemClasses(screen)`, migrated `profileWidgetClick()`, `authedDisplayName()`, `authedAvatarUrl()`. |
| `src/components/sidebar.js` | Alpine component data for the sidebar. | Delete. |
| `src/stores/app.js` | App store. Has `screens` array with card-name `label` per screen, `currentScreen`, `sidebarCollapsed` state + `toggleSidebar()` action, viewport-resize listener that mutates `sidebarCollapsed`. | Modify: add `topbarLabel` field per screen (plain function names); remove `sidebarCollapsed`, `toggleSidebar()`, `hydrateSidebarCollapsed()`, the resize listener that touches `sidebarCollapsed`. |
| `src/main.js` | App bootstrap. | Modify if it imports `sidebar.js` — remove the import. |
| `.planning/PROJECT.md` | Project doc with stale Mila chrome reference. | Modify: drop "sidebar" from `Mila — Corgi system familiar (sidebar, empty states, tips)` line. |
| `tests/topbar-nav.test.js` | **NEW** static-grep + factory contract tests for the topbar brand + nav + active state + profile widget. | Create. |
| `tests/sidebar-collapse.test.js` | Tests the sidebar collapse persistence. | Delete (sidebar gone). |
| `tests/topbar.test.js` (referenced in spec) | Spec assumed existence — does NOT exist. | Plan uses `tests/topbar-nav.test.js` instead to keep the new file scoped to nav work; the bulk-data pill keeps its own `tests/topbar-bulkdata-pill.test.js`. |

---

## Task 1: Brand block in the topbar

**Files:**
- Create: `tests/topbar-nav.test.js`
- Modify: `index.html` — replace the plain `<h1>COUNTERFLUX</h1>` at ~line 263 with a brand block (cyclone icon + wordmark, transplanted from sidebar)

- [ ] **Step 1: Create the failing test file**

```javascript
// tests/topbar-nav.test.js
// Static-grep + factory contract tests for the new top-bar nav,
// following the pattern from tests/topbar-bulkdata-pill.test.js.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf-8');

// Helper: extract the <header>...</header> block from the topbar.
// Returns '' if the header isn't found — the test will fail meaningfully.
function topbarMarkup() {
  const start = html.indexOf('<header');
  if (start === -1) return '';
  const end = html.indexOf('</header>', start);
  return end === -1 ? html.slice(start) : html.slice(start, end + '</header>'.length);
}

describe('topbar brand block', () => {
  const topbar = topbarMarkup();

  it('renders the cyclone Material Symbol inside the topbar', () => {
    expect(topbar).toMatch(/cyclone/);
  });

  it('renders the COUNTERFLUX wordmark inside the topbar', () => {
    expect(topbar).toMatch(/COUNTERFLUX/);
  });

  it('uses JetBrains Mono treatment for the wordmark (matches transplanted sidebar brand)', () => {
    // The sidebar brand uses font-mono + uppercase + tracking-[0.3em] + font-bold.
    // The topbar brand block must use the same treatment to preserve the Izzet look.
    expect(topbar).toMatch(/font-mono[\s\S]*?COUNTERFLUX|COUNTERFLUX[\s\S]*?font-mono/);
    expect(topbar).toMatch(/tracking-\[0\.3em\]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/topbar-nav.test.js`
Expected: FAIL on the `font-mono`/`tracking-[0.3em]` assertions (the current topbar uses a plain h1 with `font-header text-xl`, not the mono-wordmark treatment).

- [ ] **Step 3: Replace plain h1 with brand block in `index.html`**

Find the topbar block in `index.html` at ~line 257. Replace:

```html
<!-- Title -->
<h1 class="font-header text-xl font-bold text-text-primary whitespace-nowrap" style="font-size: 20px; line-height: 1.2; letter-spacing: 0.01em;">
  COUNTERFLUX
</h1>
```

With:

```html
<!-- Brand block — transplanted from sidebar (cyclone icon + COUNTERFLUX wordmark) -->
<a href="#/" class="flex items-center gap-sm whitespace-nowrap" aria-label="Counterflux home">
  <span class="material-symbols-outlined text-primary text-3xl">cyclone</span>
  <span class="font-mono text-text-primary uppercase text-[11px] tracking-[0.3em] font-bold">COUNTERFLUX</span>
</a>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/topbar-nav.test.js`
Expected: PASS on brand-block tests.

- [ ] **Step 5: Commit**

```bash
rtk git add tests/topbar-nav.test.js index.html
rtk git commit -m "feat(topbar): add brand block (cyclone + wordmark)"
```

---

## Task 2: 5-screen nav links + `topbarLabel` store field

**Files:**
- Modify: `src/stores/app.js` — add `topbarLabel` field per screen
- Modify: `src/components/topbar.js` — add `handleNavClick(screen)` and `navItemClasses(screen)` helper methods
- Modify: `index.html` — add nav block inside topbar `<header>`, immediately after the brand block
- Modify: `tests/topbar-nav.test.js` — append nav-link RED tests

- [ ] **Step 1: Add nav RED tests to `tests/topbar-nav.test.js`**

Append at the bottom of the file:

```javascript
describe('topbar nav links', () => {
  const topbar = topbarMarkup();

  const plainLabels = ['Dashboard', 'Collection', 'Decks', 'Market', 'Game'];

  it('renders all five plain function-name labels inside the topbar', () => {
    for (const label of plainLabels) {
      // Each label appears in the topbar block.
      expect(topbar).toMatch(new RegExp(`>${label}<`));
    }
  });

  it('uses an x-for loop driven by $store.app.screens', () => {
    expect(topbar).toMatch(/x-for="screen in \$store\.app\.screens"/);
  });

  it('binds each link to screen.route', () => {
    expect(topbar).toMatch(/:href="'#' \+ screen\.route"/);
  });
});

describe('app store — topbarLabel field (static grep against source)', () => {
  // src/stores/app.js imports Alpine from 'alpinejs', so we can't stub it cleanly
  // in a node test. Static grep against the source file is reliable and matches
  // the pattern used by tests/topbar-bulkdata-pill.test.js (readFileSync + regex).
  const appJs = readFileSync('src/stores/app.js', 'utf-8');

  const expected = {
    'epic-experiment': 'Dashboard',
    'treasure-cruise': 'Collection',
    'thousand-year-storm': 'Decks',
    'preordain': 'Market',
    'vandalblast': 'Game',
  };

  for (const [id, topbarLabel] of Object.entries(expected)) {
    it(`screen "${id}" has topbarLabel "${topbarLabel}"`, () => {
      // The screen entry is a single object literal — find by id, then assert
      // topbarLabel appears in the same {...} block.
      const idMatch = appJs.match(new RegExp(`\\{[^}]*id:\\s*'${id}'[^}]*\\}`));
      expect(idMatch).toBeTruthy();
      expect(idMatch[0]).toMatch(new RegExp(`topbarLabel:\\s*'${topbarLabel}'`));
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/topbar-nav.test.js`
Expected: FAIL on nav-link and topbarLabel tests (no nav in topbar, no `topbarLabel` field in store).

- [ ] **Step 3: Add `topbarLabel` field in `src/stores/app.js`**

Replace the existing `screens` array (lines ~28-34):

```javascript
screens: [
  { id: 'epic-experiment',      label: 'Epic Experiment',      topbarLabel: 'Dashboard',  icon: 'dashboard',                route: '/',                    locked: false },
  { id: 'treasure-cruise',      label: 'Treasure Cruise',      topbarLabel: 'Collection', icon: 'collections_bookmark',     route: '/treasure-cruise',     locked: false },
  { id: 'thousand-year-storm',  label: 'Thousand-Year Storm',  topbarLabel: 'Decks',      icon: 'auto_fix_high',            route: '/thousand-year-storm', locked: false },
  { id: 'preordain',            label: 'Preordain',            topbarLabel: 'Market',     icon: 'insights',                 route: '/preordain',           locked: false },
  { id: 'vandalblast',          label: 'Vandalblast',          topbarLabel: 'Game',       icon: 'local_fire_department',    route: '/vandalblast',         locked: false },
],
```

(Keep `label` — screens may still use it as a page H1 or page title.)

- [ ] **Step 4: Add nav helper methods to `src/components/topbar.js`**

Replace the existing `topbarComponent()` body with:

```javascript
export function topbarComponent() {
  return {
    /**
     * Handle search input -- delegates to Alpine search store with debounce.
     * @param {Event} event - Input event
     */
    handleSearch(event) {
      const query = event.target.value;
      Alpine.store('search').search(query);
    },

    /**
     * Navigate to a screen by id. Skips locked screens.
     * @param {Object} screen - Screen object from $store.app.screens
     */
    handleNavClick(screen) {
      if (screen.locked) return;
      if (this.$store.app.currentScreen === screen.id) return;
      this.$store.app.navigate(screen.id);
      if (window.__counterflux_router) {
        window.__counterflux_router.navigate(screen.route);
      }
    },

    /**
     * Tailwind classes for a topbar nav item based on active/locked state.
     * Active: blue accent on text + 2px blue bottom border.
     * Inactive: muted text, hover lifts to primary.
     * Locked: dim + not-allowed (parity with current sidebar behavior).
     * @param {Object} screen - Screen object
     * @returns {string} Tailwind class string
     */
    navItemClasses(screen) {
      if (screen.locked) {
        return 'text-text-dim cursor-not-allowed opacity-50';
      }
      if (this.$store.app.currentScreen === screen.id) {
        return 'text-primary border-b-2 border-primary';
      }
      return 'text-text-muted hover:text-primary border-b-2 border-transparent';
    }
  };
}
```

- [ ] **Step 5: Add nav block in `index.html`**

In the topbar `<header>` block, immediately after the brand block (Task 1), and BEFORE the `<!-- Topbar search -->` block, insert:

```html
<!-- Nav block — 5-screen router -->
<nav x-data="topbarComponent()" class="flex items-center gap-md ml-xl" aria-label="Primary">
  <template x-for="screen in $store.app.screens" :key="screen.id">
    <a
      :href="screen.locked ? 'javascript:void(0)' : '#' + screen.route"
      :class="navItemClasses(screen)"
      class="font-mono text-[11px] font-bold uppercase tracking-[0.15em] py-2 px-3 transition-colors duration-150"
      :aria-current="$store.app.currentScreen === screen.id ? 'page' : false"
      :aria-disabled="screen.locked"
      @click.prevent="handleNavClick(screen)"
      x-text="screen.topbarLabel"
    ></a>
  </template>
</nav>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/topbar-nav.test.js`
Expected: PASS on nav-link tests and topbarLabel field test.

- [ ] **Step 7: Commit**

```bash
rtk git add src/stores/app.js src/components/topbar.js index.html tests/topbar-nav.test.js
rtk git commit -m "feat(topbar): add 5-screen nav + topbarLabel store field"
```

---

## Task 3: Active-state highlighting

**Files:**
- Modify: `tests/topbar-nav.test.js` — append active-state RED test
- (No `index.html` change needed — `navItemClasses` from Task 2 already implements active state)

This task is a verification gate. If Task 2's `navItemClasses` is wrong, this test catches it. If right, this is a one-step task.

- [ ] **Step 1: Append active-state test to `tests/topbar-nav.test.js`**

```javascript
describe('topbar nav — active state', () => {
  let topbarComponent;
  beforeAll(async () => {
    const mod = await import('../src/components/topbar.js');
    topbarComponent = mod.topbarComponent;
  });

  it('returns active classes when the screen matches currentScreen', () => {
    const data = topbarComponent();
    data.$store = { app: { currentScreen: 'preordain' } };
    const screen = { id: 'preordain', locked: false };
    const classes = data.navItemClasses(screen);
    expect(classes).toMatch(/text-primary/);
    expect(classes).toMatch(/border-primary/);
  });

  it('returns muted classes when the screen does NOT match currentScreen', () => {
    const data = topbarComponent();
    data.$store = { app: { currentScreen: 'epic-experiment' } };
    const screen = { id: 'preordain', locked: false };
    const classes = data.navItemClasses(screen);
    expect(classes).toMatch(/text-text-muted/);
    expect(classes).not.toMatch(/text-primary\b/);
  });

  it('returns locked classes when the screen is locked', () => {
    const data = topbarComponent();
    data.$store = { app: { currentScreen: 'epic-experiment' } };
    const screen = { id: 'mila', locked: true };
    const classes = data.navItemClasses(screen);
    expect(classes).toMatch(/cursor-not-allowed/);
    expect(classes).toMatch(/opacity-50/);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- tests/topbar-nav.test.js`
Expected: PASS — the `navItemClasses` from Task 2 already implements these branches.

- [ ] **Step 3: Commit**

```bash
rtk git add tests/topbar-nav.test.js
rtk git commit -m "test(topbar): cover nav active/muted/locked state classes"
```

---

## Task 4: Migrate profile widget to topbar

**Files:**
- Modify: `tests/topbar-nav.test.js` — append profile-widget migration tests
- Modify: `src/components/topbar.js` — port `profileWidgetClick`, `authedDisplayName`, `authedAvatarUrl` from `src/components/sidebar.js`
- Modify: `index.html` — move the entire profile-widget markup block (anonymous SIGN IN + authed avatar/name/email) from inside the `<aside>` to inside the topbar `<header>`, right-justified after the existing actions

- [ ] **Step 1: Add profile-widget RED tests**

Append to `tests/topbar-nav.test.js`:

```javascript
describe('topbar profile widget (migrated from sidebar)', () => {
  const topbar = topbarMarkup();

  it('renders the anonymous SIGN IN button inside the topbar', () => {
    expect(topbar).toMatch(/cf-topbar-signin-cta|cf-sidebar-signin-cta/);
    expect(topbar).toMatch(/SIGN IN/);
  });

  it('renders the authed avatar/name/email row inside the topbar', () => {
    expect(topbar).toMatch(/authedDisplayName\(\)/);
    expect(topbar).toMatch(/authedAvatarUrl\(\)/);
  });

  it('topbarComponent exposes the three migrated methods', async () => {
    const { topbarComponent } = await import('../src/components/topbar.js');
    const data = topbarComponent();
    expect(typeof data.profileWidgetClick).toBe('function');
    expect(typeof data.authedDisplayName).toBe('function');
    expect(typeof data.authedAvatarUrl).toBe('function');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/topbar-nav.test.js`
Expected: FAIL — profile widget is still inside `<aside>`, topbar methods don't exist yet.

- [ ] **Step 3: Port methods into `src/components/topbar.js`**

Append to the returned object inside `topbarComponent()`:

```javascript
,

    /**
     * Phase 10 D-09 — profile-widget click handler branches on auth status.
     * Migrated from sidebar.js as part of the topbar nav refactor (2026-05-10).
     * Anonymous → open auth-modal. Authed → open settings-modal.
     */
    profileWidgetClick() {
      const auth = this.$store.auth;
      if (auth && auth.status === 'authed') {
        if (typeof window.__openSettingsModal === 'function') window.__openSettingsModal();
      } else {
        if (typeof window.__openAuthModal === 'function') window.__openAuthModal();
      }
    },

    /**
     * Phase 10 — display name for the authed topbar widget.
     * Priority: profile.name → user_metadata.full_name → user_metadata.given_name → email localpart.
     */
    authedDisplayName() {
      const profile = this.$store.profile;
      const auth = this.$store.auth;
      if (profile?.name) return profile.name;
      const u = auth?.user;
      if (!u) return '';
      return u.user_metadata?.full_name
        || u.user_metadata?.given_name
        || (u.email?.split('@')[0])
        || '';
    },

    /**
     * Phase 10 D-15 — avatar URL for the authed topbar widget.
     * Returns null when no avatar is available (template falls back to initials).
     */
    authedAvatarUrl() {
      const profile = this.$store.profile;
      return profile?.effectiveAvatarUrl || null;
    }
```

- [ ] **Step 4: Move the profile-widget markup in `index.html`**

In the sidebar `<aside>` block, locate the section starting with `<!-- Profile (bottom) — Phase 10 D-09 ... -->` (~line 211) and ending with the closing `</template>` (~line 249). Cut this entire block.

In the topbar `<header>` block, find the right-section closing `</div>` (just before `</header>`). Paste the profile-widget block immediately before that closing `</div>`, replacing `x-data="sidebarComponent()"` with `x-data="topbarComponent()"` and removing the `x-show="!$store.app.sidebarCollapsed"` directives (no collapse mode in the topbar) and any `$store.app.sidebarCollapsed`-dependent class bindings:

```html
<!-- Profile widget — migrated from sidebar (Phase 10 D-09 anonymous/authed branch) -->
<div x-data="topbarComponent()" class="ml-md">

  <!-- ANONYMOUS: SIGN IN CTA -->
  <template x-if="$store.auth?.status !== 'authed'">
    <button
      id="cf-topbar-signin-cta"
      @click="profileWidgetClick()"
      aria-label="Sign in"
      class="flex items-center justify-center gap-sm cursor-pointer transition-shadow"
      style="background:#0D52BD;color:#EAECEE;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;height:36px;border:none;padding:0 12px;"
      onmouseover="this.style.boxShadow='0 0 12px rgba(13,82,189,0.3)'"
      onmouseout="this.style.boxShadow=''"
    >
      <span>SIGN IN</span>
    </button>
  </template>

  <!-- AUTHED: avatar + name row opening settings-modal -->
  <template x-if="$store.auth?.status === 'authed'">
    <div
      @click="profileWidgetClick()"
      :aria-label="'Open settings — signed in as ' + authedDisplayName()"
      class="flex items-center gap-sm px-2 py-2 cursor-pointer transition-colors hover:bg-surface-hover"
    >
      <template x-if="authedAvatarUrl()">
        <img :src="authedAvatarUrl()" class="w-8 h-8 object-cover shrink-0" style="border:1px solid #2A2D3A;">
      </template>
      <template x-if="!authedAvatarUrl()">
        <div class="w-8 h-8 shrink-0 flex items-center justify-center" style="background:#1C1F28;border:1px solid #2A2D3A;">
          <span class="font-header text-text-muted" style="font-size:13px;font-weight:700;" x-text="$store.profile.initials"></span>
        </div>
      </template>
      <div class="flex flex-col min-w-0">
        <span class="font-body text-text-primary truncate" style="font-size:13px;font-weight:700;line-height:1.2;" x-text="authedDisplayName()"></span>
      </div>
    </div>
  </template>

</div>
```

Note: the topbar version drops the email line (kept in the settings modal) and the collapsed-state branching, but preserves the click → settings/auth modal behavior identically.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/topbar-nav.test.js`
Expected: PASS on profile widget migration tests.

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/topbar.js index.html tests/topbar-nav.test.js
rtk git commit -m "feat(topbar): migrate profile widget from sidebar"
```

---

## Task 5: Sidebar removal + content-area offset audit

**Files:**
- Modify: `index.html` — delete the `<aside>` block entirely; remove `:class="$store.app.sidebarCollapsed ? 'ml-16' : 'ml-60'"` from the `<header>` AND from the main content area (lines ~258 and ~437)
- Modify: `src/stores/app.js` — remove `sidebarCollapsed`, `toggleSidebar()`, `hydrateSidebarCollapsed()`, and the `window.addEventListener('resize', ...)` block that mutates `sidebarCollapsed`
- Modify: `src/main.js` — remove `import` of `sidebarComponent` if present
- Delete: `src/components/sidebar.js`
- Delete: `tests/sidebar-collapse.test.js`
- Modify: `tests/topbar-nav.test.js` — append a sidebar-removal regression test

- [ ] **Step 1: Add sidebar-removal regression test**

Append to `tests/topbar-nav.test.js`:

```javascript
describe('sidebar removal', () => {
  it('index.html no longer contains an <aside> shell element', () => {
    expect(html).not.toMatch(/<aside\b/);
  });

  it('main content area no longer applies a sidebar-width offset class', () => {
    expect(html).not.toMatch(/sidebarCollapsed\s*\?\s*'ml-16'\s*:\s*'ml-60'/);
  });
});

describe('app store cleanup (static grep against source)', () => {
  const appJs = readFileSync('src/stores/app.js', 'utf-8');

  it('no longer declares sidebarCollapsed state', () => {
    expect(appJs).not.toMatch(/sidebarCollapsed/);
  });

  it('no longer exposes toggleSidebar action', () => {
    expect(appJs).not.toMatch(/toggleSidebar/);
  });

  it('no longer references the sidebar_collapsed localStorage key', () => {
    expect(appJs).not.toMatch(/sidebar_collapsed/);
  });
});
```

(Note: ESM module caching may need a query-string busting trick if the test runner caches `app.js`. Alternative: rely on the static-grep test against the source file string.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/topbar-nav.test.js`
Expected: FAIL on sidebar-removal tests (sidebar still present).

- [ ] **Step 3: Delete the sidebar `<aside>` block in `index.html`**

Cut the entire `<aside class="fixed left-0 top-0 bottom-0 z-30 ..." ...>` … `</aside>` block (after Task 4 moved out the profile widget, this is just brand + collapse toggle + nav + sign-in template-if scaffolding).

- [ ] **Step 4: Remove the ml-offset bindings in `index.html`**

In two places (the topbar `<header>` and the main content area), remove the `:class="$store.app.sidebarCollapsed ? 'ml-16' : 'ml-60'"` directive. Replace with no class or with `class="ml-0"`. The transition-all timer can stay or go — favor going.

Concretely, the topbar `<header>` currently reads:

```html
<header
  :class="$store.app.sidebarCollapsed ? 'ml-16' : 'ml-60'"
  class="fixed top-0 right-0 z-40 h-16 glass-overlay border-b border-border-ghost flex items-center justify-between px-xl transition-all duration-200"
>
```

Change to:

```html
<header
  class="fixed top-0 left-0 right-0 z-40 h-16 glass-overlay border-b border-border-ghost flex items-center justify-between px-xl"
>
```

(Drop the `:class` directive; add `left-0` to the static class list; remove `transition-all duration-200` since there's no longer a width to transition.)

Apply the equivalent change at line ~437 (the main content area's `:class="$store.app.sidebarCollapsed ? 'ml-16' : 'ml-60'"`).

- [ ] **Step 5: Clean up `src/stores/app.js`**

Replace the whole file with:

```javascript
import Alpine from 'alpinejs';

export function initAppStore() {
  Alpine.store('app', {
    currentScreen: 'epic-experiment',

    screens: [
      { id: 'epic-experiment',      label: 'Epic Experiment',      topbarLabel: 'Dashboard',  icon: 'dashboard',                route: '/',                    locked: false },
      { id: 'treasure-cruise',      label: 'Treasure Cruise',      topbarLabel: 'Collection', icon: 'collections_bookmark',     route: '/treasure-cruise',     locked: false },
      { id: 'thousand-year-storm',  label: 'Thousand-Year Storm',  topbarLabel: 'Decks',      icon: 'auto_fix_high',            route: '/thousand-year-storm', locked: false },
      { id: 'preordain',            label: 'Preordain',            topbarLabel: 'Market',     icon: 'insights',                 route: '/preordain',           locked: false },
      { id: 'vandalblast',          label: 'Vandalblast',          topbarLabel: 'Game',       icon: 'local_fire_department',    route: '/vandalblast',         locked: false },
    ],

    navigate(screenId) {
      const screen = this.screens.find(s => s.id === screenId);
      if (!screen || screen.locked) return;
      this.currentScreen = screenId;
      if (screenId !== 'vandalblast' && typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    }
  });

  Alpine.store('toast', {
    items: [],
    _nextId: 1,

    show(message, type = 'info', duration = 5000) {
      const id = this._nextId++;
      this.items.push({ id, message, type, visible: true });
      while (this.items.filter(t => t.visible).length > 3) {
        const oldest = this.items.find(t => t.visible);
        if (oldest) oldest.visible = false;
      }
      setTimeout(() => {
        const item = this.items.find(t => t.id === id);
        if (item) item.visible = false;
        setTimeout(() => {
          this.items = this.items.filter(t => t.id !== id);
        }, 300);
      }, duration);
    },

    dismiss(id) {
      const item = this.items.find(t => t.id === id);
      if (item) {
        item.visible = false;
        setTimeout(() => {
          this.items = this.items.filter(t => t.id !== id);
        }, 300);
      }
    },

    showUndo(message, undoId) {
      this.items.push({ id: undoId, message, type: 'undo', visible: true, undoId });
      while (this.items.filter(t => t.visible).length > 3) {
        const oldest = this.items.find(t => t.visible);
        if (oldest) oldest.visible = false;
      }
      setTimeout(() => {
        const item = this.items.find(t => t.id === undoId);
        if (item) item.visible = false;
        setTimeout(() => {
          this.items = this.items.filter(t => t.id !== undoId);
        }, 300);
      }, 10300);
    },

    info(msg) { this.show(msg, 'info'); },
    success(msg) { this.show(msg, 'success'); },
    warning(msg) { this.show(msg, 'warning'); },
    error(msg) { this.show(msg, 'error', 8000); },
  });

  window.addEventListener('hashchange', () => {
    if (typeof document !== 'undefined' && document.fullscreenElement && !window.location.hash.includes('vandalblast')) {
      document.exitFullscreen?.();
    }
  });
}
```

(Removes: `hydrateSidebarCollapsed()`, `sidebarCollapsed` field, `toggleSidebar()` action, the viewport-resize listener that mutated `sidebarCollapsed`. Preserves: `currentScreen`, `screens` with `topbarLabel`, `navigate()`, the toast store, the fullscreen-on-hashchange handler.)

- [ ] **Step 6: Delete `src/components/sidebar.js` and `tests/sidebar-collapse.test.js`**

```bash
rm src/components/sidebar.js tests/sidebar-collapse.test.js
```

- [ ] **Step 7: Audit `src/main.js` for sidebar imports**

```bash
rtk grep -n "sidebar" src/main.js
```

If a `import { sidebarComponent } from './components/sidebar.js'` line exists, delete it. If `window.sidebarComponent = sidebarComponent` is registered, delete that registration. If neither exists, no change.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: All tests pass. `tests/topbar-nav.test.js` covers the new surface; `tests/sidebar-collapse.test.js` is gone; no other test depends on `sidebarCollapsed` (already verified by `rtk grep -r sidebarCollapsed tests/` returning only the deleted file).

Expected failure mode if Task 5 is wrong: screen-level CSS that assumed left padding for the sidebar may produce a horizontally-offset content area. The static-grep test does not catch this. Verify manually in Task 6.

- [ ] **Step 9: Commit**

```bash
rtk git add index.html src/stores/app.js src/components/sidebar.js src/main.js tests/topbar-nav.test.js tests/sidebar-collapse.test.js
rtk git commit -m "refactor(shell): remove global sidebar, hoist nav to topbar"
```

---

## Task 6: Docs touch-up + manual smoke

**Files:**
- Modify: `.planning/PROJECT.md` — drop the "sidebar" phrase from Mila's chrome reference

- [ ] **Step 1: Update PROJECT.md Mila line**

Find the line in `.planning/PROJECT.md`:

```markdown
- **Mila — Corgi system familiar (sidebar, empty states, tips)**
```

Or similar wording (search for `Mila` and adjust). Replace `sidebar, empty states, tips` with `Dashboard insights, empty states, tips`.

Also check the CLAUDE.md file for the line:

```markdown
- **Mila** — Corgi system familiar (sidebar, empty states, tips)
```

If present, apply the same edit.

- [ ] **Step 2: Run final smoke**

```bash
rtk npm run dev
```

In a browser at `http://localhost:5173` (or whatever Vite reports), verify each screen:

| Screen | Check |
|---|---|
| Epic Experiment (Dashboard) | Loads at full width. Mila's Insights card renders normally. No left-edge clipping. |
| Treasure Cruise (Collection) | Loads. Add-card workbench LHS panel still positions correctly inside the content area. |
| Thousand-Year Storm (Decks) | Loads. Three-panel layout (search / the 99 / analytics) still positions correctly. |
| Preordain (Market) | Loads at full width. Spoiler grid renders. |
| Vandalblast (Game) | Loads. Game tracker is full-screen — unaffected. |

Anonymous + authed sanity:
- Sign out → topbar shows SIGN IN button. Click → auth modal opens.
- Sign in → topbar shows avatar + name. Click → settings modal opens.

- [ ] **Step 3: Commit docs**

```bash
rtk git add .planning/PROJECT.md CLAUDE.md
rtk git commit -m "docs(mila): drop sidebar reference (chrome relocated to topbar)"
```

- [ ] **Step 4: Push when ready**

```bash
rtk git push origin master
```

(Direct push to master matches the existing Counterflux workflow — no PR ceremony unless the user prefers it.)

---

## Out of scope (explicit)

- No new "contextual sidebar slot" abstraction.
- No redesign of Treasure Cruise or Thousand-Year Storm internal layouts.
- No mobile responsive topbar collapse / hamburger menu.
- No fix for the 4 pre-existing uncaught Alpine errors in `tests/router.test.js`.
- No Mila content relocation beyond removing the chrome reference (her existing Dashboard "Mila's Insights" card and empty-state appearances stay).

---

## Notes on execution paths

This plan is executable via three paths. Pick whichever fits the moment:

1. **`/gsd:quick` (matches Counterflux's GSD-enforcement convention).** Pass this plan file as the description; gsd-planner produces a parallel plan in `.planning/quick/...`, gsd-executor runs it. Use this if you want the project's atomic-commit + STATE.md tracking automation.
2. **Subagent-driven (writing-plans default).** Dispatch one subagent per task via `superpowers:subagent-driven-development`. Fresh context per task, two-stage review between tasks. Best for high-vigilance review.
3. **Inline executing-plans.** Walk the tasks in the current session via `superpowers:executing-plans`. Faster, no subagent overhead. Use if you want to be in the loop on every step.

The Counterflux project's CLAUDE.md mandates GSD for code-changing work, so path 1 is the recommended default.
