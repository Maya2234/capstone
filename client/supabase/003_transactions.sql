-- CardMaxx: real bank transactions from Plaid (run after 002_plaid.sql).
-- Supabase dashboard: SQL Editor > New query > paste this file > Run. Safe to re-run.

-- Where /transactions/sync left off for each bank connection. Plaid hands back a cursor
-- after every sync; sending it next time returns only what changed since.
alter table public.plaid_items add column if not exists sync_cursor text;

-- Bank and card transactions (transaction_history in the spec). The server writes these
-- with the secret key; the app can only read its own.
create table if not exists public.transactions (
  user_id       uuid not null references auth.users (id) on delete cascade,
  id            text not null,             -- 'plaid_' + Plaid's transaction_id
  account_id    text not null,             -- matches accounts.id ('plaid_' + Plaid's account_id)
  item_id       text not null,             -- the plaid_items connection it came from
  date          timestamptz not null,
  merchant      text not null,
  category      text not null,
  amount_cents  bigint not null,           -- positive = money out, negative = money in
  pending       boolean not null default false,
  transfer      boolean not null default false, -- card payments, transfers, income: not counted as spending
  primary key (user_id, id)
);

create index if not exists transactions_user_account_date on public.transactions (user_id, account_id, date desc);

alter table public.transactions enable row level security;
revoke insert, update, delete on public.transactions from anon, authenticated;

drop policy if exists "read own transactions" on public.transactions;
create policy "read own transactions" on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));
