/**
 * Shared Scryfall precon mock data for Plan 3 tests.
 *
 * `mockSetsResponse` — mirrors Scryfall's /sets response shape with 5 precon
 * rows (3 commander + 2 duel_deck) PLUS 3 non-precon rows that tests assert
 * are filtered out per D-09 (expansion, core, starter).
 *
 * `mockDecklistPages(setCode)` — returns a single-page search response per
 * the Scryfall cards/search contract (unique=prints). The 'cmm' code returns
 * 100 cards including ≥1 Legendary Creature to exercise the is_commander
 * heuristic (Pitfall 5).
 *
 * `makeMockFetch()` — a fetch() replacement that returns the right mock
 * payload based on the URL pattern (suitable for vi.stubGlobal('fetch', ...)).
 */

export const mockSetsResponse = {
  object: 'list',
  has_more: false,
  data: [
    // 3 commander precons (commander set_type)
    {
      code: 'cmm',
      name: 'Commander Masters',
      set_type: 'commander',
      released_at: '2023-08-04',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/cmm.svg',
      search_uri: 'https://api.scryfall.com/cards/search?q=set%3Acmm&unique=prints',
    },
    {
      code: 'woc',
      name: 'Wilds of Eldraine Commander',
      set_type: 'commander',
      released_at: '2023-09-08',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/woc.svg',
      search_uri: 'https://api.scryfall.com/cards/search?q=set%3Awoc&unique=prints',
    },
    {
      code: 'ltc',
      name: 'Tales of Middle-earth Commander',
      set_type: 'commander',
      released_at: '2023-06-23',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/ltc.svg',
      search_uri: 'https://api.scryfall.com/cards/search?q=set%3Altc&unique=prints',
    },

    // 2 duel_deck precons (duel_deck set_type)
    {
      code: 'dd2',
      name: 'Duel Decks: Jace vs. Chandra',
      set_type: 'duel_deck',
      released_at: '2008-11-07',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/dd2.svg',
      search_uri: 'https://api.scryfall.com/cards/search?q=set%3Add2&unique=prints',
    },
    {
      code: 'ddu',
      name: 'Duel Decks: Elves vs. Inventors',
      set_type: 'duel_deck',
      released_at: '2018-04-06',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/ddu.svg',
      search_uri: 'https://api.scryfall.com/cards/search?q=set%3Addu&unique=prints',
    },

    // Non-precons that MUST be filtered out per D-09:
    {
      code: 'woe',
      name: 'Wilds of Eldraine',
      set_type: 'expansion',
      released_at: '2023-09-08',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/woe.svg',
      search_uri: 'https://api.scryfall.com/cards/search?q=set%3Awoe&unique=prints',
    },
    {
      code: 'm21',
      name: 'Core Set 2021',
      set_type: 'core',
      released_at: '2020-07-03',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/m21.svg',
      search_uri: 'https://api.scryfall.com/cards/search?q=set%3Am21&unique=prints',
    },
    {
      code: 'w17',
      name: 'Welcome Deck 2017',
      set_type: 'starter',
      released_at: '2017-04-15',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/w17.svg',
      search_uri: 'https://api.scryfall.com/cards/search?q=set%3Aw17&unique=prints',
    },
  ],
};

export function mockDecklistPages(setCode) {
  if (setCode === 'cmm') {
    const cards = [];
    // 1 legendary creature (is_commander heuristic should flag this)
    cards.push({
      id: 'cmm-001',
      name: 'Sliver Gravemother',
      type_line: 'Legendary Creature — Sliver',
      games: ['paper'],
      prices: { eur: '2.40' },
    });
    // 98 non-legendary cards
    for (let i = 2; i <= 99; i++) {
      cards.push({
        id: `cmm-${String(i).padStart(3, '0')}`,
        name: `Card ${i}`,
        type_line: 'Creature — Beast',
        games: ['paper'],
        prices: { eur: '0.10' },
      });
    }
    return [{ data: cards, has_more: false }];
  }
  if (setCode === 'woc') {
    // Two-page paginated response to exercise the accumulator
    return [
      {
        data: [
          {
            id: 'woc-001',
            name: 'Faerie Mastermind',
            type_line: 'Legendary Creature — Faerie Rogue',
            games: ['paper'],
            prices: { eur: '1.00' },
          },
          {
            id: 'woc-002',
            name: 'Card A',
            type_line: 'Creature',
            games: ['paper'],
            prices: { eur: '0.25' },
          },
        ],
        has_more: true,
        next_page: 'https://api.scryfall.com/cards/search?q=set%3Awoc&unique=prints&page=2',
      },
      {
        data: [
          {
            id: 'woc-003',
            name: 'Card B',
            type_line: 'Instant',
            games: ['paper'],
            prices: { eur: '0.20' },
          },
        ],
        has_more: false,
      },
    ];
  }
  // Everything else: empty
  return [{ data: [], has_more: false }];
}

export function makeMockFetch() {
  // Track per-URL page index so multi-page sets advance through the pages array
  const pageIndex = new Map();
  return async (url) => {
    if (url === 'https://api.scryfall.com/sets') {
      return {
        ok: true,
        status: 200,
        json: async () => mockSetsResponse,
      };
    }
    const setMatch = url.match(/set%3A(\w+)/);
    if (setMatch) {
      const setCode = setMatch[1];
      const pageKey = url; // distinct per-page url from next_page
      const pages = mockDecklistPages(setCode);
      if (!pageIndex.has(setCode)) pageIndex.set(setCode, 0);
      const idx = url.includes('page=2') ? 1 : 0;
      const page = pages[idx] || { data: [], has_more: false };
      return {
        ok: true,
        status: 200,
        json: async () => page,
      };
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({}),
    };
  };
}
