// src/components/precon-browser.js
// COLLECT-02 / D-06: full-screen drawer (mirrors csv-import-modal mount pattern)
// that hosts the precon tile grid (VIEW A) and the decklist preview (VIEW B).
//
// Opens when $store.collection.preconBrowserOpen === true. Mounts inside the
// #tc-modals container via treasure-cruise.js. Escape key closes. The BROWSE
// PRECONS button in add-card-panel.js flips preconBrowserOpen + calls
// loadPrecons(). The ADD ALL N CARDS button calls addAllFromPrecon(code)
// which commits the whole deck in one transaction, fires one toast, and
// registers one undo entry.
//
// UI-SPEC §Component Anatomy 3: tile grid auto-fill with min 240px columns,
// 24px gap; tile aspect 240:336 (card ratio); keyrune glyph at 50% 50%,
// 96px, opacity 0.4; set-type badge top-left (COMMANDER | DUEL DECK);
// gradient fade overlay bottom with name + code + year.
// UI-SPEC §Copywriting Contract: exact strings preserved.
// UI-SPEC §Interaction & Motion: Escape closes; backdrop click closes;
// ADD ALL shows card count; workspace_premium badge marks commander row
// in preview.
//
// Name lookup: decklist entries have scryfall_id but no name. We expose a
// window.__cf_getPreconCardName(scryfall_id) helper that reads db.cards
// synchronously via the store cache (populated by searchCards or bulk data).
// If the name isn't in cache we fall back to the scryfall_id so the render
// never blanks out.

import { db } from '../db/schema.js';
import {
  isMultiDeckBundle,
  splitPreconIntoDecks,
  getDeckManifestForPrecon,
  loadPreconDeckMemberships,
  fetchPreconDecklist,
} from '../services/precons.js';

/**
 * Render the Precon Browser drawer HTML.
 * @returns {string} HTML string
 */
export function renderPreconBrowser() {
  // 260518-art4: version probe — confirms the LATEST module is actually being
  // executed when this function runs (not a Vite-cached older bundle). If you
  // open the precon browser and DON'T see this line in the info console, the
  // dev server is still serving stale code: stop npm run dev, delete
  // node_modules/.vite/deps, restart, then hard-refresh.
  console.info('[precon-browser] renderPreconBrowser() called — build 260518-art4');

  // Expose a name-lookup helper for the Alpine x-data template.
  // Uses an in-memory Map populated lazily — a single precon drill-in needs
  // ~100 card names; we batch-fetch from db.cards and cache in a module-level
  // map to avoid repeat reads.
  if (typeof window !== 'undefined' && !window.__cf_preconCardNames) {
    window.__cf_preconCardNames = new Map();
    window.__cf_hydratePreconNames = async (scryfallIds) => {
      const missing = scryfallIds.filter((id) => !window.__cf_preconCardNames.has(id));
      if (!missing.length) return;
      try {
        const rows = await db.cards.where('id').anyOf(missing).toArray();
        for (const r of rows) {
          window.__cf_preconCardNames.set(r.id, r.name);
        }
      } catch (err) {
        console.warn('[precon-browser] name hydration failed:', err);
      }
    };
    window.__cf_getPreconCardName = (scryfallId) => {
      return window.__cf_preconCardNames.get(scryfallId) || scryfallId;
    };
    // 260516-pnm: when the local lookup misses (oracle-cards bulk only
    // carries the canonical printing per oracle_id, so most precon-specific
    // printings won't be in db.cards), batch-fetch the names from Scryfall's
    // /cards/collection endpoint (up to 75 IDs per call). Cache locally so
    // we don't refetch on every reopen, and populate db.cards so the rest
    // of the app gets the metadata too.
    window.__cf_hydratePreconNamesFromApi = async (scryfallIds) => {
      const missing = scryfallIds.filter((id) => !window.__cf_preconCardNames.has(id));
      if (!missing.length) return;
      for (let i = 0; i < missing.length; i += 75) {
        const batch = missing.slice(i, i + 75);
        try {
          // 260517-cor: User-Agent is a forbidden request header in
          // browser fetch — setting it is a no-op at best and can trigger
          // a CORS preflight that Scryfall's /cards/collection endpoint
          // doesn't accept. The browser sets a UA automatically.
          const response = await fetch('https://api.scryfall.com/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifiers: batch.map((id) => ({ id })) }),
          });
          if (!response.ok) {
            console.warn('[precon-browser] /cards/collection failed:', response.status);
            continue;
          }
          const data = await response.json();
          for (const card of (data.data || [])) {
            if (card?.id && card?.name) {
              window.__cf_preconCardNames.set(card.id, card.name);
              try { await db.cards.put(card); } catch {}
            }
          }
        } catch (err) {
          console.warn('[precon-browser] /cards/collection batch failed:', err);
        }
      }
    };
  }

  // FOLLOWUP-4B (Phase 08.1) — expose the bundle detector to the Alpine
  // x-data scope. The `isBundle` getter inside VIEW B reads it via window
  // (Alpine x-data string templates can't import ES modules directly).
  if (typeof window !== 'undefined' && !window.__cf_isMultiDeckBundle) {
    window.__cf_isMultiDeckBundle = isMultiDeckBundle;
  }
  // Phase 14.07c — expose the bundle splitter for the virtual-deck tile view.
  if (typeof window !== 'undefined' && !window.__cf_splitPreconIntoDecks) {
    window.__cf_splitPreconIntoDecks = splitPreconIntoDecks;
  }
  // 260516-pcd: manifest-only deck enumerator + memberships loader so the
  // top-level tile grid can expand bundles into per-deck tiles without
  // pre-fetching Scryfall decklists.
  if (typeof window !== 'undefined' && !window.__cf_getDeckManifestForPrecon) {
    window.__cf_getDeckManifestForPrecon = getDeckManifestForPrecon;
    window.__cf_loadPreconDeckMemberships = loadPreconDeckMemberships;
  }
  // 260516-pcd2: representative-commander cache for non-manifest precons
  // (single-deck commander products, duel decks). Lazily filled by the
  // backfill loop in the precon-browser x-data — see backfillNonManifestCommanders.
  // Value semantics: { id, name } when a commander was identified, null
  // when the decklist had no legendary creature (most duel decks),
  // undefined when not yet fetched.
  if (typeof window !== 'undefined' && !window.__cf_preconRepresentativeCommander) {
    window.__cf_preconRepresentativeCommander = {};
  }
  // 260516-pcd2: expose fetchPreconDecklist for the backfill loop. Same
  // service entry the store uses inside selectPrecon — and it's already
  // cached in Dexie with a 7-day TTL, so repeated calls across sessions
  // are free after the first load.
  if (typeof window !== 'undefined' && !window.__cf_fetchPreconDecklist) {
    window.__cf_fetchPreconDecklist = fetchPreconDecklist;
  }
  // 260516-pcd: commander art cache (scryfall_id → art_crop URL).
  // Filled by hydrateCommanderImages(); empty entries render the
  // keyrune fallback until they resolve.
  // 260518-art2: cache object is initialised once per session so hydrated art
  // survives screen navigations, but the hydrateCommanderImages function is
  // assigned UNCONDITIONALLY every renderPreconBrowser() call. Without that,
  // HMR-driven updates (and any subsequent in-session fixes) never replace the
  // original closure — users keep running whatever function was installed on
  // first precon-browser open until a hard page reload. This kept the
  // 260518-art1 fix from actually executing for in-session HMR users.
  if (typeof window !== 'undefined' && !window.__cf_commanderArt) {
    window.__cf_commanderArt = {};
  }
  if (typeof window !== 'undefined') {
    window.__cf_hydrateCommanderImages = async (scryfallIds) => {
      // 260518-art2: also treat `null` entries as missing — a previous attempt
      // left them as the in-flight sentinel and never resolved (network error,
      // 4xx, or the pre-fix code's silent miss). Re-fetch them now.
      const missing = scryfallIds.filter((id) => id && (
        !(id in window.__cf_commanderArt) || window.__cf_commanderArt[id] === null
      ));
      if (!missing.length) return;
      // 260518-art3: log so the user can see hydration actually firing.
      // Helps diagnose 'still no art' reports — if these logs don't appear
      // in the console, the function isn't being called; if they appear but
      // 'received' counts are zero or much smaller than 'requesting', the
      // Scryfall endpoint is the problem, not the cache plumbing.
      console.info('[commander-art] requesting', missing.length, 'commanders from Scryfall');
      // Mark in-flight to suppress duplicate fetches on re-render.
      for (const id of missing) window.__cf_commanderArt[id] = null;
      const artOf = (card) => card?.image_uris?.art_crop
        || card?.card_faces?.[0]?.image_uris?.art_crop
        || card?.image_uris?.normal
        || '';
      // Batch via /cards/collection (max 75 IDs per call).
      for (let i = 0; i < missing.length; i += 75) {
        const batch = missing.slice(i, i + 75);
        try {
          // 260517-cor: drop User-Agent (browser forbidden request header
          // — see __cf_hydratePreconNamesFromApi above for the rationale).
          const response = await fetch('https://api.scryfall.com/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifiers: batch.map((id) => ({ id })) }),
          });
          if (!response.ok) {
            console.warn('[commander-art] /cards/collection failed:', response.status, await response.text().catch(() => '<no body>'));
            // 260518-art3: DELETE the in-flight sentinel on network/server
            // failure (was '' before — but '' stayed in the cache forever and
            // the dedup skipped these ids for the rest of the session,
            // permanently grounding them on keyrune). Deleting lets the next
            // kickArtHydration tick retry; combined with the REFRESH button
            // clearing _artHydrationKickedFor (artR) the user can recover.
            for (const id of batch) {
              if (window.__cf_commanderArt[id] === null) {
                delete window.__cf_commanderArt[id];
              }
            }
            continue;
          }
          const data = await response.json();
          const foundCards = data.data || [];
          console.info('[commander-art] Scryfall returned', foundCards.length, 'cards;', (data.not_found || []).length, 'not_found of', batch.length, 'requested');

          // 260518-art1: cache art under BOTH the requested ID and the
          // response card's ID (when they differ). Cause: MTGJSON's manifest
          // sometimes lists an older printing's id while Scryfall has since
          // remapped that id to a current canonical printing — the response
          // arrives but its .id no longer matches what we asked for, so the
          // tile's commanderArt(requestedId) lookup misses and the keyrune
          // fallback stays. Two-phase match:
          //   1. Direct id match — the common case
          //   2. Position-based fallback for unmatched batch IDs ↔ response
          //      cards whose id isn't in our batch (Scryfall returns data
          //      in request order, excluding not_found entries)
          const responseByDirectId = new Map();
          for (const card of foundCards) {
            if (card?.id) responseByDirectId.set(card.id, card);
          }
          const matched = new Set();
          for (const requestedId of batch) {
            const card = responseByDirectId.get(requestedId);
            if (!card) continue;
            window.__cf_commanderArt[requestedId] = artOf(card);
            matched.add(requestedId);
            try { await db.cards.put(card); } catch {}
          }
          const unmatchedBatch = batch.filter((id) => !matched.has(id));
          const remappedCards = foundCards.filter((c) => c?.id && !batch.includes(c.id));
          const pairCount = Math.min(unmatchedBatch.length, remappedCards.length);
          for (let k = 0; k < pairCount; k++) {
            const requestedId = unmatchedBatch[k];
            const card = remappedCards[k];
            const art = artOf(card);
            window.__cf_commanderArt[requestedId] = art;
            if (card.id) window.__cf_commanderArt[card.id] = art;
            try { await db.cards.put(card); } catch {}
          }
          // Anything still null after both phases → not found by Scryfall.
          // Resolve to '' so commanderArt() falls back to keyrune instead of
          // sitting on the null in-flight sentinel forever.
          for (const id of batch) {
            if (window.__cf_commanderArt[id] === null) {
              window.__cf_commanderArt[id] = '';
            }
          }
        } catch (err) {
          console.warn('[precon-browser] commander-art batch failed:', err);
          // 260518-art3: same recovery semantics as the !response.ok branch —
          // delete so retry is possible.
          for (const id of batch) {
            if (window.__cf_commanderArt[id] === null) {
              delete window.__cf_commanderArt[id];
            }
          }
        }
      }
    };
  }

  return `
    <div
      x-data="{
        preconSearch: '',
        selectedSetCode: '',
        _missingNamesFetched: false,
        _membershipsReady: false,
        _artHydrationKickedFor: new Set(),
        _backfillStarted: false,
        _commanderResolveBump: 0,
        _artBump: 0,
        async ensureMembershipsLoaded() {
          if (this._membershipsReady) return;
          if (window.__cf_loadPreconDeckMemberships) {
            await window.__cf_loadPreconDeckMemberships();
          }
          this._membershipsReady = true;
          // Kick the non-manifest commander backfill once memberships are
          // ready; the precons list may still be loading so the backfill
          // loop guards on that internally.
          this.backfillNonManifestCommanders();
        },
        commanderArt(id) {
          // Reads _artBump first so this getter re-evaluates whenever the
          // hydration loop lands new art. Without it, window.__cf_commanderArt
          // mutations are invisible to Alpine and the keyrune fallback
          // would stay forever.
          this._artBump;
          if (!id) return '';
          const cache = window.__cf_commanderArt || {};
          return cache[id] || '';
        },
        representativeCommanderFor(code) {
          // Reads _commanderResolveBump so the getter that calls this
          // re-evaluates whenever the backfill resolves a new commander.
          return this._commanderResolveBump,
            (window.__cf_preconRepresentativeCommander?.[code]) || null;
        },
        async backfillNonManifestCommanders() {
          if (this._backfillStarted) return;
          if (!this._membershipsReady) return;
          const precons = $store.collection.precons || [];
          if (precons.length === 0) {
            // Try again once precons land — Alpine effect on filteredPrecons
            // will re-trigger us via the x-effect on the root element.
            return;
          }
          this._backfillStarted = true;
          for (const p of precons) {
            if (!p?.code) continue;
            // Skip if cache already has an answer (or null sentinel).
            if (Object.prototype.hasOwnProperty.call(
              window.__cf_preconRepresentativeCommander || {}, p.code,
            )) continue;
            // Skip if manifest already provides commanders — those tiles
            // get per-deck commanders from the manifest path, not this loop.
            const decks = window.__cf_getDeckManifestForPrecon?.(p.code) || [];
            if (decks.length > 0) continue;
            try {
              const decklist = await fetchPreconDecklist(p.code);
              const cmdr = (decklist || []).find((e) => e.is_commander);
              if (cmdr) {
                window.__cf_preconRepresentativeCommander[p.code] = {
                  id: cmdr.scryfall_id,
                  name: cmdr.name,
                };
                // Hydrate the art and wait — bump _artBump after the
                // fetch lands so the tile re-renders with the image.
                if (window.__cf_hydrateCommanderImages) {
                  await window.__cf_hydrateCommanderImages([cmdr.scryfall_id]);
                  this._artBump++;
                }
              } else {
                // Decklist had no legendary creature (most duel decks).
                // Cache null so we don't re-fetch on every render.
                window.__cf_preconRepresentativeCommander[p.code] = null;
              }
              this._commanderResolveBump++;
            } catch (err) {
              console.warn('[precon-browser] non-manifest commander backfill failed for', p.code, err);
              window.__cf_preconRepresentativeCommander[p.code] = null;
            }
          }
        },
        get filteredPrecons() {
          // 260516-pcs: client-side fuzzy on precon name + code so the user
          // can type 'commander' / 'duel' / a year / a code like 'cmm' and
          // narrow down the tile grid quickly. Empty query = full list.
          // 260517-sst: also honour selectedSetCode (the set-filter dropdown).
          // Both filters compose — typing in the search narrows within the
          // selected set.
          let list = $store.collection.precons || [];
          if (this.selectedSetCode) {
            list = list.filter(p => p.code === this.selectedSetCode);
          }
          const q = (this.preconSearch || '').trim().toLowerCase();
          if (!q) return list;
          return list.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.code || '').toLowerCase().includes(q) ||
            (p.set_type || '').toLowerCase().includes(q) ||
            ((p.released_at || '').slice(0, 4)).includes(q)
          );
        },
        get setOptions() {
          // 260517-sst: alphabetically-sorted list of precons for the
          // set-filter dropdown. Deduplicates by code (Scryfall sometimes
          // returns the same product under two release dates).
          const seen = new Set();
          const out = [];
          for (const p of ($store.collection.precons || [])) {
            if (!p?.code || seen.has(p.code)) continue;
            seen.add(p.code);
            out.push({ code: p.code, name: p.name || p.code, year: (p.released_at || '').slice(0, 4) });
          }
          out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          return out;
        },
        get flatDeckTiles() {
          // 260516-pcd: produce ONE tile per deck rather than one per bundle.
          // For products with a manifest entry, each deck becomes its own
          // tile with the deck's commander as the thumbnail. For products
          // without a manifest (single-deck commander products, duel decks,
          // older sets), emit one tile per product as before.
          if (!this._membershipsReady) return [];
          const tiles = [];
          for (const p of (this.filteredPrecons || [])) {
            const decks = (window.__cf_getDeckManifestForPrecon
              ? window.__cf_getDeckManifestForPrecon(p.code)
              : []);
            if (decks.length > 0) {
              for (const d of decks) {
                tiles.push({
                  isDeck: true,
                  precon: p,
                  deckKey: d.key,
                  deckName: d.deckName,
                  commander: d.commander,
                  cardCount: d.total,
                });
              }
            } else {
              // 260516-pcd2: non-manifest precons (single-deck commander
              // products, duel decks). Use the backfilled representative
              // commander when available; falls back to null until the
              // background fetch lands and bumps _commanderResolveBump.
              const repr = this.representativeCommanderFor(p.code);
              tiles.push({
                isDeck: false,
                precon: p,
                deckKey: null,
                deckName: p.name,
                commander: repr,
                cardCount: 0,
              });
            }
          }
          return tiles;
        },
        async kickArtHydration() {
          // Pull commander IDs from the current tile list and batch-fetch
          // their image URLs. Idempotent via _artHydrationKickedFor — a
          // search-query change only re-fires for any NEW commander ids
          // that surface.
          if (!window.__cf_hydrateCommanderImages) return;
          const ids = this.flatDeckTiles
            .map(t => t.commander?.id)
            .filter(Boolean);
          const fresh = ids.filter(id => !this._artHydrationKickedFor.has(id));
          if (fresh.length === 0) return;
          for (const id of fresh) this._artHydrationKickedFor.add(id);
          await window.__cf_hydrateCommanderImages(fresh);
          // Bump tripwire so commanderArt(id) re-evaluates and tiles
          // swap from keyrune to commander art.
          this._artBump++;
        },
        async hydrateCommanderArtIds(ids) {
          // 260517-vbc: shared art hydrator for VIEW B's manifest deck tiles
          // (drilled-in bundle deck-picker). Reuses _artHydrationKickedFor so
          // we don't double-fetch a commander that VIEW A already pulled.
          if (!window.__cf_hydrateCommanderImages) return;
          const fresh = (ids || [])
            .filter(Boolean)
            .filter(id => !this._artHydrationKickedFor.has(id));
          if (fresh.length === 0) return;
          for (const id of fresh) this._artHydrationKickedFor.add(id);
          await window.__cf_hydrateCommanderImages(fresh);
          this._artBump++;
        },
        async hydrateNames(decklist) {
          if (!decklist || !decklist.length) return;
          // 260516-pnm: seed the in-memory map from the decklist's own .name
          // field FIRST so older fetched decks render immediately even when
          // db.cards doesn't have the printings (post oracle-cards swap).
          for (const e of decklist) {
            if (e?.scryfall_id && e?.name && window.__cf_preconCardNames && !window.__cf_preconCardNames.has(e.scryfall_id)) {
              window.__cf_preconCardNames.set(e.scryfall_id, e.name);
            }
          }
          const ids = decklist.map(e => e.scryfall_id);
          if (window.__cf_hydratePreconNames) await window.__cf_hydratePreconNames(ids);
          // 260516-pnm: anything still missing after the local sweep falls
          // through to a batched /cards/collection API call. Guarded so we
          // only fire it once per opened decklist.
          if (!this._missingNamesFetched && window.__cf_hydratePreconNamesFromApi) {
            const stillMissing = ids.filter(id => !window.__cf_preconCardNames.has(id));
            if (stillMissing.length > 0) {
              this._missingNamesFetched = true;
              await window.__cf_hydratePreconNamesFromApi(stillMissing);
            }
          }
        }
      }"
      x-show="$store.collection.preconBrowserOpen"
      x-cloak
      x-init="ensureMembershipsLoaded()"
      x-effect="$store.collection.preconBrowserOpen && ensureMembershipsLoaded()"
      @keydown.escape.window="$store.collection.closePreconBrowser()"
      x-effect="$store.collection.selectedPreconCode && hydrateNames(($store.collection.precons.find(p => p.code === $store.collection.selectedPreconCode))?.decklist)"
      x-effect="flatDeckTiles.length > 0 && _membershipsReady && $store.collection.preconBrowserOpen && !$store.collection.selectedPreconCode && kickArtHydration()"
      x-effect="_membershipsReady && ($store.collection.precons || []).length > 0 && backfillNonManifestCommanders()"
      style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; display: flex; align-items: center; justify-content: center;"
    >
      <!-- Backdrop -->
      <div
        @click="$store.collection.closePreconBrowser()"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);"
      ></div>

      <!-- Drawer panel -->
      <div
        @click.stop
        style="position: relative; z-index: 10; background: var(--color-surface); border: 1px solid var(--color-border-ghost); width: 90vw; max-width: 1280px; height: 90vh; display: flex; flex-direction: column; padding: 24px; gap: 16px; overflow: hidden;"
      >
        <!-- Header: title + search + REFRESH + close -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 16px; flex-wrap: wrap;">
          <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 0.01em; color: var(--color-text-primary); margin: 0; text-transform: uppercase;">
            BROWSE PRECONS
          </h2>

          <!-- 260516-pcs: precon name search. Filters the tile grid as you
               type — name, code, set_type, or year all match. -->
          <div style="position: relative; flex: 1; min-width: 200px; max-width: 360px;"
            x-show="!$store.collection.selectedPreconCode">
            <span class="material-symbols-outlined" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 16px; color: var(--color-text-dim); pointer-events: none;">search</span>
            <input
              type="text"
              x-model="preconSearch"
              placeholder="SEARCH PRECONS..."
              style="width: 100%; box-sizing: border-box; background: var(--color-background); border: 1px solid var(--color-border-ghost); color: var(--color-text-primary); padding: 6px 30px 6px 32px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none;"
              onfocus="this.style.borderColor='var(--color-primary)'"
              onblur="this.style.borderColor='var(--color-border-ghost)'"
              autocomplete="off"
            >
            <button
              x-show="preconSearch.length > 0"
              @click="preconSearch = ''"
              title="Clear search"
              aria-label="Clear precon search"
              style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: var(--color-text-muted);"
              onmouseenter="this.style.color='var(--color-secondary)'"
              onmouseleave="this.style.color='var(--color-text-muted)'"
            >
              <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
            </button>
          </div>

          <!-- 260517-sst: set-filter dropdown. 'Secrets of Strixhaven
               Commander' becomes a selector that narrows the long view
               to only that product's decks — rather than requiring the
               user to drill in and out via the deck-picker. Composes with
               the text search above. -->
          <div style="position: relative; min-width: 220px; max-width: 320px;"
            x-show="!$store.collection.selectedPreconCode">
            <select
              x-model="selectedSetCode"
              aria-label="Filter precon decks by set"
              style="width: 100%; box-sizing: border-box; background: var(--color-background); border: 1px solid var(--color-border-ghost); color: var(--color-text-primary); padding: 6px 28px 6px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; -moz-appearance: none;"
              onfocus="this.style.borderColor='var(--color-primary)'"
              onblur="this.style.borderColor='var(--color-border-ghost)'"
            >
              <option value="">ALL SETS</option>
              <template x-for="opt in setOptions" :key="opt.code">
                <option :value="opt.code" x-text="opt.name + (opt.year ? ' · ' + opt.year : '')"></option>
              </template>
            </select>
            <span class="material-symbols-outlined" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); font-size: 18px; color: var(--color-text-dim); pointer-events: none;">expand_more</span>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <!-- 260518-art3: REFRESH also clears the commander-art cache +
                 per-component dedup set so stuck '' / kicked entries from a
                 prior failed Scryfall round get a fresh attempt. Without
                 this, the only recovery from a transient API hiccup was a
                 full page reload (which Vite HMR doesn't trigger). -->
            <button
              @click="if (window.__cf_commanderArt) { for (const k of Object.keys(window.__cf_commanderArt)) delete window.__cf_commanderArt[k]; } _artHydrationKickedFor = new Set(); $store.collection.refreshPrecons()"
              :disabled="$store.collection.preconsLoading"
              style="padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost); cursor: pointer; text-transform: uppercase;"
              x-text="$store.collection.preconsLoading ? 'REFRESHING…' : 'REFRESH'"
            ></button>
            <button
              @click="$store.collection.closePreconBrowser()"
              aria-label="Close precon browser"
              title="Close precon browser"
              style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: var(--color-text-muted); transition: all 120ms ease-out;"
              onmouseenter="this.style.color='var(--color-secondary)'; this.style.boxShadow='0 0 8px var(--color-glow-red)'"
              onmouseleave="this.style.color='var(--color-text-muted)'; this.style.boxShadow='none'"
            >
              <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
            </button>
          </div>
        </div>

        <!-- Body: VIEW A (tiles) or VIEW B (decklist preview) -->
        <div style="flex: 1; min-height: 0; overflow-y: auto;">

          <!-- Loading skeleton -->
          <template x-if="$store.collection.preconsLoading && !$store.collection.precons.length">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 24px;">
              <template x-for="i in 10" :key="i">
                <div class="animate-pulse" style="width: 100%; aspect-ratio: 240 / 336; background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost);"></div>
              </template>
            </div>
          </template>

          <!-- Error state -->
          <template x-if="$store.collection.preconsError && !$store.collection.precons.length">
            <div style="padding: 48px; text-align: center;">
              <h3 style="font-family: 'Syne', sans-serif; font-size: 20px; color: var(--color-secondary); text-transform: uppercase; margin: 0;">COULDN'T LOAD PRECONS</h3>
              <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: var(--color-text-muted); margin: 16px 0;">Check your connection and try again.</p>
              <button
                @click="$store.collection.refreshPrecons()"
                style="padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-primary); border: 1px solid var(--color-primary); cursor: pointer; text-transform: uppercase;"
              >TRY AGAIN</button>
            </div>
          </template>

          <!-- Empty state -->
          <template x-if="!$store.collection.preconsLoading && !$store.collection.preconsError && !$store.collection.precons.length">
            <div style="padding: 48px; text-align: center;">
              <h3 style="font-family: 'Syne', sans-serif; font-size: 20px; color: var(--color-text-primary); text-transform: uppercase; margin: 0;">NO PRECONS AVAILABLE</h3>
              <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: var(--color-text-muted); margin: 16px 0;">Scryfall didn't return any commander or duel-deck products. Try refreshing.</p>
              <button
                @click="$store.collection.refreshPrecons()"
                style="padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-primary); border: 1px solid var(--color-primary); cursor: pointer; text-transform: uppercase;"
              >REFRESH</button>
            </div>
          </template>

          <!-- VIEW A: Tile grid — filteredPrecons honours the search input
               in the header (260516-pcs). When the user has typed a query
               that matches nothing, the no-results template below fires
               instead of the tile grid. -->
          <template x-if="$store.collection.precons.length && !$store.collection.selectedPreconCode && filteredPrecons.length === 0">
            <div style="padding: 48px; text-align: center; display: flex; flex-direction: column; gap: 12px; align-items: center;">
              <span class="material-symbols-outlined" style="color: var(--color-text-muted); font-size: 32px;">search_off</span>
              <h3 style="font-family: 'Syne', sans-serif; font-size: 18px; color: var(--color-text-primary); text-transform: uppercase; margin: 0;">No matching precons</h3>
              <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: var(--color-text-muted); margin: 0;">
                Nothing matches "<span x-text="preconSearch"></span>". Try a different name, code, or year.
              </p>
              <button
                @click="preconSearch = ''"
                style="padding: 6px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: transparent; border: 1px solid var(--color-border-ghost); cursor: pointer; text-transform: uppercase; margin-top: 4px;"
                onmouseenter="this.style.borderColor='var(--color-primary)'"
                onmouseleave="this.style.borderColor='var(--color-border-ghost)'"
              >CLEAR SEARCH</button>
            </div>
          </template>

          <!-- 260516-pcd: flat deck tile grid. Multi-deck bundles (Marvel,
               Final Fantasy, etc.) expand to one tile per deck so users see
               the actual playable decks rather than the bundle product.
               Single-deck commander products + duel decks emit one tile each.
               Each tile attempts to show the commander's art_crop as its
               background (lazy-fetched + cached on window.__cf_commanderArt);
               fall back to the keyrune set glyph until art lands. -->
          <template x-if="flatDeckTiles.length > 0 && !$store.collection.selectedPreconCode">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 24px;">
              <template x-for="tile in flatDeckTiles" :key="(tile.deckKey || tile.precon.code) + '::' + (tile.commander?.id || '')">
                <button
                  @click="$store.collection.pendingDeckKey = tile.isDeck ? tile.deckKey : null; $store.collection.selectPrecon(tile.precon.code)"
                  class="card-tile-hover"
                  style="width: 100%; aspect-ratio: 240 / 336; padding: 0; background: var(--color-surface); border: 1px solid var(--color-border-ghost); cursor: pointer; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end;"
                >
                  <!-- Commander art background — lazy-loaded; rendered ABOVE
                       the keyrune fallback once the URL resolves. -->
                  <template x-if="tile.commander && commanderArt(tile.commander.id)">
                    <img
                      :src="commanderArt(tile.commander.id)"
                      :alt="tile.commander.name || tile.deckName"
                      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.85;"
                      loading="lazy"
                      onerror="this.style.display='none'"
                    >
                  </template>

                  <!-- Keyrune fallback when no commander art (single-deck
                       products without manifest entries, OR while art is in
                       flight from /cards/collection). ss-fallback prevents
                       blank on missing codes per Pitfall 4. -->
                  <template x-if="!tile.commander || !commanderArt(tile.commander.id)">
                    <i class="ss ss-fallback" :class="'ss-' + tile.precon.code"
                       style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 96px; color: var(--color-text-dim); opacity: 0.4;"></i>
                  </template>

                  <!-- Set-type badge (top-left) -->
                  <span
                    style="position: absolute; top: 8px; left: 8px; padding: 2px 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-muted); background: rgba(20,22,28,0.85); text-transform: uppercase;"
                    x-text="tile.precon.set_type === 'commander' ? 'COMMANDER' : (tile.precon.set_type === 'duel_deck' ? 'DUEL DECK' : (tile.precon.set_type || '').toUpperCase())"
                  ></span>

                  <!-- Deck-card count badge (top-right) — only when manifest
                       knows the total. Reads '100 CARDS' / '60 CARDS' etc. -->
                  <template x-if="tile.isDeck && tile.cardCount > 0">
                    <span
                      style="position: absolute; top: 8px; right: 8px; padding: 2px 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: rgba(20,22,28,0.85);"
                      x-text="tile.cardCount + ' CARDS'"
                    ></span>
                  </template>

                  <!-- Overlay strip (bottom) — deck name on top, then
                       commander name + product / year below. -->
                  <div style="position: relative; z-index: 2; padding: 16px; background: linear-gradient(to top, var(--color-background) 30%, transparent); text-align: left;">
                    <div
                      style="font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase;"
                      x-text="tile.deckName"
                    ></div>
                    <template x-if="tile.commander?.name">
                      <div
                        style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; font-weight: 400; color: var(--color-text-primary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                        x-text="tile.commander.name"
                      ></div>
                    </template>
                    <div
                      style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--color-text-muted); margin-top: 4px; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                      x-text="tile.precon.code.toUpperCase() + ' · ' + (tile.precon.released_at ? tile.precon.released_at.slice(0,4) : '—')"
                    ></div>
                  </div>
                </button>
              </template>
            </div>
          </template>

          <!-- VIEW B: Decklist preview -->
          <template x-if="$store.collection.selectedPreconCode">
            <div
              x-effect="$store.collection.pendingDeckKey = selectedDeckKey"
              x-data="{
              selectedDeckKey: null,
              init() {
                // 260516-pcd: if the outer tile click came from a per-deck
                // tile, the store carries a pendingDeckKey — adopt it so
                // VIEW B opens straight on the deck preview rather than
                // the manifest deck-picker.
                // 260517-rdk: also restores selectedDeckKey after REFRESH,
                // which unmounts and remounts VIEW B. The x-effect on the
                // wrapper mirrors selectedDeckKey → $store.collection.pendingDeckKey
                // throughout VIEW B's lifetime, so a refresh-induced remount
                // lands the user back on the same deck instead of bouncing
                // them to the deck-picker.
                if ($store.collection.pendingDeckKey) {
                  this.selectedDeckKey = $store.collection.pendingDeckKey;
                  $store.collection.pendingDeckKey = null;
                }
              },
              get precon() { return $store.collection.precons.find(p => p.code === $store.collection.selectedPreconCode); },
              get isBundle() { return window.__cf_isMultiDeckBundle ? window.__cf_isMultiDeckBundle(this.precon) : false; },
              // Phase 14.07e — manifest-driven deck tiles for known multi-deck
              // products (Final Fantasy, Doctor Who, etc.). Returns [] when no
              // manifest entry exists for this set code, falling back to the
              // 14-07d full-bundle banner + ADD ALL flow.
              get manifestDecks() {
                // Phase 14.07N — drop the isBundle gate so any product with
                // MTGJSON membership data renders the tile grid, not just
                // ones with >200 unique Scryfall cards. Smaller multi-deck
                // bundles (Doctor Who, Tales of Middle-earth, etc.) have
                // manifest data but may not pass the 200-card threshold.
                if (!window.__cf_splitPreconIntoDecks) return [];
                // Phase 14.07j — depend on the reactive flag flipped after
                // the lazy MTGJSON membership import resolves. Without this
                // reactive read, Alpine wouldn't recompute the tile grid
                // when the JSON arrives — leaving the user staring at the
                // legacy banner forever even though split data is ready.
                if (!$store.collection.preconMembershipsLoaded) return [];
                return window.__cf_splitPreconIntoDecks(this.precon);
              },
              get hasManifest() { return this.manifestDecks.length > 0; },
              get selectedDeck() {
                if (!this.selectedDeckKey) return null;
                return this.manifestDecks.find(d => d.key === this.selectedDeckKey) || null;
              },
              get effectiveDecklist() {
                if (this.selectedDeck) return this.selectedDeck.cards || [];
                return this.precon?.decklist || [];
              },
              get effectiveTitle() {
                if (this.selectedDeck) return this.precon?.name + ' — ' + this.selectedDeck.name;
                return this.precon?.name || '';
              },
              addAllEffective() {
                if (this.selectedDeck) {
                  // Phase 14.07L — use the MTGJSON-sourced full ID list, not
                  // just the locally-renderable subset. Bonus-set cards
                  // missing from the precon cache still need to land in
                  // the collection so the user gets the complete 100-card
                  // WotC deck.
                  const ids = (this.selectedDeck.scryfallIds && this.selectedDeck.scryfallIds.length)
                    ? this.selectedDeck.scryfallIds
                    : this.selectedDeck.cards.map(c => c.scryfall_id);
                  const label = (this.precon?.name || 'precon') + ' — ' + this.selectedDeck.name;
                  if ($store.collection.addCardsFromIds) {
                    $store.collection.addCardsFromIds(ids, { label });
                  } else {
                    $store.collection.addAllFromPrecon($store.collection.selectedPreconCode);
                  }
                } else {
                  $store.collection.addAllFromPrecon($store.collection.selectedPreconCode);
                }
              },
              addButtonLabel() {
                if (this.hasManifest && !this.selectedDeck) return 'PICK A DECK BELOW';
                // Phase 14.07L — when a manifest deck is selected, the count
                // comes from MTGJSON (deck.total = 100) not the local cache
                // subset. ADD ALL imports the full WotC list including
                // bonus-set cards missing from the local Scryfall cache.
                if (this.selectedDeck) {
                  const n = this.selectedDeck.total || this.selectedDeck.cards.length;
                  return 'ADD ALL ' + n + ' CARDS';
                }
                if (!this.effectiveDecklist.length) return 'LOADING…';
                return 'ADD ALL ' + this.effectiveDecklist.length + ' CARDS';
              },
              get addButtonEnabled() {
                if ($store.collection.preconDecklistLoading) return false;
                if (this.hasManifest && !this.selectedDeck) return false;
                if (this.selectedDeck) return !!(this.selectedDeck.scryfallIds?.length || this.selectedDeck.cards.length);
                return !!this.effectiveDecklist.length;
              },
              get sortedDecklist() {
                const list = this.effectiveDecklist;
                return [...list].sort((a, b) => {
                  if (a.is_commander !== b.is_commander) return b.is_commander ? 1 : -1;
                  return 0;
                });
              },
              cardName(entryOrId) {
                // 260516-pnm: prefer the decklist entry's own .name field
                // (populated by fetchPreconDecklist) so we never render
                // the raw scryfall_id even when db.cards / Scryfall API
                // haven't hydrated yet.
                if (entryOrId && typeof entryOrId === 'object') {
                  if (entryOrId.name) return entryOrId.name;
                  const lookup = window.__cf_getPreconCardName && window.__cf_getPreconCardName(entryOrId.scryfall_id);
                  if (lookup && lookup !== entryOrId.scryfall_id) return lookup;
                  return entryOrId.name || entryOrId.scryfall_id || '';
                }
                return (window.__cf_getPreconCardName && window.__cf_getPreconCardName(entryOrId)) || entryOrId;
              }
            }">
              <!-- Preview header -->
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px;">
                <!-- 260517-bts: BACK always returns to VIEW A (top-level
                     long view). The deck-picker intermediate view is dead
                     UX: every VIEW B entry path arrives directly on a
                     specific deck (manifest tiles set pendingDeckKey;
                     non-manifest precons have no manifest decks to pick).
                     Hopping back through a deck-picker the user never asked
                     for was the friction. selectedDeckKey clears as well so
                     pendingDeckKey gets nulled out via the wrapper x-effect
                     — fresh entry to a different precon starts clean. -->
                <button
                  @click="selectedDeckKey = null; $store.collection.selectedPreconCode = null"
                  style="padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost); cursor: pointer; text-transform: uppercase;"
                >← BACK TO PRECONS</button>

                <h3
                  style="flex: 1; font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: var(--color-text-primary); margin: 0; text-transform: uppercase;"
                  x-text="effectiveTitle"
                ></h3>

                <button
                  @click="addAllEffective()"
                  :disabled="!addButtonEnabled"
                  :style="addButtonEnabled
                    ? 'padding: 8px 16px; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-primary); border: 1px solid var(--color-primary); cursor: pointer; text-transform: uppercase;'
                    : 'padding: 8px 16px; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-dim); background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost); cursor: not-allowed; text-transform: uppercase; opacity: 0.5;'"
                  x-text="addButtonLabel()"
                ></button>
              </div>

              <!-- Phase 14.07e — manifest-driven deck tile grid (Final Fantasy,
                   Doctor Who, etc.). Drill into a tile to preview/import that
                   single deck; ADD ALL on the bundle product code is gated until
                   a deck is picked so the user can't accidentally dump 486 cards. -->
              <template x-if="!$store.collection.preconDecklistLoading && !$store.collection.preconDecklistError && hasManifest && !selectedDeck">
                <div
                  x-init="hydrateCommanderArtIds((manifestDecks || []).flatMap(d => (d.commanders || []).map(c => c.scryfall_id)))"
                >
                  <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: var(--color-text-muted); margin: 0 0 16px 0; max-width: 720px;">
                    Pick one of the <span x-text="manifestDecks.length"></span> decks in this product to preview its cards or add it to your collection. To import the whole boxed set instead, return to the precon list and use ADD ALL on a non-bundle product.
                  </p>
                  <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
                    <template x-for="deck in manifestDecks" :key="deck.key">
                      <button
                        @click="selectedDeckKey = deck.key"
                        class="card-tile-hover"
                        style="width: 100%; aspect-ratio: 220 / 308; padding: 0; background: var(--color-surface); border: 1px solid var(--color-border-ghost); cursor: pointer; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end;"
                      >
                        <!-- 260517-vbc: commander art background (first commander).
                             Manifest decks from splitPreconIntoDecks expose
                             commanders as Scryfall card objects with .scryfall_id
                             (NOT .id — that's the manifest-shape used by VIEW A's
                             flatDeckTiles via getDeckManifestForPrecon). -->
                        <template x-if="deck.commanders?.[0]?.scryfall_id && commanderArt(deck.commanders[0].scryfall_id)">
                          <img
                            :src="commanderArt(deck.commanders[0].scryfall_id)"
                            :alt="deck.commanders[0].name || deck.name"
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.85;"
                            loading="lazy"
                            onerror="this.style.display='none'"
                          >
                        </template>
                        <!-- Keyrune fallback until art lands -->
                        <template x-if="!deck.commanders?.[0]?.scryfall_id || !commanderArt(deck.commanders[0].scryfall_id)">
                          <i class="ss ss-fallback" :class="'ss-' + precon.code"
                             style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 96px; color: var(--color-text-dim); opacity: 0.4;"></i>
                        </template>
                        <!-- 260517-cid: mana-font glyphs for color identity
                             (replaces letter-code 'RW' / 'BG' text). Empty
                             identity → colorless 'C' symbol. -->
                        <span
                          style="position: absolute; top: 8px; left: 8px; display: inline-flex; gap: 3px; align-items: center; padding: 4px 6px; background: rgba(20,22,28,0.85);"
                          :aria-label="'Color identity: ' + deck.identityLabel"
                        >
                          <template x-if="!(deck.identity || []).length">
                            <i class="ms ms-c ms-cost" style="font-size: 14px;"></i>
                          </template>
                          <template x-for="ci in (deck.identity || [])" :key="ci">
                            <i class="ms ms-cost" :class="'ms-' + ci.toLowerCase()" style="font-size: 14px;"></i>
                          </template>
                        </span>
                        <span
                          style="position: absolute; top: 8px; right: 8px; padding: 2px 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: rgba(20,22,28,0.85);"
                          x-text="deck.total + ' CARDS'"
                        ></span>
                        <div style="position: relative; z-index: 2; padding: 16px; background: linear-gradient(to top, var(--color-background) 30%, transparent); text-align: left;">
                          <div
                            style="font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase;"
                            x-text="deck.name"
                          ></div>
                          <div
                            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--color-text-muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                            x-text="deck.commanders.map(c => c.name).join(' · ')"
                          ></div>
                        </div>
                      </button>
                    </template>
                  </div>
                </div>
              </template>

              <!-- Phase 14.07d/e — bundles WITHOUT a manifest entry get the
                   informational banner + full decklist + ADD ALL flow.
                   Manifest-backed bundles use the tile grid above; the banner
                   below only fires when no per-deck split is available. -->
              <template x-if="!$store.collection.preconDecklistLoading && !$store.collection.preconDecklistError && isBundle && !hasManifest">
                <div style="margin-bottom: 16px; padding: 12px 16px; background: var(--color-surface-hover); border-left: 2px solid var(--color-warning);">
                  <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: var(--color-text-primary); margin: 0;">
                    <strong style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-warning); text-transform: uppercase; margin-right: 8px;">MULTI-DECK PRODUCT</strong>
                    This boxed set bundles multiple decks. Per-deck import isn't supported for this product yet — ADD ALL imports every card from every deck. Only do this if you own the whole product.
                  </p>
                </div>
              </template>

              <!-- Decklist loading -->
              <template x-if="$store.collection.preconDecklistLoading">
                <div style="padding: 48px; text-align: center; color: var(--color-text-muted); font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;">LOADING DECKLIST…</div>
              </template>

              <!-- Decklist error -->
              <template x-if="$store.collection.preconDecklistError">
                <div style="padding: 24px; text-align: center;">
                  <h4 style="font-family: 'Syne', sans-serif; font-size: 20px; color: var(--color-secondary); text-transform: uppercase; margin: 0;">DECKLIST LOAD FAILED</h4>
                  <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: var(--color-text-muted); margin: 16px 0;">Something went wrong fetching this decklist. Try another product or refresh.</p>
                </div>
              </template>


              <!-- Decklist rows.
                   Phase 14.07e — when a manifest deck is selected the rows
                   filter to that deck's cards via effectiveDecklist;
                   otherwise the full bundle (or non-bundle precon) renders.
                   Hidden on manifest-backed bundles when no deck is selected
                   (the tile grid takes that slot). -->
              <template x-if="effectiveDecklist.length && !$store.collection.preconDecklistLoading && !(hasManifest && !selectedDeck)">
                <div style="display: flex; flex-direction: column;">
                  <template x-for="entry in sortedDecklist" :key="entry.scryfall_id">
                    <div
                      style="display: flex; align-items: center; gap: 16px; padding: 8px 12px; min-height: 56px; border-bottom: 1px solid var(--color-border-ghost); transition: background 120ms ease-out, border-left 120ms ease-out;"
                      onmouseenter="this.style.background='var(--color-surface-hover)'; this.style.borderLeft='2px solid var(--color-primary)'"
                      onmouseleave="this.style.background='transparent'; this.style.borderLeft='none'"
                    >
                      <span
                        style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--color-text-muted); min-width: 32px;"
                        x-text="entry.quantity + '×'"
                      ></span>
                      <span
                        style="flex: 1; font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                        x-text="cardName(entry)"
                      ></span>
                      <template x-if="entry.is_commander">
                        <span class="material-symbols-outlined" title="Commander" aria-label="Commander" style="font-size: 16px; color: var(--color-text-primary);">workspace_premium</span>
                      </template>
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </template>

        </div>
      </div>
    </div>
  `;
}
