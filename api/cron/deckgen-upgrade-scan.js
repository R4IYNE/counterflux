/**
 * Phase 19 (v1.3) — Daily upgrade-scan cron.
 *
 * Vercel Cron entry. Runs once daily (see vercel.json crons[]). Scans
 * every user's decks, detects cards released since the deck's
 * updated_at, runs them through /api/deckgen with mode='upgrade', and
 * writes paired swap-out/swap-in recommendations to
 * counterflux.deckgen_recommendations.
 *
 * Three surface integrations consume the rows:
 *   1. Dashboard widget (Epic Experiment)
 *   2. Notification bell (existing v1.1 Phase 12 component)
 *   3. Preordain "Upgrade Available" section
 *
 * Uses SERVICE_ROLE — one explicit exception to v1.0-v1.2's no-service-
 * role rule, documented in the v1.3 PRD. RLS still applies on reads
 * (users see only their own rows); writes use service-role to bypass
 * the per-user JWT requirement (no user context exists in a cron).
 *
 * Vercel Cron authentication: Vercel sends an Authorization header
 * with a project-specific bearer token. We verify it against
 * CRON_SECRET (set in Vercel project env vars). Anyone else hitting
 * the endpoint gets 401.
 *
 * Failure mode: cron is idempotent. If today's run fails halfway
 * through, tomorrow's picks up the same set of decks (we don't
 * checkpoint per-deck). Recommendations are upserted by (deck_id +
 * generated_at-date) so repeated runs on the same day don't
 * duplicate rows.
 *
 * Cost guard: we DO NOT use Anthropic from this cron in v1.3 — the
 * cron just FLAGS new cards. Generating the actual swap recommendations
 * goes through the regular /api/deckgen pipe when the user clicks the
 * notification (so it counts against their daily budget). This keeps
 * background-cost predictable and lets the user veto before paying.
 * v1.4 may move to pre-computed swaps when we have better cost data.
 */

import { createClient } from '@supabase/supabase-js';

const NEW_CARDS_WINDOW_DAYS = 30;

export default async function handler(req, res) {
  // 1. Vercel Cron auth — bearer token check.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = req.headers?.authorization || '';
    if (header !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'unauthorized cron call' });
    }
  } else if (process.env.NODE_ENV === 'production') {
    // In production we REQUIRE CRON_SECRET. Without it any internet
    // caller could trigger this endpoint.
    console.error('[cron] CRON_SECRET missing in production');
    return res.status(500).json({ error: 'server misconfigured' });
  }

  // 2. Service-role Supabase client — bypasses RLS, scans every user.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[cron/upgrade-scan] Supabase service-role env vars missing');
    return res.status(500).json({ error: 'server misconfigured' });
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'counterflux' },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3. Fetch all decks across all users (not soft-deleted).
  const { data: decks, error: decksErr } = await supabase
    .from('decks')
    .select('id, user_id, name, format, commander_id, updated_at')
    .is('deleted_at', null);
  if (decksErr) {
    console.error('[cron/upgrade-scan] decks fetch failed:', decksErr.message);
    return res.status(500).json({ error: 'decks fetch failed' });
  }

  // 4. Pull the set of recently-released cards (~30 days). We hit
  // Scryfall's /sets endpoint to find any sets released in the window,
  // then for each set we ask "did anything in this set get released
  // since this deck was last edited?"
  const recentSets = await fetchRecentSetCodes(NEW_CARDS_WINDOW_DAYS);

  // 5. Per deck: check if any recent sets are newer than the deck's
  // updated_at. If yes, write a recommendation row. The row carries
  // the trigger context — the actual swap suggestions are generated
  // when the user clicks through (cost is metered against the user's
  // daily budget).
  const todayUtc = new Date().toISOString().slice(0, 10);
  let written = 0;
  let skipped = 0;

  for (const deck of (decks || [])) {
    if (!deck.commander_id) { skipped++; continue; }

    const deckUpdatedAt = new Date(deck.updated_at || 0).getTime();
    const triggerSets = recentSets.filter((s) => {
      const setReleased = new Date(s.released_at || 0).getTime();
      return setReleased > deckUpdatedAt;
    });

    if (triggerSets.length === 0) { skipped++; continue; }

    // Idempotency: skip if we've already written an undismissed
    // recommendation for this deck today.
    const { data: existing } = await supabase
      .from('deckgen_recommendations')
      .select('id')
      .eq('deck_id', deck.id)
      .eq('type', 'upgrade')
      .gte('generated_at', todayUtc + 'T00:00:00Z')
      .limit(1);
    if (existing && existing.length > 0) { skipped++; continue; }

    const recommendation = {
      id: crypto.randomUUID(),
      user_id: deck.user_id,
      deck_id: deck.id,
      type: 'upgrade',
      recommendations: {
        version: 1,
        trigger_sets: triggerSets.map((s) => ({
          code: s.code,
          name: s.name,
          released_at: s.released_at,
        })),
        deck_name: deck.name,
        deck_format: deck.format,
        commander_id: deck.commander_id,
        message: triggerSets.length === 1
          ? `New cards from ${triggerSets[0].name} might fit ${deck.name}.`
          : `New cards from ${triggerSets.length} recent sets might fit ${deck.name}.`,
        // The actual swap pairs are generated on-demand when the user
        // clicks through — they hit /api/deckgen with mode='upgrade'
        // and the trigger_sets above scope the candidate pool.
        swaps: null,
      },
      generated_at: new Date().toISOString(),
      dismissed: false,
    };

    const { error: insertErr } = await supabase
      .from('deckgen_recommendations')
      .insert(recommendation);
    if (insertErr) {
      console.warn('[cron/upgrade-scan] insert failed for deck', deck.id, insertErr.message);
      continue;
    }
    written++;
  }

  return res.status(200).json({
    ok: true,
    decks_scanned: (decks || []).length,
    recommendations_written: written,
    skipped,
    recent_sets: recentSets.length,
  });
}

/**
 * Fetches Scryfall sets released within the trailing `days` window.
 * Returns ordered newest-first.
 */
async function fetchRecentSetCodes(days) {
  try {
    const res = await fetch('https://api.scryfall.com/sets');
    if (!res.ok) return [];
    const data = await res.json();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return (data.data || [])
      .filter((s) => {
        if (!s.released_at) return false;
        // Only consider real-paper sets; skip promos / memorabilia / digital.
        if (s.digital) return false;
        if (s.set_type === 'memorabilia') return false;
        if (s.set_type === 'token') return false;
        return new Date(s.released_at).getTime() > cutoff;
      })
      .sort((a, b) => b.released_at.localeCompare(a.released_at));
  } catch (err) {
    console.warn('[cron/upgrade-scan] Scryfall sets fetch failed:', err?.message || err);
    return [];
  }
}
