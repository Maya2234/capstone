-- CardMaxx: enforce two-factor login in the database (run after 003_transactions.sql).
-- Supabase dashboard: SQL Editor > New query > paste this file > Run. Safe to re-run.
--
-- Without this, two-factor would only be a screen in the app: someone with just a password
-- could sign in through Supabase's API directly and read the tables. These RESTRICTIVE policies
-- add a second condition to every existing policy: if you have a verified authenticator, your
-- session must have entered a code (aal2). People without two-factor are unaffected.

create or replace function public.two_factor_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (auth.jwt() ->> 'aal') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;

revoke all on function public.two_factor_satisfied() from public, anon;
grant execute on function public.two_factor_satisfied() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'accounts', 'user_cards', 'budgets', 'purchases', 'transactions'] loop
    execute format('drop policy if exists "two-factor when enabled" on public.%I', t);
    execute format(
      'create policy "two-factor when enabled" on public.%I as restrictive for all to authenticated
         using ((select public.two_factor_satisfied())) with check ((select public.two_factor_satisfied()))',
      t
    );
  end loop;
end $$;
