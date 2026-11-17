-- CardMaxx database schema.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Safe to re-run: it only creates what is missing.
--
-- Sign-in itself lives in Supabase's built-in auth.users table (it replaces the spec's
-- `user` and `session` tables). Every table below belongs to one user, and row level
-- security makes sure a signed-in user can only read and change their own rows.
--
-- Ids are text because the app makes them (demo accounts share ids like 'acc_chase_chk'
-- across users), so each table's key is (user_id, id).

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  username    text not null default '',
  email       text not null default '',
  phone       text not null default '',
  photo_uri   text,
  prefs       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Linked bank, card, investment and loan accounts (institution_link + account in the spec).
create table if not exists public.accounts (
  user_id         uuid not null references auth.users (id) on delete cascade,
  id              text not null,
  institution_id  text not null,
  name            text not null,
  type            text not null check (type in ('checking', 'savings', 'credit', 'investment', 'loan')),
  mask            text not null,
  balance_cents   bigint not null,
  limit_cents     bigint,
  product_id      text,
  linked_at       timestamptz not null,
  primary key (user_id, id)
);

-- Cards CardMaxx can pay with (user_card in the spec).
create table if not exists public.user_cards (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  product_id  text not null,
  mask        text not null,
  nickname    text,
  account_id  text,
  enabled     boolean not null default true,
  added_at    timestamptz not null,
  primary key (user_id, id)
);

create table if not exists public.budgets (
  user_id      uuid not null references auth.users (id) on delete cascade,
  category     text not null,
  limit_cents  bigint not null check (limit_cents >= 0),
  primary key (user_id, category)
);

-- Purchases made through CardMaxx (transaction in the spec).
create table if not exists public.purchases (
  user_id       uuid not null references auth.users (id) on delete cascade,
  id            text not null,
  date          timestamptz not null,
  merchant      text not null,
  category      text not null,
  amount_cents  bigint not null,
  card_id       text not null,
  reward_cents  bigint not null default 0,
  rate_label    text not null default '',
  status        text not null check (status in ('succeeded', 'refunded', 'pending')),
  primary key (user_id, id)
);

create index if not exists purchases_user_date on public.purchases (user_id, date desc);

-- Row level security: each user sees and changes only their own rows.
alter table public.profiles   enable row level security;
alter table public.accounts   enable row level security;
alter table public.user_cards enable row level security;
alter table public.budgets    enable row level security;
alter table public.purchases  enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "own accounts" on public.accounts;
create policy "own accounts" on public.accounts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own cards" on public.user_cards;
create policy "own cards" on public.user_cards for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own budgets" on public.budgets;
create policy "own budgets" on public.budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own purchases" on public.purchases;
create policy "own purchases" on public.purchases for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
