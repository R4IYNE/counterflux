-- Audit Tier 0 — RLS / household hardening (single-household lock-down).
--
-- counterflux.is_household_member(uid) has NO household id — it returns true for
-- ANY uid present in shared_users. Every table policy is
--   is_household_member(user_id) AND is_household_member(auth.uid())
-- which enforces "both the row owner and the caller are SOME shared user", i.e.
-- ONE global household. This is correct ONLY while exactly one household exists.
-- Onboarding a second independent group REQUIRES a real household_id design
-- (households table + shared_users.household_id + same-household comparison)
-- BEFORE adding them, or all data merges with no tenant isolation.
comment on function counterflux.is_household_member(uuid) is
  'SINGLE-HOUSEHOLD MODEL: true if uid is in shared_users (no household id). Safe ONLY while one household exists; multi-tenant needs a household_id redesign first. Audit 2026-06-17.';

-- Close the unauthenticated membership-probe oracle. anon could call
-- /rest/v1/rpc/is_household_member?check_uid=<uuid> to learn whether a given uid
-- is a member. The app never queries counterflux tables or this RPC
-- unauthenticated, so revoking anon EXECUTE has no functional impact.
revoke execute on function counterflux.is_household_member(uuid) from anon;

-- Covering index for the deck_cards -> decks foreign key
-- (advisor: unindexed_foreign_keys). Helps RLS/joins and the sync push that
-- resolves a parent deck before its cards. deck_cards is small (single
-- household) so the build lock is negligible.
create index if not exists idx_deck_cards_deck_id
  on counterflux.deck_cards (deck_id);
