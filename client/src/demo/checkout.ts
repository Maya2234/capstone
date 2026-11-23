// Cart and card ranking for the demo stores. The cart lives in memory only (nothing is saved or
// charged); the ranking is the same reward maths the real app uses for "best card".

import { create } from 'zustand';

import type { CategoryId } from '@/data/categories';
import { centsPerDollar, earnRate, isCash, product, type Product } from '@/data/catalog';
import type { WalletCard } from '@/data/types';
import { rate } from '@/lib/format';

import { findProduct, type DemoStore } from './stores';

type Cart = Record<string, number>; // product id → quantity

type CartState = {
  carts: Record<string, Cart>; // store id → cart
  add: (storeId: string, productId: string) => void;
  remove: (storeId: string, productId: string) => void;
  clear: (storeId: string) => void;
};

export const useDemoCart = create<CartState>((set) => ({
  carts: {},
  add: (s, p) => set((st) => ({ carts: { ...st.carts, [s]: { ...st.carts[s], [p]: (st.carts[s]?.[p] ?? 0) + 1 } } })),
  remove: (s, p) =>
    set((st) => {
      const next = { ...st.carts[s] };
      if ((next[p] ?? 0) <= 1) delete next[p];
      else next[p] -= 1;
      return { carts: { ...st.carts, [s]: next } };
    }),
  clear: (s) => set((st) => ({ carts: { ...st.carts, [s]: {} } })),
}));

/** Lines, item count and totals for a store's cart. */
export function cartSummary(s: DemoStore, cart: Cart = {}) {
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: findProduct(s, id)!, qty }))
    .filter((l) => l.product && l.qty > 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotalCents = lines.reduce((n, l) => n + l.product.priceCents * l.qty, 0);
  const feeCents = count ? s.feeCents : 0;
  return { lines, count, subtotalCents, feeCents, totalCents: subtotalCents + feeCents };
}

export type RankedCard = { card: WalletCard; product: Product; rateLabel: string; rewardCents: number; centsPerDollar: number; sample: boolean };

/** What a card would earn, for one purchase. */
function score(card: WalletCard, category: CategoryId, amountCents: number, sample: boolean): RankedCard {
  const p = product(card.productId)!;
  const cpd = centsPerDollar(p, category);
  return { card, product: p, rateLabel: rate(earnRate(p, category), isCash(p)), centsPerDollar: cpd, rewardCents: Math.round((amountCents / 100) * cpd), sample };
}

/**
 * If the Wallet is empty, the demo still works with two well-known sample cards, so it can be
 * shown on any account. They're labelled as samples on screen.
 */
const SAMPLE: WalletCard[] = [
  { id: 'sample-csp', productId: 'chase-sapphire-preferred', mask: '1234', enabled: true, addedAt: '2026-01-01T00:00:00Z' },
  { id: 'sample-cfu', productId: 'chase-freedom-unlimited', mask: '5678', enabled: true, addedAt: '2026-01-02T00:00:00Z' },
];

/** Every usable card, best first for this purchase: most rewards, ties to the card added first. */
export function rankCards(category: CategoryId, amountCents: number, wallet: WalletCard[]): RankedCard[] {
  const usable = wallet.filter((c) => c.enabled && product(c.productId));
  const sample = usable.length === 0;
  return (sample ? SAMPLE : usable)
    .map((card) => score(card, category, amountCents, sample))
    .sort((a, b) => b.centsPerDollar - a.centsPerDollar || a.card.addedAt.localeCompare(b.card.addedAt));
}

/** Cards in the Wallet that are switched off: shown, greyed out, so it's clear why they weren't picked. */
export function turnedOffCards(category: CategoryId, amountCents: number, wallet: WalletCard[]): RankedCard[] {
  return wallet.filter((c) => !c.enabled && product(c.productId)).map((card) => score(card, category, amountCents, false));
}
