// src/components/reconciliation-modal.js
//
// Phase 11 Plan 3 — Reconciliation lockdown modal (SYNC-04, D-01..D-04).
//
// MILESTONE-LOAD-BEARING LOCKDOWN — the ONE screen where accidental dismiss
// could silently destroy 5000 cards of data. Mirrors first-sign-in-prompt.js
// lockdown pattern exactly: capture-phase Escape blocker, backdrop
// preventDefault, NO X close button.
//
// API:
//   openReconciliationModal({ localCounts, cloudCounts, onChoice })
//     localCounts, cloudCounts: { collection, decks, deck_cards, games, watchlist } counts
//     onChoice: async (choice) => void — receives 'MERGE_EVERYTHING' | 'KEEP_LOCAL' | 'KEEP_CLOUD'
//   Returns: Promise<void> that resolves after onChoice completes and modal unmounts.
//
// Copy (UI-SPEC §Copywriting Contract — exact strings, do NOT paraphrase):
//   Heading: 'DATA ON BOTH SIDES'
//   Body:    'Mila found data on both sides. Which should she keep?'
//   Overlines: 'LOCAL' / 'HOUSEHOLD (CLOUD)'
//   Count rows: '{N} cards' / '{N} decks' / '{N} games' / '{N} watchlist' (4 rows, profile excluded)
//   CTAs: 'MERGE EVERYTHING' / 'KEEP LOCAL' / 'KEEP CLOUD'
//   In-progress: 'MERGING…' / 'KEEPING LOCAL…' / 'KEEPING CLOUD…'
//   Legal: 'Merge uses last-write-wins by updated_at. The other two options replace one side entirely and are irreversible.'
//
// D-04 LOCKDOWN (non-negotiable):
//   - NO X close button in markup
//   - Escape key disabled via capture-phase document keydown listener
//   - Backdrop click disabled via overlay click handler that preventDefault()s
//     when the click target IS the overlay (not a child button)

const MOUNT_ROOT_ID = 'cf-reconciliation-root';

let _activeKeydownHandler = null;
let _activeRoot = null;

/**
 * Opens the reconciliation lockdown modal.
 *
 * @param {Object}   opts
 * @param {Object}   opts.localCounts  - { collection, decks, deck_cards, games, watchlist }
 * @param {Object}   opts.cloudCounts  - { collection, decks, deck_cards, games, watchlist }
 * @param {Function} opts.onChoice     - async (choice: 'MERGE_EVERYTHING'|'KEEP_LOCAL'|'KEEP_CLOUD') => void
 * @returns {Promise<void>}            - resolves after user picks + onChoice resolves + modal unmounts
 */
export function openReconciliationModal({ localCounts, cloudCounts, onChoice }) {
  return new Promise((resolve) => {
    const mountRoot = document.getElementById(MOUNT_ROOT_ID) || document.body;

    // Build overlay (vanilla DOM — no Alpine x-data needed mid-lockdown; Alpine
    // may be unavailable or mid-init on first authed sign-in).
    const overlay = document.createElement('div');
    overlay.id = 'cf-reconciliation-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'reconciliation-heading');
    overlay.setAttribute('aria-describedby', 'reconciliation-body');
    overlay.style.cssText = [
      'position: fixed',
      'inset: 0',
      // D-04 lockdown backdrop: 0.95 alpha (not 0.85 — the heavier backdrop IS the lockdown signal)
      'background: rgba(11, 12, 16, 0.95)',
      'z-index: 70',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'animation: cf-reconciliation-fade-in 240ms ease-out',
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'width: 480px',
      'max-width: 92vw',
      'background: var(--color-surface)',
      'border: 1px solid var(--color-border-ghost)',
      'padding: 32px',
      'color: var(--color-text-primary)',
      "font-family: 'Space Grotesk', sans-serif",
      'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5)',
    ].join(';');

    const l = localCounts || {};
    const c = cloudCounts || {};
    const n = (v) => (v == null ? 0 : v);

    card.innerHTML = `
      <h2 id="reconciliation-heading" style="
        font-family: 'Syne', sans-serif;
        font-weight: 700;
        font-size: 20px;
        text-transform: uppercase;
        letter-spacing: 0.01em;
        line-height: 1.2;
        margin: 0 0 16px;
        color: var(--color-text-primary);
      ">DATA ON BOTH SIDES</h2>

      <p id="reconciliation-body" style="
        font-family: 'Space Grotesk', sans-serif;
        font-size: 14px;
        font-weight: 400;
        line-height: 1.5;
        margin: 0 0 24px;
        color: var(--color-text-primary);
      ">Mila found data on both sides. Which should she keep?</p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <section aria-labelledby="reconciliation-local-heading">
          <div id="reconciliation-local-heading" style="
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            color: var(--color-text-muted);
            padding-bottom: 4px;
            border-bottom: 1px solid var(--color-border-ghost);
            margin-bottom: 8px;
          ">LOCAL</div>
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; color: var(--color-text-primary);">
            <div>${n(l.collection)} cards</div>
            <div>${n(l.decks)} decks</div>
            <div>${n(l.games)} games</div>
            <div>${n(l.watchlist)} watchlist</div>
          </div>
        </section>
        <section aria-labelledby="reconciliation-cloud-heading">
          <div id="reconciliation-cloud-heading" style="
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            color: var(--color-text-muted);
            padding-bottom: 4px;
            border-bottom: 1px solid var(--color-border-ghost);
            margin-bottom: 8px;
          ">HOUSEHOLD (CLOUD)</div>
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; color: var(--color-text-primary);">
            <div>${n(c.collection)} cards</div>
            <div>${n(c.decks)} decks</div>
            <div>${n(c.games)} games</div>
            <div>${n(c.watchlist)} watchlist</div>
          </div>
        </section>
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        <button type="button" data-choice="MERGE_EVERYTHING" style="
          height: 40px;
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
        ">MERGE EVERYTHING</button>

        <button type="button" data-choice="KEEP_LOCAL" style="
          height: 40px;
          background: var(--color-surface-hover);
          border: 1px solid var(--color-border-ghost);
          color: var(--color-text-primary);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
          transition: color 120ms ease-out;
        ">KEEP LOCAL</button>

        <button type="button" data-choice="KEEP_CLOUD" style="
          height: 40px;
          background: var(--color-surface-hover);
          border: 1px solid var(--color-border-ghost);
          color: var(--color-text-primary);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
          transition: color 120ms ease-out;
        ">KEEP CLOUD</button>
      </div>

      <p style="
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.15em;
        line-height: 1.5;
        color: var(--color-text-muted);
        margin: 24px 0 0;
      ">Merge uses last-write-wins by updated_at. The other two options replace one side entirely and are irreversible.</p>
    `;

    overlay.appendChild(card);

    // Hover effects (simple inline — reduced-motion block in main.css handles prefers-reduced-motion)
    const mergeBtn = card.querySelector('button[data-choice="MERGE_EVERYTHING"]');
    mergeBtn.addEventListener('mouseenter', () => {
      mergeBtn.style.boxShadow = '0 0 12px var(--color-glow-blue)';
    });
    mergeBtn.addEventListener('mouseleave', () => {
      mergeBtn.style.boxShadow = 'none';
    });

    const keepLocalBtn = card.querySelector('button[data-choice="KEEP_LOCAL"]');
    const keepCloudBtn = card.querySelector('button[data-choice="KEEP_CLOUD"]');
    [keepLocalBtn, keepCloudBtn].forEach((b) => {
      b.addEventListener('mouseenter', () => {
        b.style.color = 'var(--color-secondary)';
      });
      b.addEventListener('mouseleave', () => {
        b.style.color = 'var(--color-text-primary)';
      });
    });

    // D-04 LOCKDOWN: backdrop click blocked
    // Click handler on the overlay element — preventDefault() when the click
    // target IS the overlay (user clicked outside the card onto the backdrop).
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // D-04 LOCKDOWN: Escape key blocked via capture-phase listener.
    // Capture phase (third arg true) runs BEFORE any app-level bubble-phase
    // handlers, so no route-change or modal-close side effects fire.
    // Tab key is also handled here for focus trap inside the card.
    _activeKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'Tab') {
        const buttons = card.querySelectorAll('button[data-choice]');
        if (buttons.length === 0) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', _activeKeydownHandler, /* capture */ true);

    // Wire button clicks → in-progress state → onChoice → unmount
    const buttons = Array.from(card.querySelectorAll('button[data-choice]'));

    function _unmount() {
      if (_activeKeydownHandler) {
        document.removeEventListener('keydown', _activeKeydownHandler, /* capture */ true);
        _activeKeydownHandler = null;
      }
      if (_activeRoot && _activeRoot.parentNode) {
        _activeRoot.parentNode.removeChild(_activeRoot);
      }
      _activeRoot = null;
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const choice = btn.dataset.choice;

        // In-progress state — clicked button gets progress label, others disable
        const progressLabel = choice === 'MERGE_EVERYTHING' ? 'MERGING…'
          : choice === 'KEEP_LOCAL' ? 'KEEPING LOCAL…'
          : 'KEEPING CLOUD…';

        buttons.forEach((b) => {
          b.disabled = true;
          if (b === btn) {
            b.textContent = progressLabel;
            b.style.color = 'var(--color-text-muted)';
          } else {
            b.style.opacity = '0.5';
            b.style.cursor = 'not-allowed';
          }
        });

        try {
          await onChoice(choice);
        } catch (err) {
          // Error path — reset buttons, surface toast, stay mounted for retry.
          console.error('[reconciliation] onChoice failed:', err);
          const origLabels = {
            MERGE_EVERYTHING: 'MERGE EVERYTHING',
            KEEP_LOCAL: 'KEEP LOCAL',
            KEEP_CLOUD: 'KEEP CLOUD',
          };
          buttons.forEach((b) => {
            b.disabled = false;
            b.style.opacity = '1';
            b.style.cursor = 'pointer';
            b.textContent = origLabels[b.dataset.choice] || b.textContent;
            b.style.color = 'var(--color-text-primary)';
          });
          const toast = typeof window !== 'undefined' ? window.Alpine?.store?.('toast') : null;
          if (toast?.error) {
            toast.error('Reconciliation failed. Check your connection and try again.');
          } else if (toast?.show) {
            toast.show('Reconciliation failed. Check your connection and try again.', 'error');
          }
          return; // stay mounted
        }

        // Success — unmount and resolve the returned promise
        _unmount();
        resolve();
      });
    });

    mountRoot.appendChild(overlay);
    _activeRoot = overlay;

    // Autofocus MERGE EVERYTHING (the empathetic default — LWW preserves both sides).
    // setTimeout(0) ensures the element is fully attached before focus() fires.
    setTimeout(() => {
      const merge = card.querySelector('button[data-choice="MERGE_EVERYTHING"]');
      if (merge) merge.focus();
    }, 0);
  });
}

/**
 * Test-only reset — unmounts any live modal, clears module state.
 */
export function __resetReconciliationModal() {
  if (_activeKeydownHandler) {
    document.removeEventListener('keydown', _activeKeydownHandler, /* capture */ true);
    _activeKeydownHandler = null;
  }
  if (_activeRoot && _activeRoot.parentNode) {
    _activeRoot.parentNode.removeChild(_activeRoot);
  }
  _activeRoot = null;
}
