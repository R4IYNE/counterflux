-- Audit Tier 0 — atomic deckgen budget enforcement.
--
-- The previous enforcement (api/_deckgen-shared.js assertAndIncrementBudget) was
-- a non-atomic read-then-write: N concurrent requests with the same JWT each read
-- the pre-increment count, each passed the cap check, and each called the paid
-- Anthropic endpoint — bypassing the daily cap (the only cost control on the most
-- expensive endpoint in the app).
--
-- This function does the cap-check + lazy-daily-reset + increment in ONE
-- conditional `UPDATE ... WHERE count < cap RETURNING` statement. Concurrent calls
-- serialise on the profile row lock; the second re-evaluates its WHERE against the
-- already-incremented value and gets 0 rows back when at/over cap. Atomic, no race.
--
-- SECURITY DEFINER + search_path='' + scoped to auth.uid() internally: the function
-- only ever mutates the calling user's own profile row. Executable by authenticated
-- only (never anon / public).

create or replace function counterflux.try_consume_deckgen_budget(p_kind text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_cap   int;
  v_used  int;
begin
  if v_uid is null then
    return json_build_object('allowed', false, 'used_after', 0, 'cap', 0);
  end if;

  -- Ensure a profile row exists (id is a NOT NULL text PK with no default).
  insert into counterflux.profile (id, user_id)
  values (gen_random_uuid()::text, v_uid)
  on conflict (user_id) do nothing;

  if p_kind = 'brew' then
    v_cap := 20;
    update counterflux.profile
       set deckgen_generations_today =
             case when deckgen_last_reset is distinct from v_today
                  then 1 else deckgen_generations_today + 1 end,
           deckgen_last_reset = v_today,
           updated_at = now()
     where user_id = v_uid
       and (deckgen_last_reset is distinct from v_today
            or deckgen_generations_today < v_cap)
    returning deckgen_generations_today into v_used;

  elsif p_kind = 'chat' then
    v_cap := 60;
    update counterflux.profile
       set deckgen_chat_generations_today =
             case when deckgen_chat_last_reset is distinct from v_today
                  then 1 else deckgen_chat_generations_today + 1 end,
           deckgen_chat_last_reset = v_today,
           updated_at = now()
     where user_id = v_uid
       and (deckgen_chat_last_reset is distinct from v_today
            or deckgen_chat_generations_today < v_cap)
    returning deckgen_chat_generations_today into v_used;

  else
    return json_build_object('allowed', false, 'used_after', 0, 'cap', 0);
  end if;

  if v_used is null then
    -- 0 rows updated => at/over cap for today.
    return json_build_object('allowed', false, 'used_after', v_cap, 'cap', v_cap);
  end if;

  return json_build_object('allowed', true, 'used_after', v_used, 'cap', v_cap);
end;
$$;

revoke all on function counterflux.try_consume_deckgen_budget(text) from public;
grant execute on function counterflux.try_consume_deckgen_budget(text) to authenticated;
