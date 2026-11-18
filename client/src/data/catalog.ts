import raw from './card_products.json';
import type { CategoryId } from './categories';

export type Rule = { category: string; rate: number; capCents?: number; capPeriod?: string; note?: string };
export type Product = {
  id: string;
  name: string;
  issuer: string;
  network: string;
  annualFeeCents: number;
  rewardType: 'points' | 'miles' | 'cashback';
  currency: string;
  pointValueCents: number;
  baseRate: number;
  rules: Rule[];
  rotating?: { rate: number; capCents: number; capPeriod: string; requiresActivation?: boolean };
  choiceCategory?: { rate: number; default: string; options: string[]; capCents?: number; capPeriod?: string };
  topCategory?: { rate: number; eligible: string[]; capCents?: number; capPeriod?: string };
  sourceUrl: string;
  confidence: string;
};

export const CATALOG_AS_OF: string = raw.asOf;
export const PRODUCTS = raw.products as unknown as Product[];
const byId = new Map(PRODUCTS.map((p) => [p.id, p]));

export function product(id: string): Product | undefined {
  return byId.get(id);
}

export const isCash = (p: Product) => p.rewardType === 'cashback';

/** "American Express Gold Card" -> "Gold Card", "Citi Double Cash Card" -> "Double Cash". */
export function shortName(p: Product) {
  const n = p.name.startsWith(p.issuer + ' ') ? p.name.slice(p.issuer.length + 1) : p.name;
  return n.replace(/ Card$/, '').replace(/^Card$/, p.name);
}

// Matching a bank's account name to the catalog ------------------------------------------

const STOP = new Set(['the', 'card', 'from', 'by', 'credit', 'visa', 'mastercard', 'signature', 'world', 'elite']);
const words = (s: string) =>
  s.toLowerCase().replace(/[®™℠]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((w) => w && !STOP.has(w));

const GENERIC = new Set(['bank', 'of', 'online', 'na', 'us', 'u', 's', 'financial', 'services']);

/**
 * Catalog cards issued by a bank, from the bank's name as Plaid gives it ("Chase",
 * "Citibank Online", "Bank of America"), for suggesting which card an account is.
 */
export function productsForBank(institutionName: string | undefined): Product[] {
  if (!institutionName) return [];
  const have = new Set(words(institutionName).filter((w) => !GENERIC.has(w)));
  const compact = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const bank = compact(institutionName);
  return PRODUCTS.filter((p) => {
    const issuer = words(p.issuer).filter((w) => !GENERIC.has(w));
    // Every distinctive word of the issuer ("capital one" in "Capital One N.A."), or the issuer
    // at the start of the bank's name with spacing ignored ("Citi" in "Citibank Online",
    // "U.S. Bank" as "usbank").
    return (issuer.length > 0 && issuer.every((w) => have.has(w))) || bank.startsWith(compact(p.issuer));
  });
}

/**
 * The catalog card a linked credit account most likely is, from what the bank calls it
 * ("Sapphire Preferred", "CHASE SAPPHIRE PREFERRED", "Platinum Card®" at American Express).
 * Every word of the card's short name must appear; the most specific match wins.
 * Returns undefined when nothing fits, and the user picks the card by hand.
 */
export function matchProduct(...names: (string | null | undefined)[]): string | undefined {
  const have = new Set(names.flatMap((n) => (n ? words(n) : [])));
  let best: { id: string; score: number } | undefined;
  for (const p of PRODUCTS) {
    const need = words(shortName(p));
    if (!need.length || !need.every((w) => have.has(w))) continue;
    const issuerHit = words(p.issuer).some((w) => have.has(w)) ? 0.5 : 0;
    const score = need.length + issuerHit;
    if (!best || score > best.score) best = { id: p.id, score };
  }
  return best?.id;
}

/** Earn rate for a plain (non-portal, non-merchant-specific) category. */
export function earnRate(p: Product, category: CategoryId): number {
  let best = p.baseRate;
  for (const r of p.rules) if (r.category === category) best = Math.max(best, r.rate);
  // Travel sub-categories also earn the card's general travel rate.
  if (category === 'flights' || category === 'hotels' || category === 'car_rental') {
    for (const r of p.rules) if (r.category === 'travel') best = Math.max(best, r.rate);
  }
  if (p.choiceCategory?.default === category) best = Math.max(best, p.choiceCategory.rate);
  return best;
}

/** Cents earned per dollar spent, e.g. 3x points worth 1¢ = 3. */
export function centsPerDollar(p: Product, category: CategoryId) {
  return earnRate(p, category) * p.pointValueCents;
}

/** Card art gradient per issuer, all drawn from the brand palette. */
export function cardGradient(issuer: string): [string, string] {
  switch (issuer) {
    case 'Chase': return ['#2F2BB8', '#6A6CF0'];
    case 'American Express': return ['#6B4FD8', '#C6A6F2'];
    case 'Citi': return ['#3D63D6', '#86B6F0'];
    case 'Capital One': return ['#1A1640', '#5B4FB0'];
    case 'Discover': return ['#D9779F', '#F7B9A2'];
    case 'Wells Fargo': return ['#8A2F6E', '#E39BDD'];
    case 'Bank of America': return ['#3A2E9C', '#E39BDD'];
    case 'U.S. Bank': return ['#24508F', '#7FB1E8'];
    default: return ['#4039DF', '#E39BDD'];
  }
}
