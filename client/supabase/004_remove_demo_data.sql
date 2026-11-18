-- CardMaxx: one-time cleanup of the sample data that older sign-ups started with.
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run).
--
-- This PERMANENTLY deletes, for EVERY user:
--   * demo bank accounts (anything not linked through Plaid, so ids not starting with 'plaid_')
--   * wallet cards that came from those demo accounts (hand-added cards are kept)
--   * the sample CardMaxx purchase history (ids 'pur_0', 'pur_1', ...)
-- Real Plaid accounts, hand-added cards, budgets and profiles are not touched.

begin;

delete from public.user_cards
where account_id is not null and account_id not like 'plaid\_%';

delete from public.accounts
where id not like 'plaid\_%';

delete from public.purchases
where id like 'pur\_%';

commit;
