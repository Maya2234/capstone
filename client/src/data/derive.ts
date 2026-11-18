import { useMemo } from 'react';

import type { CategoryId } from './categories';
import { demoTransactions } from './demo';
import { useStore } from './store';
import type { Account, AccountType, Transaction } from './types';

export const isLiability = (t: AccountType) => t === 'credit' || t === 'loan';

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
 * An account's transactions, newest first. Plaid accounts use the synced ones from the store
 * (pass them in); demo bank accounts generate sample history.
 */
export function transactionsFor(a: Account, synced: Transaction[]): Transaction[] {
  return a.id.startsWith('plaid_') ? synced.filter((t) => t.accountId === a.id) : demoTransactions(a);
}

/** One account's transactions, kept up to date as the store changes. */
export function useTransactions(a: Account | undefined): Transaction[] {
  const synced = useStore((s) => s.transactions);
  return useMemo(() => (a ? transactionsFor(a, synced) : []), [a, synced]);
}

/** Card and cash spending this calendar month, by category (excludes payments, rent, transfers in). */
export function useMonthSpending() {
  const accounts = useStore((s) => s.accounts);
  const synced = useStore((s) => s.transactions);
  return useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();
    const by = new Map<CategoryId, number>();
    let total = 0;
    for (const a of accounts) {
      if (a.type !== 'credit' && a.type !== 'checking') continue;
      for (const t of transactionsFor(a, synced)) {
        if (t.date < startIso || t.amountCents <= 0 || t.transfer) continue;
        if (t.merchant === 'Card payment' || t.merchant === 'Venmo') continue; // demo bank stand-ins for transfers
        by.set(t.category, (by.get(t.category) ?? 0) + t.amountCents);
        total += t.amountCents;
      }
    }
    const rows = [...by.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
    return { total, rows, byCategory: by };
  }, [accounts, synced]);
}
