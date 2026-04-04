import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = resolve(import.meta.dirname, '..');

describe('Task 1: Project scaffold', () => {
  it('vite.config.js exports a valid Vite config with Tailwind plugin', () => {
    const content = readFileSync(resolve(root, 'vite.config.js'), 'utf-8');
    expect(content).toContain('tailwindcss()');
    expect(content).toContain("import { defineConfig } from 'vite'");
    expect(content).toContain("import tailwindcss from '@tailwindcss/vite'");
  });

  it('main.css contains all 13 colour custom properties from the palette', () => {
    const content = readFileSync(resolve(root, 'src/styles/main.css'), 'utf-8');
    const colours = [
      '--color-primary: #0D52BD',
      '--color-secondary: #E23838',
      '--color-background: #0B0C10',
      '--color-surface: #14161C',
      '--color-surface-hover: #1C1F28',
      '--color-border-ghost: #2A2D3A',
      '--color-text-primary: #EAECEE',
      '--color-text-muted: #7A8498',
      '--color-text-dim: #4A5064',
      '--color-success: #2ECC71',
      '--color-warning: #F39C12',
      '--color-glow-blue',
      '--color-glow-red',
    ];
    for (const colour of colours) {
      expect(content).toContain(colour);
    }
  });

  it('font files exist in src/styles/fonts/ directory', () => {
    const fontsDir = resolve(root, 'src/styles/fonts');
    expect(existsSync(resolve(fontsDir, 'Syne-Variable.woff2'))).toBe(true);
    expect(existsSync(resolve(fontsDir, 'SpaceGrotesk-Variable.woff2'))).toBe(true);
    expect(existsSync(resolve(fontsDir, 'JetBrainsMono-Variable.woff2'))).toBe(true);
    expect(existsSync(resolve(fontsDir, 'CrimsonPro-Variable.woff2'))).toBe(true);
  });

  it('main.css contains 0px border radius for Organic Brutalism', () => {
    const content = readFileSync(resolve(root, 'src/styles/main.css'), 'utf-8');
    expect(content).toContain('--radius-DEFAULT: 0px');
  });

  it('main.css contains 4 @font-face blocks', () => {
    const content = readFileSync(resolve(root, 'src/styles/main.css'), 'utf-8');
    expect(content).toContain("font-family: 'Syne'");
    expect(content).toContain("font-family: 'Space Grotesk'");
    expect(content).toContain("font-family: 'JetBrains Mono'");
    expect(content).toContain("font-family: 'Crimson Pro'");
  });

  it('main.css contains 4 font family theme tokens', () => {
    const content = readFileSync(resolve(root, 'src/styles/main.css'), 'utf-8');
    expect(content).toContain("--font-header: 'Syne'");
    expect(content).toContain("--font-body: 'Space Grotesk'");
    expect(content).toContain("--font-mono: 'JetBrains Mono'");
    expect(content).toContain("--font-serif: 'Crimson Pro'");
  });

  it('utilities.css contains all custom utility classes', () => {
    const content = readFileSync(resolve(root, 'src/styles/utilities.css'), 'utf-8');
    expect(content).toContain('.ghost-border');
    expect(content).toContain('.mono-data');
    expect(content).toContain('.syne-header');
    expect(content).toContain('.glass-overlay');
    expect(content).toContain('.aether-glow');
    expect(content).toContain('.scanline');
  });

  it('index.html does NOT contain any Google Fonts CDN links', () => {
    const content = readFileSync(resolve(root, 'index.html'), 'utf-8');
    expect(content).not.toContain('fonts.googleapis.com');
    expect(content).not.toContain('fonts.gstatic.com');
  });

  it('main.js imports material-symbols from node_modules', () => {
    const content = readFileSync(resolve(root, 'src/main.js'), 'utf-8');
    expect(content).toContain("material-symbols");
  });
});
