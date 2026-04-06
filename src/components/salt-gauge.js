/**
 * Salt score gauge component.
 * Renders a horizontal bar gauge (0-10 scale) with colour coding:
 * green (MILD 0-3), amber (SPICY 4-6), red (CRITICAL 7-10).
 * Replaces the Phase 4 placeholder in the analytics sidebar.
 */

const LABEL_400 = "font: 400 11px/1.3 'JetBrains Mono', monospace; letter-spacing: 0.15em; text-transform: uppercase;";

/**
 * Render the salt score gauge into a container element.
 * @param {HTMLElement} container - Target element (cleared on each call)
 * @param {number|null} saltScore - Normalized 0-10 salt score
 * @param {string} saltLabel - 'MILD' | 'SPICY' | 'CRITICAL' | ''
 * @param {boolean} isLoading - Whether EDHREC data is still loading
 * @param {boolean} hasError - Whether EDHREC fetch failed
 */
export function renderSaltGauge(container, saltScore, saltLabel, isLoading, hasError) {
  container.innerHTML = '';

  // Loading state
  if (isLoading) {
    const el = document.createElement('div');
    el.style.cssText = `${LABEL_400} color: #7A8498;`;
    el.textContent = 'SALT: LOADING...';
    container.appendChild(el);
    return;
  }

  // Error state
  if (hasError) {
    const el = document.createElement('div');
    el.style.cssText = `${LABEL_400} color: #4A5064;`;
    el.textContent = 'SALT: N/A -- EDHREC UNAVAILABLE';
    container.appendChild(el);
    return;
  }

  // No data state
  if (saltScore === null || saltScore === undefined) {
    const el = document.createElement('div');
    el.style.cssText = `${LABEL_400} color: #4A5064;`;
    el.textContent = 'SALT: N/A';
    container.appendChild(el);
    return;
  }

  // Determine colour based on score range
  const color = saltScore <= 3 ? '#2ECC71' : saltScore <= 6 ? '#F39C12' : '#E23838';

  // Score text (heading tier: Syne 20px 700)
  const scoreEl = document.createElement('div');
  scoreEl.style.cssText = `font: 700 20px/1.2 'Syne', sans-serif; letter-spacing: 0.01em; color: ${color};`;
  scoreEl.textContent = `SALT: ${saltScore}/10 ${saltLabel}`;
  container.appendChild(scoreEl);

  // Bar gauge
  const bar = document.createElement('div');
  bar.className = 'salt-bar';
  bar.style.marginTop = '8px';

  const fill = document.createElement('div');
  fill.className = 'salt-fill';
  fill.style.cssText = `width: ${saltScore * 10}%; background: ${color};`;
  bar.appendChild(fill);

  container.appendChild(bar);
}
