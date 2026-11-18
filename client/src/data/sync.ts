// Keeps the store in step with Supabase Auth: loads a user's data when they sign in
// (creating starter data on their first sign-in) and clears it when they sign out.
// After loading, it asks the server to refresh linked Plaid banks in the background.

import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { createUserData, loadTransactions, loadUserData } from '@/services/db';
import { isPlaidAccount, refreshPlaid } from '@/services/plaid';

import { DEFAULT_PREFS, starterData, useStore } from './store';

let started = false;
let loadingFor: string | null = null;

async function signedIn(user: User) {
  const store = useStore.getState();
  // Token refreshes and tab focus fire SIGNED_IN again; only load once per user.
  if (store.session?.userId === user.id || loadingFor === user.id) return;
  loadingFor = user.id;
  try {
    const email = user.email ?? '';
    let data = await loadUserData(user.id);
    if (!data) {
      const name = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : undefined;
      const fresh = starterData(email, name);
      await createUserData(user.id, { ...fresh, prefs: { ...DEFAULT_PREFS, ...store.prefs } });
      data = fresh;
    }
    const method = user.app_metadata?.provider === 'google' ? 'google' : 'email';
    useStore.getState().setSignedIn({ userId: user.id, email, method }, data);
    if (data.accounts.some((a) => isPlaidAccount(a.id))) void refreshBanks();
  } catch (e) {
    console.warn('[CardMaxx] Couldn’t load your data:', e instanceof Error ? e.message : e);
    // Without data the app can't show anything useful, so back out to the sign-in screen.
    await supabase.auth.signOut();
  } finally {
    loadingFor = null;
  }
}

let refreshing: Promise<{ failed: string[] }> | null = null;

/**
 * New transactions and fresh balances for every Plaid bank. Safe to call often: calls made
 * while one is running share it. Failures are logged; the app keeps what it already has.
 */
export function refreshBanks(): Promise<{ failed: string[] }> {
  refreshing ??= (async () => {
    try {
      const { accounts, failed } = await refreshPlaid();
      const store = useStore.getState();
      if (!store.session) return { failed: [] };
      store.refreshAccounts(accounts);
      store.setTransactions(await loadTransactions());
      return { failed };
    } catch (e) {
      console.warn('[CardMaxx] Couldn’t refresh your banks:', e instanceof Error ? e.message : e);
      return { failed: [] };
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Start once at app launch. Resolves the first auth state before the app renders. */
export function startAuthSync() {
  if (started) return;
  started = true;

  supabase.auth.onAuthStateChange((event, session) => {
    // Supabase warns against awaiting its own calls inside this callback, so defer the work.
    setTimeout(async () => {
      if (session?.user) await signedIn(session.user);
      else if (useStore.getState().session) useStore.getState().setSignedOut();

      if (event === 'PASSWORD_RECOVERY') router.push('/new-password');
      if (event === 'INITIAL_SESSION') useStore.getState().setAuthReady();
    }, 0);
  });
}
