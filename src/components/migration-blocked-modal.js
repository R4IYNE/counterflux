/**
 * Blocking migration modal (Phase 7 Plan 3 — D-15).
 *
 * Rendered as a plain DOM overlay by src/services/migration.js in response to
 * `db.on('blocked')` — another tab is holding an old Dexie connection and is
 * preventing the upgrade from proceeding. The modal is NOT dismissible — it
 * auto-removes when the caller invokes hideBlockingModal(), which the
 * orchestrator does from `db.on('ready')`.
 *
 * Alpine may not yet be initialized when the modal is shown (migration runs
 * before Alpine.start), so this deliberately uses vanilla DOM rather than
 * Alpine x-data.
 */
let modalEl = null;

export function showBlockingModal({ title, body }) {
  if (modalEl) return;
  modalEl = document.createElement('div');
  modalEl.id = 'cf-migration-blocked-modal';
  modalEl.style.cssText =
    'position:fixed;inset:0;background:rgba(11,12,16,0.95);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:"Space Grotesk",system-ui,sans-serif;color:#E8E6E3;';

  const card = document.createElement('div');
  card.style.cssText =
    'max-width:440px;padding:32px;background:#14161C;border:1px solid #2A2D3A;border-radius:8px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

  const h2 = document.createElement('h2');
  h2.style.cssText = 'font-size:20px;font-weight:700;margin:0 0 16px 0;';
  h2.textContent = title;

  const p = document.createElement('p');
  p.style.cssText = 'font-size:14px;line-height:1.5;color:#8A8F98;margin:0;';
  p.textContent = body;

  card.appendChild(h2);
  card.appendChild(p);
  modalEl.appendChild(card);
  document.body.appendChild(modalEl);
}

export function hideBlockingModal() {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
}

/** Internal helper for tests — returns current modal element (or null). */
export function __getBlockingModalEl() {
  return modalEl;
}
