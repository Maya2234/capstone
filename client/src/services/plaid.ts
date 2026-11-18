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

/** Pull new transactions into Supabase and get fresh balances for every Plaid bank. */
export async function refreshPlaid(): Promise<{ accounts: Account[]; failed: string[] }> {
  return call('/api/plaid/refresh', { method: 'POST' });
}

/** Revoke CardMaxx's access to a Plaid bank and delete its saved token and transactions. */
export async function unlinkPlaid(institutionId: string): Promise<void> {
  await call('/api/plaid/unlink', { method: 'POST', body: JSON.stringify({ institutionId }) });
}

export const isPlaidAccount = (id: string) => id.startsWith('plaid_');

/** 'sandbox' shows Plaid's test banks; 'production' connects real ones. */
export const PLAID_ENV = process.env.EXPO_PUBLIC_PLAID_ENV === 'production' ? 'production' : 'sandbox';
