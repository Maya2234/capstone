// Reads and writes the signed-in user's rows (tables in supabase/schema.sql).
// Row level security scopes every query to the caller, but writes still set user_id.

import type { CategoryId } from '@/data/categories';
import type { Account, Budget, Prefs, Profile, Purchase, SpendCategory, Transaction, WalletCard } from '@/data/types';
import { supabase } from '@/lib/supabase';

export type UserData = {
  profile: Profile;
  prefs: Partial<Prefs>;
  accounts: Account[];
  cards: WalletCard[];
  budgets: Budget[];
  purchases: Purchase[];
  transactions: Transaction[];
};

// Row shapes -----------------------------------------------------------------------------

const profileRow = (userId: string, p: Profile, prefs?: Prefs) => ({
  id: userId,
  name: p.name,
  username: p.username,
  email: p.email,
  phone: p.phone,
  photo_uri: p.photoUri ?? null,
  ...(prefs ? { prefs } : {}),
});

const accountRow = (userId: string, a: Account) => ({
  user_id: userId,
  id: a.id,
  institution_id: a.institutionId,
  institution_name: a.institutionName ?? null,
  name: a.name,
  type: a.type,
  mask: a.mask,
  balance_cents: a.balanceCents,
  limit_cents: a.limitCents ?? null,
  product_id: a.productId ?? null,
  linked_at: a.linkedAt,
});

const cardRow = (userId: string, c: WalletCard) => ({
  user_id: userId,
  id: c.id,
  product_id: c.productId,
  mask: c.mask,
  nickname: c.nickname ?? null,
  account_id: c.accountId ?? null,
  enabled: c.enabled,
  added_at: c.addedAt,
});

const purchaseRow = (userId: string, p: Purchase) => ({
  user_id: userId,
  id: p.id,
  date: p.date,
  merchant: p.merchant,
  category: p.category,
  amount_cents: p.amountCents,
  card_id: p.cardId,
  reward_cents: p.rewardCents,
  rate_label: p.rateLabel,
  status: p.status,
});

// Postgres hands bigint and nullable columns back loosely; normalize to the app's types.
const toAccount = (r: any): Account => ({
  id: r.id,
  institutionId: r.institution_id,
  ...(r.institution_name ? { institutionName: r.institution_name } : {}),
  name: r.name,
  type: r.type,
  mask: r.mask,
  balanceCents: Number(r.balance_cents),
  ...(r.limit_cents != null ? { limitCents: Number(r.limit_cents) } : {}),
  ...(r.product_id ? { productId: r.product_id } : {}),
  linkedAt: r.linked_at,
});

const toCard = (r: any): WalletCard => ({
  id: r.id,
  productId: r.product_id,
  mask: r.mask,
  ...(r.nickname ? { nickname: r.nickname } : {}),
  ...(r.account_id ? { accountId: r.account_id } : {}),
  enabled: r.enabled,
  addedAt: r.added_at,
});

const toPurchase = (r: any): Purchase => ({
  id: r.id,
  date: r.date,
  merchant: r.merchant,
  category: r.category,
  amountCents: Number(r.amount_cents),
  cardId: r.card_id,
  rewardCents: Number(r.reward_cents),
  rateLabel: r.rate_label,
  status: r.status,
});

const toTransaction = (r: any): Transaction => ({
  id: r.id,
  accountId: r.account_id,
  date: r.date,
  merchant: r.merchant,
  category: r.category,
  amountCents: Number(r.amount_cents),
  ...(r.pending ? { pending: true } : {}),
  ...(r.transfer ? { transfer: true } : {}),
});

function check<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw new Error(res.error.message);
  return res;
}

// Loading and first-time setup -----------------------------------------------------------

/** Everything for this user, or null if they have no profile yet (first sign-in). */
export async function loadUserData(userId: string): Promise<UserData | null> {
  const [profile, accounts, cards, budgets, purchases] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('accounts').select('*').order('linked_at'),
    supabase.from('user_cards').select('*').order('added_at'),
    supabase.from('budgets').select('*'),
    supabase.from('purchases').select('*').order('date', { ascending: false }),
  ]).then((all) => all.map(check));

  const p = profile.data;
  if (!p) return null;
  // Missing table (003_transactions.sql not run yet) shouldn't lock anyone out.
  const transactions = await loadTransactions().catch((e) => {
    console.warn('[CardMaxx] Couldn’t load transactions:', e instanceof Error ? e.message : e);
    return [];
  });
  return {
    profile: { name: p.name, username: p.username, email: p.email, phone: p.phone, ...(p.photo_uri ? { photoUri: p.photo_uri } : {}) },
    prefs: p.prefs ?? {},
    accounts: (accounts.data ?? []).map(toAccount),
    cards: (cards.data ?? []).map(toCard),
    budgets: (budgets.data ?? []).map((b: { category: string; limit_cents: number }) => ({ category: b.category as CategoryId, limitCents: Number(b.limit_cents) })),
    purchases: (purchases.data ?? []).map(toPurchase),
    transactions,
  };
}

/**
 * Bank transactions (written by the server's Plaid sync; the app only reads them), newest first.
 * Supabase returns at most 1,000 rows per request, so this pages through.
 */
export async function loadTransactions(): Promise<Transaction[]> {
  const out: Transaction[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = check(await supabase.from('transactions').select('*').order('date', { ascending: false }).range(from, from + PAGE - 1));
    out.push(...(data ?? []).map(toTransaction));
    if (!data || data.length < PAGE) return out;
  }
}

/** Save a brand-new user's starter data. The profile goes last, so a half-finished setup retries. */
export async function createUserData(userId: string, d: UserData & { prefs: Prefs }) {
  await Promise.all([
    d.accounts.length ? supabase.from('accounts').upsert(d.accounts.map((a) => accountRow(userId, a))).then(check) : null,
    d.cards.length ? supabase.from('user_cards').upsert(d.cards.map((c) => cardRow(userId, c))).then(check) : null,
    d.budgets.length
      ? supabase.from('budgets').upsert(d.budgets.map((b) => ({ user_id: userId, category: b.category, limit_cents: b.limitCents }))).then(check)
      : null,
    d.purchases.length ? supabase.from('purchases').upsert(d.purchases.map((p) => purchaseRow(userId, p))).then(check) : null,
  ]);
  check(await supabase.from('profiles').upsert(profileRow(userId, d.profile, d.prefs)));
}

// Single changes from the store -----------------------------------------------------------

export const db = {
  saveProfile: async (userId: string, p: Profile) => check(await supabase.from('profiles').upsert(profileRow(userId, p))),
  savePrefs: async (userId: string, prefs: Prefs) => check(await supabase.from('profiles').update({ prefs }).eq('id', userId)),

  saveAccounts: async (userId: string, accounts: Account[]) =>
    accounts.length && check(await supabase.from('accounts').upsert(accounts.map((a) => accountRow(userId, a)))),
  deleteAccounts: async (ids: string[]) => ids.length && check(await supabase.from('accounts').delete().in('id', ids)),

  saveCards: async (userId: string, cards: WalletCard[]) =>
    cards.length && check(await supabase.from('user_cards').upsert(cards.map((c) => cardRow(userId, c)))),
  deleteCards: async (ids: string[]) => ids.length && check(await supabase.from('user_cards').delete().in('id', ids)),

  saveBudget: async (userId: string, b: Budget) =>
    check(await supabase.from('budgets').upsert({ user_id: userId, category: b.category, limit_cents: b.limitCents })),
  deleteBudget: async (category: SpendCategory) => check(await supabase.from('budgets').delete().eq('category', category)),
};
