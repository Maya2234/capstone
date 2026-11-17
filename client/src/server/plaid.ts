// Server only. Talks to Plaid with the secret, and encrypts access tokens before they're saved.

import type { Account, AccountType } from '@/data/types';

import { admin } from './supabaseAdmin';

const HOSTS = { sandbox: 'https://sandbox.plaid.com', production: 'https://production.plaid.com' } as const;

export class PlaidError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** POST to a Plaid endpoint with our credentials added. */
export async function plaid<T = Record<string, unknown>>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const id = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV ?? 'sandbox') as keyof typeof HOSTS;
  if (!id || !secret || !HOSTS[env]) throw new PlaidError('NOT_CONFIGURED', 'Plaid keys are not set in client/.env');
  const res = await fetch(HOSTS[env] + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: id, secret, ...body }),
  });
  const json = await res.json();
  if (!res.ok) {
    // Plaid's own error text, logged on the server only.
    console.warn(`[plaid] ${path} failed:`, json.error_code, json.error_message);
    throw new PlaidError(json.error_code ?? 'PLAID_ERROR', json.display_message ?? 'The bank connection didn’t work. Try again.');
  }
  return json as T;
}

// Access token encryption: AES-256-GCM with Web Crypto. Stored as base64 of iv (12 bytes)
// followed by the ciphertext (which ends in GCM's 16-byte tag, so tampering is caught).

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

let cryptoKey: Promise<CryptoKey> | null = null;
function key() {
  const raw = fromB64(process.env.PLAID_TOKEN_KEY ?? '');
  if (raw.length !== 32) throw new PlaidError('NOT_CONFIGURED', 'PLAID_TOKEN_KEY must be 32 bytes, base64');
  cryptoKey ??= crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return cryptoKey;
}

export async function encrypt(text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(text)));
  const out = new Uint8Array(iv.length + data.length);
  out.set(iv);
  out.set(data, iv.length);
  return toB64(out);
}

export async function decrypt(blob: string) {
  const raw = fromB64(blob);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, await key(), raw.subarray(12));
  return new TextDecoder().decode(plain);
}

// Plaid accounts in the app's shape ---------------------------------------------------------

type PlaidAccount = {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: { available?: number | null; current?: number | null; limit?: number | null };
};

function accountType(a: PlaidAccount): AccountType | null {
  if (a.type === 'credit') return 'credit';
  if (a.type === 'loan') return 'loan';
  if (a.type === 'investment' || a.type === 'brokerage') return 'investment';
  if (a.type === 'depository') return a.subtype === 'savings' || a.subtype === 'money market' || a.subtype === 'cd' ? 'savings' : 'checking';
  return null; // 'other' accounts aren't shown
}

const cents = (n?: number | null) => Math.round(Math.abs(n ?? 0) * 100);

export function toAccounts(list: PlaidAccount[], inst: { id: string; name: string }, linkedAt: string): Account[] {
  return list.flatMap((a) => {
    const type = accountType(a);
    if (!type) return [];
    const owed = type === 'credit' || type === 'loan';
    return [
      {
        id: 'plaid_' + a.account_id,
        institutionId: 'plaid_' + inst.id,
        institutionName: inst.name,
        name: a.name,
        type,
        mask: a.mask ?? '••••',
        balanceCents: cents(owed ? a.balances.current : (a.balances.available ?? a.balances.current)),
        ...(a.balances.limit != null ? { limitCents: cents(a.balances.limit) } : {}),
        linkedAt,
      },
    ];
  });
}

/** Accounts for one saved connection. */
export async function accountsForItem(row: { access_token_enc: string; institution_id: string | null; institution_name: string | null; created_at: string }) {
  const { accounts } = await plaid<{ accounts: PlaidAccount[] }>('/accounts/get', { access_token: await decrypt(row.access_token_enc) });
  return toAccounts(accounts, { id: row.institution_id ?? 'unknown', name: row.institution_name ?? 'Your bank' }, row.created_at);
}

/** Save a new connection for this user. */
export async function saveItem(userId: string, itemId: string, accessToken: string, inst: { id: string; name: string }) {
  const row = {
    user_id: userId,
    item_id: itemId,
    access_token_enc: await encrypt(accessToken),
    institution_id: inst.id,
    institution_name: inst.name,
    created_at: new Date().toISOString(),
  };
  const { error } = await admin().from('plaid_items').upsert(row);
  if (error) throw new Error('Couldn’t save the bank connection: ' + error.message);
  return row;
}

/** Turn any error into a JSON response the app can show. */
export function errorResponse(e: unknown) {
  if (e instanceof PlaidError) return Response.json({ error: e.message, code: e.code }, { status: e.code === 'NOT_CONFIGURED' ? 503 : 502 });
  console.warn('[plaid]', e instanceof Error ? e.message : e);
  return Response.json({ error: 'Something went wrong connecting your bank. Try again.' }, { status: 500 });
}
