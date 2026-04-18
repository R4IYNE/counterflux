// src/components/sync-pull-splash.js
//
// Phase 11 Plan 3 — Sync-pull splash (D-12..D-14). Full-screen blocking splash
// mounted when first-sign-in detects empty-local + populated-cloud (Sharon on
// a fresh device). Mirrors Phase 7 splash-screen.js visual pattern (Mila pulse
// image + Syne heading + Space Grotesk body + progress bar + 11/mono caption
// + rotating flavour taglines).
//
// Progress is bound to Alpine.store('sync').bulkPullProgress = { table, pulled, total }
// — the sync engine (Plan 11-05) will mutate this field; the splash polls the
// store every 200ms and re-renders the progress fill + caption.
//
// API:
//   openSyncPullSplash() — mount splash (idempotent — no-op if already mounted)
//   closeSyncPullSplash() — fade out over 300ms, then unmount
//   renderSyncPullError({ pulled, total, onRetry }) — swap body in-place to
//     error content with SYNC FAILED heading + RETRY SYNC CTA
//
// Copy (UI-SPEC §Copywriting Contract — exact strings):
//   Heading: 'SYNCING HOUSEHOLD DATA'
//   Body: 'Grabbing your household archive…'
//   Progress caption per-table: 'SYNCED {N} / {M} {TABLE_LABEL}'
//     TABLE_LABEL: CARDS / DECKS / GAMES / WATCHLIST ITEMS / PROFILE ROWS
//   Completion flash: 'HOUSEHOLD READY'
//   Error heading: 'SYNC FAILED'
//   Error body: "Couldn't finish syncing your household data. Your local archive has {N} of {M} cards so far."
//   Error CTA: 'RETRY SYNC'
//   Error helper: 'Check your connection and try again.'
//   Mila taglines (rotate every 8s): 5 variants — see TAGLINES below
//
// D-13 + D-14: NO 'Continue with partial data' escape hatch, NO 'Skip' option.
//   RETRY SYNC is the only exit from the error state.

const MOUNT_ROOT_ID = 'cf-sync-pull-splash-root';

const TAGLINES = [
  "Mila's pulling every shelf off the rack.",
  'Dusting off your household archive.',
  'Reuniting cards, decks, and games.',
  'Mila prefers things in their rightful place.',
  'Almost there — the last pages are coming in.',
];

const TABLE_LABELS = {
  collection: 'CARDS',
  decks: 'DECKS',
  deck_cards: 'DECK CARDS',
  games: 'GAMES',
  watchlist: 'WATCHLIST ITEMS',
  profile: 'PROFILE ROWS',
};

let _activeRoot = null;
let _progressTimer = null;
let _taglineTimer = null;
let _taglineIndex = 0;

function _escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Mounts the sync-pull splash. Idempotent — calling when already mounted is a no-op.
 */
export function openSyncPullSplash() {
  if (_activeRoot) return;
  const mountRoot = document.getElementById(MOUNT_ROOT_ID) || document.body;

  const overlay = document.createElement('div');
  overlay.id = 'cf-sync-pull-splash-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.style.cssText = [
    'position: fixed',
    'inset: 0',
    'background: var(--color-background)',
    'z-index: 80',
    'display: flex',
    'flex-direction: column',
    'align-items: center',
    'justify-content: center',
    'gap: 24px',
    'color: var(--color-text-primary)',
    "font-family: 'Space Grotesk', sans-serif",
  ].join(';');

  overlay.innerHTML = `
    <img
      src="/assets/assetsmila-izzet.png"
      alt=""
      style="width: 120px; height: 120px; object-fit: contain; animation: cf-pulse 2s ease-in-out infinite;"
    />
    <h2 style="
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      font-size: 20px;
      letter-spacing: 0.01em;
      text-transform: uppercase;
      margin: 0;
      color: var(--color-text-primary);
    ">SYNCING HOUSEHOLD DATA</h2>
    <p style="
      font-size: 14px;
      font-weight: 400;
      margin: 0;
      color: var(--color-text-primary);
    ">Grabbing your household archive…</p>
    <div style="
      width: 320px;
      height: 8px;
      background: var(--color-surface);
      border: 1px solid var(--color-border-ghost);
      overflow: hidden;
    ">
      <div
        data-role="progress-fill"
        style="
          height: 100%;
          width: 0%;
          background: var(--color-primary);
          transition: width 300ms ease-out;
        "
      ></div>
    </div>
    <div
      data-role="caption"
      aria-live="polite"
      style="
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--color-text-muted);
      "
    >SYNCED 0 / 0 ITEMS</div>
    <div
      data-role="tagline"
      style="
        font-size: 14px;
        font-weight: 400;
        color: var(--color-text-muted);
        max-width: 480px;
        text-align: center;
      "
    >${_escape(TAGLINES[0])}</div>
  `;

  mountRoot.appendChild(overlay);
  _activeRoot = overlay;
  _taglineIndex = 0;

  // Tagline rotation every 8s (UI-SPEC §Component Anatomy 4 — Mila taglines)
  _taglineTimer = setInterval(() => {
    _taglineIndex = (_taglineIndex + 1) % TAGLINES.length;
    const el = overlay.querySelector('[data-role="tagline"]');
    if (el) el.textContent = TAGLINES[_taglineIndex];
  }, 8000);

  // Progress subscription — poll Alpine.store('sync').bulkPullProgress at 200ms
  // cadence. A polling loop is used (instead of Alpine.effect) because the
  // splash mounts via vanilla DOM and may render BEFORE Alpine has started;
  // polling safely no-ops until the store becomes available.
  const updateProgress = () => {
    if (!_activeRoot) return;
    const Alpine = typeof window !== 'undefined' ? window.Alpine : null;
    const store = Alpine?.store?.('sync');
    const progress = store?.bulkPullProgress;
    if (!progress || typeof progress !== 'object') return;
    const { table, pulled, total } = progress;
    const fill = _activeRoot.querySelector('[data-role="progress-fill"]');
    const caption = _activeRoot.querySelector('[data-role="caption"]');
    if (!fill || !caption) return;
    const totalNum = Number(total) || 0;
    const pulledNum = Number(pulled) || 0;
    const pct = totalNum > 0 ? Math.min(100, (pulledNum / totalNum) * 100) : 0;
    fill.style.width = `${pct}%`;
    const label = TABLE_LABELS[table] || 'ITEMS';
    caption.textContent = `SYNCED ${pulledNum} / ${totalNum} ${label}`;
  };
  _progressTimer = setInterval(updateProgress, 200);
  updateProgress(); // fire once immediately
}

/**
 * Closes the splash with a 300ms opacity fade-out per UI-SPEC motion.
 */
export function closeSyncPullSplash() {
  if (_taglineTimer) { clearInterval(_taglineTimer); _taglineTimer = null; }
  if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }
  if (!_activeRoot) return;

  const root = _activeRoot;
  _activeRoot = null;

  root.style.transition = 'opacity 300ms ease-out';
  root.style.opacity = '0';
  setTimeout(() => {
    if (root.parentNode) root.parentNode.removeChild(root);
  }, 320);
}

/**
 * Swaps the splash body in-place to an error state per D-13. Progress bar
 * freezes, Mila pause, body becomes SYNC FAILED heading + pulled/total body +
 * RETRY SYNC primary CTA + check-connection helper.
 *
 * @param {Object}   opts
 * @param {number}   opts.pulled   - rows pulled before failure (preserved in Dexie)
 * @param {number}   opts.total    - expected total rows
 * @param {Function} opts.onRetry  - invoked when user clicks RETRY SYNC
 */
export function renderSyncPullError({ pulled, total, onRetry }) {
  if (!_activeRoot) return;

  // Freeze progress + tagline timers
  if (_taglineTimer) { clearInterval(_taglineTimer); _taglineTimer = null; }
  if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }

  _activeRoot.setAttribute('role', 'alertdialog');
  _activeRoot.setAttribute('aria-labelledby', 'sync-pull-fail-heading');

  _activeRoot.innerHTML = `
    <span
      class="material-symbols-outlined"
      style="font-size: 48px; color: var(--color-secondary);"
    >error</span>
    <h2
      id="sync-pull-fail-heading"
      style="
        font-family: 'Syne', sans-serif;
        font-weight: 700;
        font-size: 20px;
        letter-spacing: 0.01em;
        text-transform: uppercase;
        color: var(--color-secondary);
        margin: 0;
      "
    >SYNC FAILED</h2>
    <p style="
      font-size: 14px;
      font-weight: 400;
      text-align: center;
      max-width: 480px;
      color: var(--color-text-primary);
      margin: 0;
    ">Couldn't finish syncing your household data. Your local archive has ${Number(pulled) || 0} of ${Number(total) || 0} cards so far.</p>
    <button
      type="button"
      data-role="retry"
      style="
        height: 40px;
        padding: 0 24px;
        background: var(--color-primary);
        border: none;
        color: var(--color-text-primary);
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        cursor: pointer;
        transition: box-shadow 150ms ease-out;
      "
    >RETRY SYNC</button>
    <p style="
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin: 0;
    ">CHECK YOUR CONNECTION AND TRY AGAIN.</p>
  `;

  const retryBtn = _activeRoot.querySelector('[data-role="retry"]');
  if (retryBtn) {
    retryBtn.addEventListener('mouseenter', () => {
      retryBtn.style.boxShadow = '0 0 12px var(--color-glow-blue)';
    });
    retryBtn.addEventListener('mouseleave', () => {
      retryBtn.style.boxShadow = 'none';
    });
    retryBtn.addEventListener('click', () => {
      if (typeof onRetry === 'function') onRetry();
    });
    // Error state autofocuses RETRY SYNC per UI-SPEC §Accessibility
    setTimeout(() => retryBtn.focus(), 0);
  }
}

/** Test-only reset — clears timers + unmounts any live splash. */
export function __resetSyncPullSplash() {
  if (_taglineTimer) { clearInterval(_taglineTimer); _taglineTimer = null; }
  if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }
  if (_activeRoot && _activeRoot.parentNode) {
    _activeRoot.parentNode.removeChild(_activeRoot);
  }
  _activeRoot = null;
}
