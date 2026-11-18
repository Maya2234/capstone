import { useMemo } from 'react';

import { landing } from './spendCategories';
import { demoTransactions } from './demo';
import { useStore } from './store';
import { product, shortName } from './catalog';
import type { Account, AccountType, SpendCategory, Transaction, WalletCard } from './types';

export const isLiability = (t: AccountType) => t === 'credit' || t === 'loan';

/**
 * What to call an account: your nickname for its card, else the card's real name once it's
 * known ("Sapphire Preferred"), else whatever the bank calls it (often just "CREDIT CARD").
 */
export function accountTitle(a: Account, cards: WalletCard[]): string {
  const card = cards.find((c) => c.accountId === a.id);
  if (card?.nickname) return card.nickname;
  const p = a.productId ? product(a.productId) : undefined;
  return p ? shortName(p) : a.name;
}

/** accountTitle, kept up to date. */
export function useAccountTitle(a: Account | undefined): string {
  const cards = useStore((s) => s.cards);
  return a ? accountTitle(a, cards) : '';
}

export const GROUPS: { key: string; label: string; types: AccountType[] }[] = [
  { key: 'cash', label: 'Cash', types: ['checking', 'savings'] },
  { key: 'credit', label: 'Credit cards', types: ['credit'] },
  { key: 'investments', label: 'Investments', types: ['investment'] },
  { key: 'loans', label: 'Loans', types: ['loan'] },
];

export function useNetWorth() {
  const accounts = useStore((s) => s.accounts);
  return useMemo(() => {
    let assets = 0;
    let debts = 0;
    for (const a of accounts) {
      if (isLiability(a.type)) debts += a.balanceCents;
      else assets += a.balanceCents;
    }
    return { assets, debts, net: assets - debts };
  }, [accounts]);
}

/**
 * An account's transactions, newest first, with each merchant's purchases in one category
 * (see useMerchantCategories). Plaid accounts use the synced ones from the store; demo bank
 * accounts generate sample history.
 */
export function transactionsFor(a: Account, synced: Transaction[], choices: CategoryChoices = NO_CHOICES): Transaction[] {
  return withCategories(rawTransactionsFor(a, synced), choices);
}

function rawTransactionsFor(a: Account, synced: Transaction[]): Transaction[] {
  return a.id.startsWith('plaid_') ? synced.filter((t) => t.accountId === a.id) : demoTransactions(a);
}

/** One account's transactions, kept up to date as the store changes. */
export function useTransactions(a: Account | undefined): Transaction[] {
  const synced = useStore((s) => s.transactions);
  const choices = useCategoryChoices();
  return useMemo(() => (a ? transactionsFor(a, synced, choices) : []), [a, synced, choices]);
}

// Categories ---------------------------------------------------------------------------------
// Banks sort every purchase on its own, so one shop can land in three categories. CardMaxx
// puts all of a merchant's purchases in one: the category the bank used most for it, unless
// the user picked one for the merchant (prefs.merchantCategories). A category picked for a
// single transaction (prefs.transactionCategories) beats both.

/** Transaction id → the category the user picked for just that transaction. */
export type PickedCategories = Partial<Record<string, SpendCategory>>;

/** Everything that decides a transaction's category, besides what the bank said. */
export type CategoryChoices = {
  merchants: MerchantCategories;
  picked: PickedCategories;
  /** Turned-off and deleted categories land in Everything else. */
  place: (c: SpendCategory) => SpendCategory;
};
const NO_CHOICES: CategoryChoices = { merchants: new Map(), picked: {}, place: (c) => c };

/** The user's category choices, kept up to date. */
export function useCategoryChoices(): CategoryChoices {
  const merchants = useMerchantCategories();
  const picked = useStore((s) => s.prefs.transactionCategories);
  const customs = useStore((s) => s.prefs.customCategories);
  const hidden = useStore((s) => s.prefs.hiddenCategories);
  return useMemo(() => ({ merchants, picked, place: (c: SpendCategory) => landing(c, customs, hidden) }), [merchants, picked, customs, hidden]);
}

/** merchantKey → the category every purchase there goes in. */
export type MerchantCategories = Map<string, { category: SpendCategory; chosen: boolean }>;

/**
 * One name per merchant however the bank spells it: case, punctuation and store numbers
 * ("#1234") are ignored, so "KROGER #512" and "Kroger" match.
 */
export const merchantKey = (merchant: string) =>
  merchant.toLowerCase().replace(/#\s*\d+/g, '').replace(/[^a-z0-9]+/g, ' ').trim() || merchant.toLowerCase();

/** A merchant's name for display, without store numbers. */
export const merchantName = (merchant: string) => merchant.replace(/\s*#\s*\d+/g, '').trim() || merchant;

/** Purchases count; refunds, payments and transfers keep whatever the bank said. */
const isPurchase = (t: Transaction) => t.amountCents > 0 && !t.transfer;

/**
 * Each merchant's category across all accounts and all history. Automatic: the category the
 * bank gave most of its purchases (ties go to more money spent), ignoring "Everything else"
 * unless that's all there is, since it means the bank wasn't sure.
 */
export function merchantCategories(all: Transaction[], chosen: Partial<Record<string, SpendCategory>>): MerchantCategories {
  const tally = new Map<string, Map<SpendCategory, { count: number; cents: number }>>();
  for (const t of all) {
    if (!isPurchase(t)) continue;
    const key = merchantKey(t.merchant);
    const byCat = tally.get(key) ?? new Map();
    const c = byCat.get(t.category) ?? { count: 0, cents: 0 };
    c.count += 1;
    c.cents += t.amountCents;
    byCat.set(t.category, c);
    tally.set(key, byCat);
  }
  const out: MerchantCategories = new Map();
  for (const [key, byCat] of tally) {
    const ranked = [...byCat.entries()]
      .filter(([cat]) => cat !== 'general' || byCat.size === 1)
      .sort(([, a], [, b]) => b.count - a.count || b.cents - a.cents);
    out.set(key, { category: ranked[0][0], chosen: false });
  }
  for (const [key, category] of Object.entries(chosen)) if (category) out.set(key, { category, chosen: true });
  return out;
}

/** The merchant categories for everything the user has, kept up to date. */
export function useMerchantCategories(): MerchantCategories {
  const accounts = useStore((s) => s.accounts);
  const synced = useStore((s) => s.transactions);
  const chosen = useStore((s) => s.prefs.merchantCategories);
  return useMemo(() => merchantCategories(accounts.flatMap((a) => rawTransactionsFor(a, synced)), chosen), [accounts, synced, chosen]);
}

function withCategories(list: Transaction[], { merchants, picked, place }: CategoryChoices): Transaction[] {
  return list.map((t) => {
    const c = place(picked[t.id] ?? (isPurchase(t) ? merchants.get(merchantKey(t.merchant))?.category : undefined) ?? t.category);
    return c !== t.category ? { ...t, category: c } : t;
  });
}

// Periods ------------------------------------------------------------------------------------
// Spending can be looked at a month or a week at a time. A period is a string key: a month is
// "YYYY-MM", a week is "YYYY-MM-DD", the Sunday it starts on. Both sort in time order as text.

export type PeriodKind = 'month' | 'week';

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isWeekKey = (key: string) => key.length === 10;
const parseDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d ?? 1);
};

/** A calendar month as "YYYY-MM", in the user's own time zone. */
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** The week (Sunday to Saturday) a date falls in, as its Sunday's "YYYY-MM-DD". */
export const weekKey = (d = new Date()) => dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));

/** The period of a kind that a date falls in (today by default). */
export const periodKey = (kind: PeriodKind, d = new Date()) => (kind === 'week' ? weekKey(d) : monthKey(d));

export const periodKind = (key: string): PeriodKind => (isWeekKey(key) ? 'week' : 'month');

/** True for a well-formed period key, e.g. from a link. */
export const isPeriodKey = (key: string | undefined): key is string => !!key && /^\d{4}-\d{2}(-\d{2})?$/.test(key);

/** First moment of a period, and of the one after it. */
function periodRange(key: string) {
  const first = parseDay(key);
  const next = isWeekKey(key) ? new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7) : new Date(first.getFullYear(), first.getMonth() + 1, 1);
  return { start: first.toISOString(), end: next.toISOString() };
}

/** "November" / "November 2025"; weeks as "Nov 16 – 22" or "Oct 27 – Nov 2" (with the year if it isn't this one). */
export function periodLabel(key: string) {
  const first = parseDay(key);
  const thisYear = first.getFullYear() === new Date().getFullYear();
  if (!isWeekKey(key)) return first.toLocaleDateString('en-US', thisYear ? { month: 'long' } : { month: 'long', year: 'numeric' });
  const last = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 6);
  const from = first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const to = last.getMonth() === first.getMonth() ? String(last.getDate()) : last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${from} – ${to}${thisYear ? '' : `, ${last.getFullYear()}`}`;
}

/** "in November", "this week", "the week of Nov 16 – 22": for sentences. */
export function periodPhrase(key: string) {
  if (!isWeekKey(key)) return `in ${periodLabel(key)}`;
  return key === weekKey() ? 'this week' : `the week of ${periodLabel(key)}`;
}

/** The period before or after. */
export function shiftPeriod(key: string, by: number) {
  const first = parseDay(key);
  return isWeekKey(key)
    ? dateKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7 * by))
    : monthKey(new Date(first.getFullYear(), first.getMonth() + by, 1));
}

/** Kept for older callers: a month's label. */
export const monthLabel = periodLabel;

/**
 * Card and cash spending in one period (this month by default), by category. Leaves out
 * payments, transfers and money coming in. `earliest` is the oldest period of the same kind
 * that has spending, so screens know how far back to offer.
 */
export function useMonthSpending(period: string = monthKey()) {
  const accounts = useStore((s) => s.accounts);
  const synced = useStore((s) => s.transactions);
  const choices = useCategoryChoices();
  return useMemo(() => {
    const { start, end } = periodRange(period);
    const kind = periodKind(period);
    const by = new Map<SpendCategory, number>();
    const items: SpendingItem[] = [];
    let earliest = periodKey(kind);
    let total = 0;
    for (const a of accounts) {
      if (a.type !== 'credit' && a.type !== 'checking') continue;
      for (const t of transactionsFor(a, synced, choices)) {
        if (t.amountCents <= 0 || t.transfer) continue;
        if (t.merchant === 'Card payment' || t.merchant === 'Venmo') continue; // demo bank stand-ins for transfers
        const p = periodKey(kind, new Date(t.date));
        if (p < earliest) earliest = p;
        if (t.date < start || t.date >= end) continue;
        by.set(t.category, (by.get(t.category) ?? 0) + t.amountCents);
        items.push({ ...t, accountName: a.mask ? `${a.name} ••${a.mask}` : a.name });
        total += t.amountCents;
      }
    }
    const rows = [...by.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
    // The chart names the biggest categories; "Everything else" is folded into Other so it never shows two grey slices.
    const top = rows.filter((r) => r.category !== 'general').slice(0, TOP_CATEGORIES);
    const topSet = new Set(top.map((r) => r.category));
    items.sort((x, y) => y.date.localeCompare(x.date));
    return {
      total,
      rows,
      top,
      isOther: (c: SpendCategory) => !topSet.has(c),
      byCategory: by,
      items,
      earliest,
    };
  }, [accounts, synced, choices, period]);
}

/** Spending grouped by merchant (matched with merchantKey), biggest first. */
export function byMerchant(items: SpendingItem[]) {
  const groups = new Map<string, { key: string; name: string; cents: number; count: number }>();
  for (const x of items) {
    const key = merchantKey(x.merchant);
    const g = groups.get(key);
    if (g) {
      g.cents += x.amountCents;
      g.count += 1;
    } else groups.set(key, { key, name: merchantName(x.merchant), cents: x.amountCents, count: 1 });
  }
  return [...groups.values()].sort((a, b) => b.cents - a.cents);
}

/** How many categories the Home chart names before lumping the rest into Other. */
const TOP_CATEGORIES = 5;

/** A transaction counted as spending, with the account it came from. */
export type SpendingItem = Transaction & { accountName: string };
