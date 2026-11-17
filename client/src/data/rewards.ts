import { CATEGORIES, WALLET_CATEGORIES, type CategoryId } from './categories';
import { rate } from '@/lib/format';

import { centsPerDollar, earnRate, isCash, PRODUCTS, product, type Product } from './catalog';
import type { WalletCard } from './types';

export type Pick = { card: WalletCard; product: Product; rate: number; centsPerDollar: number };

/**
 * Best enabled card for a category: highest value per dollar, ties go to the card added first.
 * Same rule the checkout uses (Technical Specification, card selection).
 */
export function bestCard(category: CategoryId, cards: WalletCard[]): Pick | null {
  let best: Pick | null = null;
  for (const card of cards) {
    if (!card.enabled) continue;
    const p = product(card.productId);
    if (!p) continue;
    const cpd = centsPerDollar(p, category);
    if (!best || cpd > best.centsPerDollar || (cpd === best.centsPerDollar && card.addedAt < best.card.addedAt)) {
      best = { card, product: p, rate: earnRate(p, category), centsPerDollar: cpd };
    }
  }
  return best;
}

export function pickForPurchase(category: CategoryId, amountCents: number, cards: WalletCard[]) {
  const b = bestCard(category, cards);
  if (!b) return null;
  return {
    card: b.card,
    rewardCents: Math.round((amountCents / 100) * b.centsPerDollar),
    rateLabel: rate(b.rate, isCash(b.product)),
  };
}

export type Suggestion = { category: CategoryId; product: Product; centsPerDollar: number; currentCentsPerDollar: number };

/**
 * Cards from the catalog that would beat your current best in a category by at least 1¢ per dollar.
 * One suggestion per product, strongest gains first.
 */
export function suggestions(cards: WalletCard[], limit = 3): Suggestion[] {
  const owned = new Set(cards.map((c) => c.productId));
  const found: Suggestion[] = [];
  for (const category of WALLET_CATEGORIES) {
    if (category === 'general') continue;
    const current = bestCard(category, cards)?.centsPerDollar ?? 0;
    let top: Product | null = null;
    let topCpd = 0;
    for (const p of PRODUCTS) {
      if (owned.has(p.id)) continue;
      // Favor everyday cards: skip anything with a fee over $150 or a value we're not sure of.
      if (p.annualFeeCents > 15000 || p.confidence === 'low') continue;
      const cpd = centsPerDollar(p, category);
      if (cpd > topCpd || (cpd === topCpd && top && p.annualFeeCents < top.annualFeeCents)) {
        top = p;
        topCpd = cpd;
      }
    }
    if (top && topCpd - current >= 1) found.push({ category, product: top, centsPerDollar: topCpd, currentCentsPerDollar: current });
  }
  found.sort((a, b) => b.centsPerDollar - b.currentCentsPerDollar - (a.centsPerDollar - a.currentCentsPerDollar));
  const seen = new Set<string>();
  return found.filter((s) => (seen.has(s.product.id) ? false : (seen.add(s.product.id), true))).slice(0, limit);
}

export function categoryLabel(c: CategoryId) {
  return CATEGORIES[c].label;
}
