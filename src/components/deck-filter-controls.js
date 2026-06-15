// src/components/deck-filter-controls.js
// Shared deck-editor filter controls — used by the add panel (catalog search)
// and the centre panel (the in-deck 99) so both read identically.

/**
 * Create a labelled filter dropdown.
 */
export function createFilterDropdown(label, options, onChange) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; color: #7A8498;
  `;
  wrap.appendChild(labelEl);

  const select = document.createElement('select');
  select.style.cssText = `
    padding: 6px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.15em; background: #0B0C10;
    border: 1px solid #2A2D3A; color: #EAECEE; cursor: pointer;
  `;
  for (const opt of options) {
    const optEl = document.createElement('option');
    optEl.value = opt;
    optEl.textContent = opt.toUpperCase();
    select.appendChild(optEl);
  }
  select.addEventListener('change', () => onChange(select.value));
  wrap.appendChild(select);

  return wrap;
}

// Compact WUBRG+C multi-select pip row. `active` is a Set; toggling mutates a
// COPY passed to onChange (caller owns state). `allowed` optionally restricts
// which colours render (e.g. deck colour identity + 'C').
export function createColourPips(active, onChange, allowed = null) {
  const WUBRG = [
    { key: 'W', icon: 'ms ms-w ms-cost' }, { key: 'U', icon: 'ms ms-u ms-cost' },
    { key: 'B', icon: 'ms ms-b ms-cost' }, { key: 'R', icon: 'ms ms-r ms-cost' },
    { key: 'G', icon: 'ms ms-g ms-cost' }, { key: 'C', icon: 'ms ms-c ms-cost' },
  ];
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 4px; align-items: center;';
  for (const colour of WUBRG) {
    if (allowed && colour.key !== 'C' && !allowed.includes(colour.key)) continue;
    const btn = document.createElement('button');
    const on = active.has(colour.key);
    btn.type = 'button';
    btn.style.cssText = `width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid ${on ? '#0D52BD' : 'transparent'}; background: transparent; border-radius: 50%; opacity: ${on ? '1' : '0.4'}; transition: border-color 150ms, opacity 150ms;`;
    btn.innerHTML = `<i class="${colour.icon}" style="font-size: 18px;"></i>`;
    btn.addEventListener('click', () => {
      const next = new Set(active);
      if (next.has(colour.key)) next.delete(colour.key); else next.add(colour.key);
      onChange(next);
    });
    row.appendChild(btn);
  }
  return row;
}
