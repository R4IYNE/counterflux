-- v1.3.x (audit fix #5) — separate the Mila Brew Chat daily budget from the
-- single-shot deckgen budget.
--
-- Before: /api/deckgen and /api/deckgen-chat both incremented
-- profile.deckgen_generations_today, so a chatty refinement session could
-- exhaust the 20/day brew budget. Conversational refinement is cheap (Sonnet)
-- and naturally multi-turn, so it gets its own, more generous counter with its
-- own lazy-reset date (independent rollover from the brew counter).
--
-- Additive + default-safe: existing profile rows boot cleanly; the brew path
-- (deckgen_generations_today / deckgen_last_reset) is untouched.
--
-- DEPLOY ORDER: apply this BEFORE deploying the chat budget split — the chat
-- endpoint selects deckgen_chat_generations_today, which must exist first.

ALTER TABLE counterflux.profile
  ADD COLUMN IF NOT EXISTS deckgen_chat_generations_today integer NOT NULL DEFAULT 0;

ALTER TABLE counterflux.profile
  ADD COLUMN IF NOT EXISTS deckgen_chat_last_reset date;
