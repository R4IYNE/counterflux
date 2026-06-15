// Phase 17 (v1.3) — deckgen-prompt unit tests.
//
// The system prompt is stable text (and cached aggressively by Anthropic),
// so we don't snapshot its full content — just assert the load-bearing
// pieces are there. The per-request user prompt builder gets more thorough
// coverage since its shape varies by mode + inputs.

import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
} from '../src/services/deckgen-prompt.js';

describe('SYSTEM_PROMPT', () => {
  it('opens with the deck-building assistant persona', () => {
    expect(SYSTEM_PROMPT).toMatch(/deck-building assistant/i);
  });

  it('includes the power-level rubric', () => {
    expect(SYSTEM_PROMPT).toMatch(/Casual/i);
    expect(SYSTEM_PROMPT).toMatch(/Focused/i);
    expect(SYSTEM_PROMPT).toMatch(/Optimized/i);
    expect(SYSTEM_PROMPT).toMatch(/cEDH/i);
  });

  it('defines all role buckets', () => {
    expect(SYSTEM_PROMPT).toMatch(/\bLAND\b/);
    expect(SYSTEM_PROMPT).toMatch(/\bRAMP\b/);
    expect(SYSTEM_PROMPT).toMatch(/\bDRAW\b/);
    expect(SYSTEM_PROMPT).toMatch(/\bREMOVAL_SINGLE\b/);
    expect(SYSTEM_PROMPT).toMatch(/\bREMOVAL_SWEEP\b/);
    expect(SYSTEM_PROMPT).toMatch(/\bWIN_CON\b/);
    expect(SYSTEM_PROMPT).toMatch(/\bSUPPORT\b/);
  });

  it('forbids recommending out-of-pool cards', () => {
    expect(SYSTEM_PROMPT).toMatch(/MUST appear in the candidate pool/i);
  });

  it('demands strict JSON output', () => {
    expect(SYSTEM_PROMPT).toMatch(/STRICT JSON/);
  });
});

describe('buildUserPrompt', () => {
  const commander = {
    name: 'Brago, King Eternal',
    color_identity: ['W', 'U'],
    type_line: 'Legendary Creature — Spirit',
    oracle_text: 'Whenever Brago deals combat damage to a player, exile any number of target nonland permanents.',
  };
  const candidates = [
    { scryfall_id: 'c1', name: 'Sol Ring', cmc: 1, mana_cost: '{1}', type_line: 'Artifact', color_identity: [], synergy_score: 0.95 },
    { scryfall_id: 'c2', name: 'Brainstorm', cmc: 1, mana_cost: '{U}', type_line: 'Instant', color_identity: ['U'], synergy_score: 0.88 },
  ];

  it('includes the commander name and identity', () => {
    const prompt = buildUserPrompt({
      commander, candidates, partial: [], powerLevel: 5, mode: 'build', archetypeHint: '',
    });
    expect(prompt).toContain('Brago, King Eternal');
    expect(prompt).toContain('WU');
  });

  it('includes the power level', () => {
    const prompt = buildUserPrompt({
      commander, candidates, partial: [], powerLevel: 7, mode: 'build', archetypeHint: '',
    });
    expect(prompt).toContain('## Target power level\n7');
  });

  it('renders mode-specific guidance for build mode', () => {
    const prompt = buildUserPrompt({
      commander, candidates, partial: [], powerLevel: 5, mode: 'build', archetypeHint: '',
    });
    expect(prompt).toMatch(/full 99-card list/i);
  });

  it('renders mode-specific guidance for fill mode', () => {
    const prompt = buildUserPrompt({
      commander, candidates,
      partial: [{ scryfall_id: 'p1', name: 'Counterspell' }],
      powerLevel: 5, mode: 'fill', archetypeHint: '',
    });
    expect(prompt).toMatch(/'fill'/);
    expect(prompt).toMatch(/recommend exactly \d+ cards/i);
  });

  it('renders mode-specific guidance for upgrade mode with swap_out', () => {
    const prompt = buildUserPrompt({
      commander, candidates, partial: [],
      powerLevel: 5, mode: 'upgrade', archetypeHint: '',
    });
    expect(prompt).toMatch(/swap_out/);
  });

  it('renders mode-specific guidance for retune mode', () => {
    const prompt = buildUserPrompt({
      commander, candidates, partial: [],
      powerLevel: 5, mode: 'retune', archetypeHint: '',
    });
    expect(prompt).toMatch(/retune/i);
    expect(prompt).toMatch(/Cap at 15 swaps/i);
  });

  it('includes archetype hint when provided', () => {
    const prompt = buildUserPrompt({
      commander, candidates, partial: [],
      powerLevel: 5, mode: 'build', archetypeHint: 'blink stax',
    });
    expect(prompt).toContain('blink stax');
  });

  it('omits archetype section when empty', () => {
    const prompt = buildUserPrompt({
      commander, candidates, partial: [],
      powerLevel: 5, mode: 'build', archetypeHint: '',
    });
    expect(prompt).not.toContain('## Archetype hint');
  });

  it('includes the partial deck list when provided', () => {
    const prompt = buildUserPrompt({
      commander, candidates,
      partial: [
        { scryfall_id: 'p1', name: 'Counterspell' },
        { scryfall_id: 'p2', name: 'Swords to Plowshares' },
      ],
      powerLevel: 5, mode: 'fill', archetypeHint: '',
    });
    expect(prompt).toContain('Counterspell');
    expect(prompt).toContain('Swords to Plowshares');
    expect(prompt).toContain('Cards already in the deck (2)');
  });

  it('renders every candidate with id and metadata', () => {
    const prompt = buildUserPrompt({
      commander, candidates, partial: [],
      powerLevel: 5, mode: 'build', archetypeHint: '',
    });
    expect(prompt).toContain('[c1] Sol Ring');
    expect(prompt).toContain('[c2] Brainstorm');
    expect(prompt).toContain('CMC 1');
  });

  it('shows candidate count in section header', () => {
    const prompt = buildUserPrompt({
      commander, candidates, partial: [],
      powerLevel: 5, mode: 'build', archetypeHint: '',
    });
    expect(prompt).toMatch(/Candidate pool \(2 cards/);
  });

  it('ends with the "return JSON now" trigger', () => {
    const prompt = buildUserPrompt({
      commander, candidates, partial: [],
      powerLevel: 5, mode: 'build', archetypeHint: '',
    });
    expect(prompt.trim()).toMatch(/Return the JSON now\.$/);
  });
});
