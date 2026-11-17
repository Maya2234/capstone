// App side of Plaid: calls our own API routes (src/app/api/plaid/), never Plaid directly.
// The routes check who's signed in from the Supabase access token sent here.

import type { Account } from '@/data/types';
import { supabase } from '@/lib/supabase';

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to link a bank.');
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'Couldn’t reach CardMaxx. Try again.');
  return json as T;
}

export async function createLinkToken(): Promise<string> {
  return (await call<{ link_token: string }>('/api/plaid/link-token', { method: 'POST' })).link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<{ institution: string; accounts: Account[] }> {
  return call('/api/plaid/exchange', { method: 'POST', body: JSON.stringify({ public_token: publicToken }) });
}

export async function fetchPlaidAccounts(): Promise<Account[]> {
  return (await call<{ accounts: Account[] }>('/api/plaid/accounts')).accounts;
}
