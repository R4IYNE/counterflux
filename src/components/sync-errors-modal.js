// src/components/sync-errors-modal.js
//
// Phase 11 Plan 3 — Sync-errors modal (D-09, D-10). Dismissible modal.
// Mirrors settings-modal.js dismissibility pattern (Escape + X + backdrop close).
//
// API:
//   openSyncErrorsModal() — opens modal; reads rows from db.sync_conflicts
//     sorted descending by detected_at; per-row RETRY + DISCARD invoke
//     Alpine.store('sync').retry(id) / .discard(id). Empty state renders
//     'ALL CAUGHT UP' block.
//   closeSyncErrorsModal() — explicit close.
//
// Copy (UI-SPEC §Copywriting Contract — exact strings):
//   Heading: 'SYNC ERRORS'
//   Body summary: '{N} changes failed to sync. Retry or discard each.'
//     singular: '1 change failed to sync. Retry or discard it.'
//   Row format: table_name (14/400) / {HH:MM:SS} · {error_classification} (11/mono/400/muted)
//   Actions: 'RETRY' / 'DISCARD'; in-progress: 'RETRYING…' / 'DISCARDING…'
//   Bottom CLOSE button: 'CLOSE'
//   Empty state: 'ALL CAUGHT UP' / "Mila hasn't found any sync errors to review."
//
// Error classification mapping (D-10):
//   400 → 'Invalid data'
//   401 → 'Signed out'
//   403 → 'RLS rejected'
//   409 → 'Row conflict'
//   422 → '422 constraint'
//   network → 'Network failure'

import { db } from '../db/schema.js';

const MOUNT_ROOT_ID = 'cf-sync-errors-root';

const ERROR_CLASSIFICATION = {
  '400': 'Invalid data',
  '401': 'Signed out',
  '403': 'RLS rejected',
  '409': 'Row conflict',
  '422': '422 constraint',
  network: 'Network failure',
};

function classifyErrorCode(code) {
  if (code == null) return 'Unknown error';
  const s = String(code);
  if (ERROR_CLASSIFICATION[s]) return ERROR_CLASSIFICATION[s];
  if (/network|fetch|timeout|offline/i.test(s)) return 'Network failure';
  return 'Unknown error';
}

function _escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function _formatTime(ts) {
  try {
    return new Date(ts).toTimeString().slice(0, 8);
  } catch {
    return '';
  }
}

let _activeKeydownHandler = null;
let _activeRoot = null;

/**
 * Opens the sync-errors modal. Reads rows from db.sync_conflicts sorted
 * descending by detected_at; renders empty-state 'ALL CAUGHT UP' block
 * when empty.
 */
export async function openSyncErrorsModal() {
  if (_activeRoot) return; // already open
  const mountRoot = document.getElementById(MOUNT_ROOT_ID) || document.body;

  // Read rows newest-first
  let rows = [];
  try {
    rows = await db.sync_conflicts.orderBy('detected_at').reverse().toArray();
  } catch (err) {
    console.error('[sync-errors-modal] failed to read sync_conflicts:', err);
    rows = [];
  }

  const overlay = document.createElement('div');
  overlay.id = 'cf-sync-errors-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'sync-errors-heading');
  overlay.style.cssText = [
    'position: fixed',
    'inset: 0',
    'background: rgba(11, 12, 16, 0.85)',
    'z-index: 60',
    'display: flex',
    'align-items: center',
    'justify-content: center',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'width: 520px',
    'max-width: 92vw',
    'max-height: 80vh',
    'overflow-y: auto',
    'background: var(--color-surface)',
    'border: 1px solid var(--color-border-ghost)',
    'padding: 32px',
    'color: var(--color-text-primary)',
    "font-family: 'Space Grotesk', sans-serif",
    'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5)',
  ].join(';');

  const n = rows.length;
  const summaryCopy = n === 0 ? ''
    : n === 1 ? '1 change failed to sync. Retry or discard it.'
    : `${n} changes failed to sync. Retry or discard each.`;

  const headerHtml = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--color-secondary);
      margin-bottom: 24px;
    ">
      <h2 id="sync-errors-heading" style="
        font-family: 'Syne', sans-serif;
        font-weight: 700;
        font-size: 20px;
        letter-spacing: 0.01em;
        text-transform: uppercase;
        margin: 0;
        color: var(--color-text-primary);
      ">SYNC ERRORS</h2>
      <button
        type="button"
        data-close="true"
        aria-label="Close sync errors"
        style="
          width: 32px; height: 32px;
          background: none; border: none;
          cursor: pointer;
          color: var(--color-text-muted);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; line-height: 1;
        "
      >
        <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
      </button>
    </div>
  `;

  if (n === 0) {
    // Empty state — ALL CAUGHT UP
    card.innerHTML = `
      ${headerHtml}
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 48px 0;
      ">
        <span class="material-symbols-outlined" style="font-size: 48px; color: var(--color-success);">check_circle</span>
        <div style="
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 20px;
          letter-spacing: 0.01em;
          text-transform: uppercase;
          color: var(--color-text-primary);
        ">ALL CAUGHT UP</div>
        <div style="
          font-size: 14px;
          color: var(--color-text-muted);
          text-align: center;
          max-width: 360px;
        ">Mila hasn't found any sync errors to review.</div>
      </div>
      <button
        type="button"
        data-close="true"
        style="
          height: 40px;
          width: 100%;
          background: var(--color-surface-hover);
          border: 1px solid var(--color-border-ghost);
          color: var(--color-text-primary);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
          margin-top: 24px;
        "
      >CLOSE</button>
    `;
  } else {
    // Populated row list
    const rowsHtml = rows.map((r) => {
      const ts = _formatTime(r.detected_at);
      const label = classifyErrorCode(r.error_code);
      return `
        <li
          data-row-id="${_escape(r.id)}"
          aria-label="${_escape(r.table_name)} ${_escape(r.op || '')}, failed ${_escape(ts)}, ${_escape(label)}"
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            min-height: 56px;
            padding: 16px;
            background: var(--color-surface);
            border-bottom: 1px solid var(--color-border-ghost);
          "
        >
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="font-size: 14px; font-weight: 400; color: var(--color-text-primary);">${_escape(r.table_name)}</div>
            <div style="
              font-family: 'JetBrains Mono', monospace;
              font-size: 11px;
              font-weight: 400;
              color: var(--color-text-muted);
            ">${_escape(ts)} · ${_escape(label)}</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; justify-content: center;">
            <button
              type="button"
              data-action="retry"
              data-id="${_escape(r.id)}"
              style="
                height: 32px; width: 72px;
                background: transparent;
                border: 1px solid var(--color-border-ghost);
                color: var(--color-primary);
                font-family: 'JetBrains Mono', monospace;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.15em;
                text-transform: uppercase;
                cursor: pointer;
                transition: box-shadow 120ms ease-out, background 120ms ease-out;
              "
            >RETRY</button>
            <button
              type="button"
              data-action="discard"
              data-id="${_escape(r.id)}"
              style="
                height: 32px; width: 72px;
                background: var(--color-surface-hover);
                border: 1px solid var(--color-border-ghost);
                color: var(--color-text-primary);
                font-family: 'JetBrains Mono', monospace;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.15em;
                text-transform: uppercase;
                cursor: pointer;
                transition: color 120ms ease-out, box-shadow 120ms ease-out;
              "
            >DISCARD</button>
          </div>
        </li>
      `;
    }).join('');

    // Phase 14.07 — bulk RETRY ALL / DISCARD ALL row.
    // Per-row UI is unusable when sync_conflicts has hundreds of entries
    // (real case during 14-05 UAT: 848 dead-letters from the column-drift era).
    // Bulk RETRY iterates Alpine.store('sync').retry(id); bulk DISCARD ALL
    // first prompts a native confirm() because it's irreversible.
    const bulkBarHtml = n > 1 ? `
      <div style="
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin: 0 0 12px;
      ">
        <button
          type="button"
          data-bulk-action="retry-all"
          style="
            height: 32px;
            padding: 0 12px;
            background: transparent;
            border: 1px solid var(--color-border-ghost);
            color: var(--color-primary);
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            cursor: pointer;
            transition: box-shadow 120ms ease-out, background 120ms ease-out;
          "
        >RETRY ALL (${n})</button>
        <button
          type="button"
          data-bulk-action="discard-all"
          style="
            height: 32px;
            padding: 0 12px;
            background: var(--color-surface-hover);
            border: 1px solid var(--color-border-ghost);
            color: var(--color-text-primary);
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            cursor: pointer;
            transition: color 120ms ease-out, box-shadow 120ms ease-out;
          "
        >DISCARD ALL</button>
      </div>
    ` : '';

    card.innerHTML = `
      ${headerHtml}
      <p aria-live="polite" style="
        font-size: 14px;
        font-weight: 400;
        color: var(--color-text-primary);
        margin: 0 0 16px;
      ">${_escape(summaryCopy)}</p>
      ${bulkBarHtml}
      <ul role="list" style="list-style: none; padding: 0; margin: 0 0 24px;">
        ${rowsHtml}
      </ul>
      <button
        type="button"
        data-close="true"
        style="
          height: 40px;
          width: 100%;
          background: var(--color-surface-hover);
          border: 1px solid var(--color-border-ghost);
          color: var(--color-text-primary);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
        "
      >CLOSE</button>
    `;
  }

  overlay.appendChild(card);

  // Hover affordances
  card.querySelectorAll('button[data-action="retry"]').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      btn.style.boxShadow = '0 0 8px var(--color-glow-blue)';
      btn.style.background = 'var(--color-surface-hover)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.boxShadow = 'none';
      btn.style.background = 'transparent';
    });
  });
  card.querySelectorAll('button[data-action="discard"]').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      btn.style.color = 'var(--color-secondary)';
      btn.style.boxShadow = '0 0 8px var(--color-glow-red)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.color = 'var(--color-text-primary)';
      btn.style.boxShadow = 'none';
    });
  });

  // Phase 14.07 — bulk RETRY ALL / DISCARD ALL hover affordances + handlers.
  card.querySelectorAll('button[data-bulk-action="retry-all"]').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      btn.style.boxShadow = '0 0 8px var(--color-glow-blue)';
      btn.style.background = 'var(--color-surface-hover)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.boxShadow = 'none';
      btn.style.background = 'transparent';
    });
  });
  card.querySelectorAll('button[data-bulk-action="discard-all"]').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      btn.style.color = 'var(--color-secondary)';
      btn.style.boxShadow = '0 0 8px var(--color-glow-red)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.color = 'var(--color-text-primary)';
      btn.style.boxShadow = 'none';
    });
  });

  card.querySelectorAll('button[data-bulk-action]').forEach((bulkBtn) => {
    bulkBtn.addEventListener('click', async () => {
      const action = bulkBtn.dataset.bulkAction; // 'retry-all' | 'discard-all'
      const allRows = Array.from(card.querySelectorAll('li[data-row-id]'));
      if (allRows.length === 0) return;

      // Irreversible — confirm before discarding all
      if (action === 'discard-all') {
        const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(`Discard ${allRows.length} sync errors? This cannot be undone.`)
          : true;
        if (!ok) return;
      }

      const store = typeof window !== 'undefined' ? window.Alpine?.store?.('sync') : null;
      if (!store) {
        console.warn('[sync-errors-modal] Alpine.store(sync) not available');
        return;
      }

      // Disable bulk + per-row buttons; swap label
      const allBulk = card.querySelectorAll('button[data-bulk-action]');
      const allRowBtns = card.querySelectorAll('button[data-action]');
      allBulk.forEach((b) => { b.disabled = true; });
      allRowBtns.forEach((b) => { b.disabled = true; });
      const origLabel = bulkBtn.textContent;
      bulkBtn.textContent = action === 'retry-all'
        ? `RETRYING ${allRows.length}…`
        : `DISCARDING ${allRows.length}…`;
      bulkBtn.style.color = 'var(--color-text-muted)';

      const op = action === 'retry-all' ? 'retry' : 'discard';
      let succeeded = 0;
      let failed = 0;
      // Sequential — Phase 11 sync engine push is FK-safe per PUSH_ORDER and
      // does its own batching; serialising here keeps queue+conflicts state
      // observable per-row and avoids overwhelming Supabase with parallel
      // requests if backlog is large.
      for (const row of allRows) {
        const rawId = row.dataset.rowId;
        const id = /^\d+$/.test(rawId) ? Number(rawId) : rawId;
        try {
          if (op === 'retry') await store.retry(id); else await store.discard(id);
          row.style.transition = 'opacity 120ms ease-out';
          row.style.opacity = '0';
          succeeded += 1;
        } catch (err) {
          console.error(`[sync-errors-modal] bulk ${op} failed for ${id}:`, err);
          failed += 1;
        }
      }

      // Reap faded rows; auto-close if list empty
      setTimeout(() => {
        card.querySelectorAll('li[data-row-id]').forEach((row) => {
          if (row.style.opacity === '0') row.remove();
        });
        const remaining = card.querySelectorAll('li[data-row-id]').length;

        const toast = window.Alpine?.store?.('toast');
        if (toast) {
          if (failed === 0) {
            toast.info?.(action === 'retry-all'
              ? `Retried ${succeeded} change${succeeded === 1 ? '' : 's'}.`
              : `Discarded ${succeeded} change${succeeded === 1 ? '' : 's'}.`);
          } else {
            (toast.warning || toast.error || toast.info)?.(
              `${succeeded} ${op === 'retry' ? 'retried' : 'discarded'}, ${failed} still pending.`
            );
          }
        }

        if (remaining === 0) {
          setTimeout(closeModal, 250);
        } else {
          // Some rows still failed — re-enable and reset label so user can act on the remainder
          allBulk.forEach((b) => { b.disabled = false; });
          card.querySelectorAll('li[data-row-id] button[data-action]').forEach((b) => { b.disabled = false; });
          bulkBtn.textContent = origLabel.replace(/\(\d+\)/, `(${remaining})`);
          bulkBtn.style.color = action === 'retry-all' ? 'var(--color-primary)' : 'var(--color-text-primary)';
        }
      }, 200);
    });
  });

  // --- Close paths (Escape + backdrop + X + CLOSE button) ---
  function closeModal() {
    if (_activeKeydownHandler) {
      document.removeEventListener('keydown', _activeKeydownHandler);
      _activeKeydownHandler = null;
    }
    if (_activeRoot && _activeRoot.parentNode) {
      _activeRoot.parentNode.removeChild(_activeRoot);
    }
    _activeRoot = null;
  }

  _activeKeydownHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };
  document.addEventListener('keydown', _activeKeydownHandler);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  card.querySelectorAll('[data-close="true"]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });

  // --- Row RETRY / DISCARD → Alpine.store('sync').retry / discard ---
  card.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const rawId = btn.dataset.id;
      // Dexie numeric IDs arrive as strings via dataset; coerce to Number for
      // symmetry with rows[].id. The caller (sync store) can accept either —
      // matching by Number is the correct affordance.
      const id = /^\d+$/.test(rawId) ? Number(rawId) : rawId;

      const store = typeof window !== 'undefined' ? window.Alpine?.store?.('sync') : null;
      if (!store) {
        console.warn('[sync-errors-modal] Alpine.store(sync) not available');
        return;
      }

      // In-progress state — button label swaps, both buttons disable for this row
      const row = btn.closest('li');
      const siblingAction = action === 'retry' ? 'discard' : 'retry';
      const siblingBtn = row?.querySelector(`button[data-action="${siblingAction}"]`);

      btn.disabled = true;
      if (siblingBtn) siblingBtn.disabled = true;
      const origLabel = btn.textContent;
      btn.textContent = action === 'retry' ? 'RETRYING…' : 'DISCARDING…';
      btn.style.color = 'var(--color-text-muted)';

      try {
        if (action === 'retry') {
          await store.retry(id);
        } else {
          await store.discard(id);
        }

        // Fade row out; if last remaining row, auto-close modal
        if (row) {
          row.style.transition = 'opacity 200ms ease-out';
          row.style.opacity = '0';
          setTimeout(() => {
            row.remove();
            const remaining = card.querySelectorAll('li').length;
            if (remaining === 0) {
              setTimeout(closeModal, 250);
            }
          }, 200);
        }

        // Inform the user via the toast bus (optional; Alpine.store('toast') may be absent in tests)
        const toast = window.Alpine?.store?.('toast');
        if (toast) {
          if (action === 'retry') {
            toast.info?.('Change retried.');
          } else {
            toast.info?.('Change discarded.');
          }
        }
      } catch (err) {
        console.error(`[sync-errors-modal] ${action} failed:`, err);
        btn.disabled = false;
        if (siblingBtn) siblingBtn.disabled = false;
        btn.textContent = origLabel;
        btn.style.color = action === 'retry' ? 'var(--color-primary)' : 'var(--color-text-primary)';

        const toast = window.Alpine?.store?.('toast');
        if (toast?.error) {
          toast.error(action === 'retry'
            ? "Still couldn't sync. Try again later or discard."
            : "Couldn't discard. Try again.");
        }
      }
    });
  });

  mountRoot.appendChild(overlay);
  _activeRoot = overlay;

  // Autofocus X close (non-consequential landing per UI-SPEC §Accessibility)
  setTimeout(() => {
    const closeBtn = card.querySelector('button[data-close="true"]');
    if (closeBtn) closeBtn.focus();
  }, 0);
}

export function closeSyncErrorsModal() {
  if (_activeKeydownHandler) {
    document.removeEventListener('keydown', _activeKeydownHandler);
    _activeKeydownHandler = null;
  }
  if (_activeRoot && _activeRoot.parentNode) {
    _activeRoot.parentNode.removeChild(_activeRoot);
  }
  _activeRoot = null;
}

/** Test-only — clears any live modal + resets module state. */
export function __resetSyncErrorsModal() {
  closeSyncErrorsModal();
}
