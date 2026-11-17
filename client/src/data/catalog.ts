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
