// Server only. Talks to Plaid with the secret, and encrypts access tokens before they're saved.

import { matchProduct } from '@/data/catalog';
import type { CategoryId } from '@/data/categories';
import type { Account, AccountType } from '@/data/types';

import { admin } from './supabaseAdmin';

const HOSTS = { sandbox: 'https://sandbox.plaid.com', production: 'https://production.plaid.com' } as const;

export class PlaidError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** 'sandbox' (fake banks) or 'production' (real banks, including Plaid's free Trial plan). */
export function plaidEnv() {
  return (process.env.EXPO_PUBLIC_PLAID_ENV ?? process.env.PLAID_ENV ?? 'sandbox') as keyof typeof HOSTS;
}

/** POST to a Plaid endpoint with our credentials added. */
export async function plaid<T = Record<string, unknown>>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const id = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = plaidEnv();
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
const optional = <K extends string, V>(k: K, v: V | undefined) => (v === undefined ? {} : ({ [k]: v } as Record<K, V>));

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
        ...(type === 'credit' ? optional('productId', matchProduct(a.name, a.official_name, inst.name)) : {}),
        linkedAt,
      },
    ];
  });
}

export type ItemRow = {
  item_id: string;
  access_token_enc: string;
  institution_id: string | null;
  institution_name: string | null;
  created_at: string;
  sync_cursor?: string | null;
};

export const ITEM_COLUMNS = 'item_id, access_token_enc, institution_id, institution_name, created_at, sync_cursor';

/** Accounts for one saved connection. */
export async function accountsForItem(row: ItemRow) {
  const { accounts } = await plaid<{ accounts: PlaidAccount[] }>('/accounts/get', { access_token: await decrypt(row.access_token_enc) });
  return toAccounts(accounts, { id: row.institution_id ?? 'unknown', name: row.institution_name ?? 'Your bank' }, row.created_at);
}

/** Save a new connection for this user. */
export async function saveItem(userId: string, itemId: string, accessToken: string, inst: { id: string; name: string }): Promise<ItemRow> {
  const row = {
    user_id: userId,
    item_id: itemId,
    access_token_enc: await encrypt(accessToken),
    institution_id: inst.id,
    institution_name: inst.name,
    created_at: new Date().toISOString(),
    sync_cursor: null,
  };
  const { error } = await admin().from('plaid_items').upsert(row);
  if (error) throw new Error('Couldn’t save the bank connection: ' + error.message);
  return row;
}

/** Every bank connection the user has. */
export async function itemsFor(userId: string): Promise<ItemRow[]> {
  const { data, error } = await admin().from('plaid_items').select(ITEM_COLUMNS).eq('user_id', userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Transactions --------------------------------------------------------------------------

type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  amount: number; // positive = money out, same as the app
  date: string; // YYYY-MM-DD
  datetime?: string | null;
  authorized_datetime?: string | null;
  name: string;
  merchant_name?: string | null;
  pending: boolean;
  personal_finance_category?: { primary: string; detailed: string } | null;
};

/** Plaid's spending categories mapped onto the ones card rewards use. */
function category(pfc: PlaidTransaction['personal_finance_category']): { category: CategoryId; transfer: boolean } {
  const p = pfc?.primary ?? '';
  const d = pfc?.detailed ?? '';
  const of = (category: CategoryId) => ({ category, transfer: false });
  if (['INCOME', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS'].includes(p)) return { category: 'general', transfer: true };
  if (d === 'FOOD_AND_DRINK_GROCERIES') return of('groceries');
  if (p === 'FOOD_AND_DRINK') return of('dining');
  if (d === 'TRANSPORTATION_GAS') return of('gas');
  if (p === 'TRANSPORTATION') return of('transit');
  if (d === 'TRAVEL_FLIGHTS') return of('flights');
  if (d === 'TRAVEL_LODGING') return of('hotels');
  if (d === 'TRAVEL_RENTAL_CARS') return of('car_rental');
  if (p === 'TRAVEL') return of('travel');
  if (d === 'ENTERTAINMENT_TV_AND_MOVIES' || d === 'ENTERTAINMENT_MUSIC_AND_AUDIO') return of('streaming');
  if (p === 'ENTERTAINMENT') return of('entertainment');
  if (d === 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS') return of('drugstore');
  if (d === 'RENT_AND_UTILITIES_RENT') return of('rent');
  if (d === 'RENT_AND_UTILITIES_TELEPHONE') return of('phone');
  if (p === 'HOME_IMPROVEMENT') return of('home_improvement');
  if (d === 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES' || d === 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES') return of('online_retail');
  if (d === 'GENERAL_MERCHANDISE_WAREHOUSE_CLUBS' || d === 'GENERAL_MERCHANDISE_SUPERSTORES') return of('wholesale_club');
  return of('general');
}

function transactionRow(userId: string, itemId: string, t: PlaidTransaction) {
  return {
    user_id: userId,
    id: 'plaid_' + t.transaction_id,
    account_id: 'plaid_' + t.account_id,
    item_id: itemId,
    date: t.datetime ?? t.authorized_datetime ?? t.date + 'T12:00:00Z',
    merchant: t.merchant_name || t.name,
    amount_cents: Math.round(t.amount * 100),
    pending: t.pending,
    ...category(t.personal_finance_category),
  };
}

type SyncPage = {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string }[];
  next_cursor: string;
  has_more: boolean;
};

/**
 * Bring one connection's transactions up to date with /transactions/sync and save them.
 * Only what changed since the saved cursor comes back, so this is cheap to call often.
 * Right after linking, Plaid may still be fetching history; that sync returns nothing
 * and the next one picks it up.
 */
export async function syncTransactions(userId: string, row: ItemRow) {
  const access_token = await decrypt(row.access_token_enc);
  const start = row.sync_cursor ?? undefined;

  async function pull() {
    let cursor = start;
    const upserts: PlaidTransaction[] = [];
    const removed: string[] = [];
    for (;;) {
      const page = await plaid<SyncPage>('/transactions/sync', { access_token, count: 500, ...(cursor ? { cursor } : {}) });
      upserts.push(...page.added, ...page.modified);
      removed.push(...page.removed.map((r) => 'plaid_' + r.transaction_id));
      cursor = page.next_cursor;
      if (!page.has_more) return { upserts, removed, cursor };
    }
  }

  let result;
  try {
    result = await pull();
  } catch (e) {
    // Plaid asks to restart from the first cursor if data changed mid-way through the pages.
    if (e instanceof PlaidError && e.code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') result = await pull();
    else throw e;
  }

  const db = admin();
  const rows = result.upserts.map((t) => transactionRow(userId, row.item_id, t));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('transactions').upsert(rows.slice(i, i + 500));
    if (error) throw new Error('Couldn’t save transactions: ' + error.message);
  }
  if (result.removed.length) {
    const { error } = await db.from('transactions').delete().eq('user_id', userId).in('id', result.removed);
    if (error) throw new Error(error.message);
  }
  if (result.cursor !== row.sync_cursor) {
    const { error } = await db.from('plaid_items').update({ sync_cursor: result.cursor }).eq('user_id', userId).eq('item_id', row.item_id);
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

/** Disconnect a bank: tell Plaid to revoke access, then forget the token and its transactions. */
export async function removeItem(userId: string, row: ItemRow) {
  try {
    await plaid('/item/remove', { access_token: await decrypt(row.access_token_enc) });
  } catch (e) {
    // Already gone at Plaid's end: still clean up ours.
    if (!(e instanceof PlaidError && (e.code === 'ITEM_NOT_FOUND' || e.code === 'INVALID_ACCESS_TOKEN'))) throw e;
  }
  const db = admin();
  const tx = await db.from('transactions').delete().eq('user_id', userId).eq('item_id', row.item_id);
  if (tx.error) throw new Error(tx.error.message);
  const item = await db.from('plaid_items').delete().eq('user_id', userId).eq('item_id', row.item_id);
  if (item.error) throw new Error(item.error.message);
}

/** Turn any error into a JSON response the app can show. */
export function errorResponse(e: unknown) {
  if (e instanceof PlaidError) return Response.json({ error: e.message, code: e.code }, { status: e.code === 'NOT_CONFIGURED' ? 503 : 502 });
  console.warn('[plaid]', e instanceof Error ? e.message : e);
  return Response.json({ error: 'Something went wrong connecting your bank. Try again.' }, { status: 500 });
}
