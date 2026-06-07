/**
 * Phase 19 (v1.3) — Client-side reader for deckgen_recommendations.
 *
 * Three surfaces consume these rows:
 *   1. Dashboard widget (Epic Experiment) — "N decks have upgrades"
 *   2. Notification bell — fires when new recommendations land
 *   3. Preordain "Upgrade Available" section
 *
 * The cron writes rows server-side via service-role; client reads them
 * via the user's normal Supabase JWT (RLS-protected). Local cache lives
 * in the Alpine store, not Dexie — recommendations are session-fresh
 * and don't need to survive a refresh.
 */

import { getSupabase } from './supabase.js';

/**
 * Fetch the user's undismissed upgrade recommendations.
 *
 * @returns {Promise<Array<Object>>} Array of recommendation rows.
 */
export async function fetchUndismissedRecommendations() {
  try {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .schema('counterflux')
      .from('deckgen_recommendations')
      .select('id, deck_id, type, recommendations, generated_at, dismissed')
      .eq('dismissed', false)
      .order('generated_at', { ascending: false });
    if (error) {
      console.warn('[deckgen-recommendations] fetch failed:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[deckgen-recommendations] fetch threw:', err?.message || err);
    return [];
  }
}

/**
 * Mark a recommendation as dismissed.
 *
 * @param {string} recommendationId
 * @returns {Promise<boolean>} true on success
 */
export async function dismissRecommendation(recommendationId) {
  try {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase
      .schema('counterflux')
      .from('deckgen_recommendations')
      .update({ dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('id', recommendationId);
    if (error) {
      console.warn('[deckgen-recommendations] dismiss failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[deckgen-recommendations] dismiss threw:', err?.message || err);
    return false;
  }
}
