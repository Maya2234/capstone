-- CardMaxx: Plaid (run after schema.sql).
-- Supabase dashboard: SQL Editor > New query > paste this file > Run. Safe to re-run.

-- Linked accounts keep the bank's display name from Plaid (demo banks look theirs up in the app).
alter table public.accounts add column if not exists institution_name text;

-- One row per bank connection (institution_link in the spec).
-- access_token is the long-lived key to someone's bank data. It's stored encrypted
-- (AES-256-GCM, key in PLAID_TOKEN_KEY on the server), and this table has row level
-- security turned on with NO policies: the app can never read or write it. Only the
-- server routes in src/app/api/plaid/, using the Supabase secret key, can.
create table if not exists public.plaid_items (
  user_id           uuid not null references auth.users (id) on delete cascade,
  item_id           text not null,
  access_token_enc  text not null,
  institution_id    text,
  institution_name  text,
  created_at        timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.plaid_items enable row level security;
revoke all on public.plaid_items from anon, authenticated;
