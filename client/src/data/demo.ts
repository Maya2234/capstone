// Demo data that stands in for Plaid until the real connection is wired up (see PLAID.md).
// Everything is generated from fixed seeds so the screens look the same on every load.
import type { CategoryId } from './categories';
import type { Account, Institution, Purchase, Transaction, WalletCard } from './types';

export const INSTITUTIONS: Institution[] = [
  { id: 'chase', name: 'Chase', color: '#2F2BB8' },
  { id: 'amex', name: 'American Express', color: '#6B4FD8' },
  { id: 'citi', name: 'Citi', color: '#3D63D6' },
  { id: 'discover', name: 'Discover', color: '#D9779F' },
  { id: 'ally', name: 'Ally Bank', color: '#864BE5' },
  { id: 'fidelity', name: 'Fidelity', color: '#2E8A63' },
  { id: 'nelnet', name: 'Nelnet', color: '#8C88A8' },
  { id: 'capone', name: 'Capital One', color: '#1A1640' },
  { id: 'wf', name: 'Wells Fargo', color: '#8A2F6E' },
  { id: 'boa', name: 'Bank of America', color: '#3A2E9C' },
];

export function institution(id: string, name?: string) {
  return INSTITUTIONS.find((i) => i.id === id) ?? { id, name: name ?? id, color: '#4039DF' };
}

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

/** What a demo connection to each bank brings in. */
export const DEMO_ACCOUNTS: Record<string, Omit<Account, 'linkedAt'>[]> = {
  chase: [
    { id: 'acc_chase_chk', institutionId: 'chase', name: 'Total Checking', type: 'checking', mask: '4821', balanceCents: 421855 },
    { id: 'acc_chase_csp', institutionId: 'chase', name: 'Sapphire Preferred', type: 'credit', mask: '1207', balanceCents: 128412, limitCents: 1200000, productId: 'chase-sapphire-preferred' },
  ],
  amex: [{ id: 'acc_amex_gold', institutionId: 'amex', name: 'Gold Card', type: 'credit', mask: '3005', balanceCents: 64280, limitCents: 1000000, productId: 'amex-gold' }],
  citi: [{ id: 'acc_citi_dc', institutionId: 'citi', name: 'Double Cash', type: 'credit', mask: '7719', balanceCents: 31044, limitCents: 850000, productId: 'citi-double-cash' }],
  ally: [{ id: 'acc_ally_sav', institutionId: 'ally', name: 'Online Savings', type: 'savings', mask: '9014', balanceCents: 1845000 }],
  fidelity: [{ id: 'acc_fid_brk', institutionId: 'fidelity', name: 'Brokerage', type: 'investment', mask: '6630', balanceCents: 1293067 }],
  nelnet: [{ id: 'acc_nel_loan', institutionId: 'nelnet', name: 'Student Loan', type: 'loan', mask: '2210', balanceCents: 1420000 }],
  discover: [{ id: 'acc_disc_it', institutionId: 'discover', name: 'it Cash Back', type: 'credit', mask: '0442', balanceCents: 8910, limitCents: 500000, productId: 'discover-it-cash-back' }],
  capone: [
    { id: 'acc_cap_chk', institutionId: 'capone', name: '360 Checking', type: 'checking', mask: '5532', balanceCents: 96012 },
    { id: 'acc_cap_savor', institutionId: 'capone', name: 'Savor', type: 'credit', mask: '8813', balanceCents: 22140, limitCents: 700000, productId: 'capone-savor' },
  ],
  wf: [{ id: 'acc_wf_ac', institutionId: 'wf', name: 'Active Cash', type: 'credit', mask: '6604', balanceCents: 15420, limitCents: 600000, productId: 'wf-active-cash' }],
  boa: [{ id: 'acc_boa_chk', institutionId: 'boa', name: 'Advantage Checking', type: 'checking', mask: '7781', balanceCents: 233090 }],
};

/** The demo user starts with these banks already connected. */
export const STARTING_INSTITUTIONS = ['chase', 'amex', 'citi', 'ally', 'fidelity', 'nelnet'];

export function demoAccountsFor(institutionId: string, linkedDaysAgo = 120): Account[] {
  return (DEMO_ACCOUNTS[institutionId] ?? []).map((a) => ({ ...a, linkedAt: ago(linkedDaysAgo) }));
}

export function walletCardFromAccount(a: Account): WalletCard {
  return { id: 'card_' + a.id, productId: a.productId!, mask: a.mask, accountId: a.id, enabled: true, addedAt: a.linkedAt };
}

// Small seeded random generator so demo history is stable.
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const MERCHANTS: { name: string; category: CategoryId; min: number; max: number }[] = [
  { name: 'Sweetgreen', category: 'dining', min: 1200, max: 2400 },
  { name: 'Blue Bottle Coffee', category: 'dining', min: 450, max: 1100 },
  { name: 'Tacombi', category: 'dining', min: 2200, max: 6800 },
  { name: 'DoorDash', category: 'dining', min: 1800, max: 4500 },
  { name: 'Trader Joe’s', category: 'groceries', min: 2800, max: 9800 },
  { name: 'Whole Foods Market', category: 'groceries', min: 3500, max: 14000 },
  { name: 'Shell', category: 'gas', min: 3000, max: 6200 },
  { name: 'Uber', category: 'transit', min: 900, max: 3400 },
  { name: 'MTA', category: 'transit', min: 290, max: 3400 },
  { name: 'Netflix', category: 'streaming', min: 1549, max: 1549 },
  { name: 'Spotify', category: 'streaming', min: 1199, max: 1199 },
  { name: 'Amazon', category: 'online_retail', min: 1500, max: 12000 },
  { name: 'Aritzia', category: 'online_retail', min: 4800, max: 16000 },
  { name: 'Sephora', category: 'online_retail', min: 2600, max: 9500 },
  { name: 'AMC Theatres', category: 'entertainment', min: 1400, max: 4200 },
  { name: 'Ticketmaster', category: 'entertainment', min: 5500, max: 12000 },
  { name: 'CVS Pharmacy', category: 'drugstore', min: 800, max: 4200 },
  { name: 'Delta Air Lines', category: 'flights', min: 18000, max: 42000 },
  { name: 'Home Depot', category: 'home_improvement', min: 1800, max: 9000 },
  { name: 'Target', category: 'general', min: 1500, max: 9000 },
];

// Each card leans toward a few categories so the per-account history feels real.
const LEAN: Record<string, CategoryId[]> = {
  acc_chase_csp: ['dining', 'travel', 'flights', 'streaming', 'transit'],
  acc_amex_gold: ['dining', 'groceries', 'dining'],
  acc_citi_dc: ['online_retail', 'general', 'home_improvement', 'entertainment'],
  acc_disc_it: ['gas', 'groceries', 'drugstore'],
  acc_cap_savor: ['dining', 'entertainment', 'streaming', 'groceries'],
  acc_wf_ac: ['general', 'online_retail', 'drugstore'],
};

const cache = new Map<string, Transaction[]>();

/** 90 days of history for one account, newest first. */
export function demoTransactions(a: Account): Transaction[] {
  const hit = cache.get(a.id);
  if (hit) return hit;
  const r = rng(a.id);
  const out: Transaction[] = [];
  const now = new Date();
  const at = (daysAgo: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, Math.floor(r() * 60), 0, 0);
    return d.toISOString();
  };
  const push = (t: Omit<Transaction, 'id' | 'accountId'>) =>
    out.push({ ...t, id: `${a.id}_${out.length}`, accountId: a.id });

  if (a.type === 'credit') {
    const lean = LEAN[a.id] ?? ['general', 'dining', 'online_retail'];
    for (let d = 0; d < 90; d++) {
      const n = r() < 0.55 ? 1 : r() < 0.3 ? 2 : 0;
      for (let k = 0; k < n; k++) {
        const pool = MERCHANTS.filter((m) => (r() < 0.75 ? lean.includes(m.category) : true));
        const m = pool[Math.floor(r() * pool.length)] ?? MERCHANTS[0];
        if ((m.category === 'flights' || m.name === 'Ticketmaster') && r() < 0.85) continue;
        push({ date: at(d, 8 + Math.floor(r() * 13)), merchant: m.name, category: m.category, amountCents: Math.round(m.min + r() * (m.max - m.min)), pending: d === 0 });
      }
      if (d % 30 === 12) push({ date: at(d, 9), merchant: 'Payment — thank you', category: 'general', amountCents: -Math.round(40000 + r() * 90000) });
    }
  } else if (a.type === 'checking') {
    for (let d = 0; d < 90; d++) {
      if (d % 14 === 4) push({ date: at(d, 6), merchant: 'Payroll — Northwind Studio', category: 'general', amountCents: -248650 });
      if (d % 30 === 1) push({ date: at(d, 10), merchant: 'Rent — Linden Properties', category: 'rent', amountCents: 185000 });
      if (d % 30 === 12) push({ date: at(d, 9), merchant: 'Card payment', category: 'general', amountCents: Math.round(40000 + r() * 90000) });
      if (d % 30 === 20) push({ date: at(d, 9), merchant: 'Verizon', category: 'phone', amountCents: 6500 });
      if (r() < 0.12) push({ date: at(d, 13), merchant: 'Venmo', category: 'general', amountCents: Math.round(1000 + r() * 6000) });
    }
  } else if (a.type === 'savings') {
    for (let d = 0; d < 90; d += 30) push({ date: at(d + 2, 3), merchant: 'Interest paid', category: 'general', amountCents: -Math.round(5200 + r() * 600) });
    for (let d = 5; d < 90; d += 14) push({ date: at(d, 7), merchant: 'Transfer from checking', category: 'general', amountCents: -25000 });
  } else if (a.type === 'investment') {
    for (let d = 3; d < 90; d += 30) push({ date: at(d, 11), merchant: 'Automatic investment', category: 'general', amountCents: -30000 });
    push({ date: at(41, 11), merchant: 'Dividend — VTI', category: 'general', amountCents: -Math.round(3800 + r() * 900) });
  } else if (a.type === 'loan') {
    for (let d = 8; d < 90; d += 30) push({ date: at(d, 9), merchant: 'Payment received', category: 'general', amountCents: -28500 });
  }
  out.sort((x, y) => y.date.localeCompare(x.date));
  cache.set(a.id, out);
  return out;
}

/** Past purchases paid through CardMaxx checkout. Card choice uses the same rewards math as live checkout. */
export function demoPurchases(cards: WalletCard[], pick: (category: CategoryId, amountCents: number, cards: WalletCard[]) => { card: WalletCard; rewardCents: number; rateLabel: string } | null): Purchase[] {
  const r = rng('purchases');
  const shops: { name: string; category: CategoryId; min: number; max: number }[] = [
    { name: 'Aritzia', category: 'online_retail', min: 6800, max: 19800 },
    { name: 'Glossier', category: 'online_retail', min: 2600, max: 7400 },
    { name: 'Threadline Apparel', category: 'online_retail', min: 4200, max: 12800 },
    { name: 'Caviar', category: 'dining', min: 2400, max: 6400 },
    { name: 'Thrive Market', category: 'groceries', min: 5400, max: 13600 },
    { name: 'StubHub', category: 'entertainment', min: 8800, max: 24000 },
    { name: 'Lyft', category: 'transit', min: 1400, max: 3900 },
    { name: 'Hotels.com', category: 'hotels', min: 21000, max: 46000 },
    { name: 'Allbirds', category: 'online_retail', min: 9800, max: 14500 },
    { name: 'Uber Eats', category: 'dining', min: 1900, max: 5200 },
  ];
  const out: Purchase[] = [];
  let d = 1;
  for (let i = 0; i < 16; i++) {
    d += 1 + Math.floor(r() * 5);
    const s = shops[Math.floor(r() * shops.length)];
    const amount = Math.round(s.min + r() * (s.max - s.min));
    const choice = pick(s.category, amount, cards);
    if (!choice) continue;
    const date = new Date(Date.now() - d * 864e5);
    date.setHours(10 + Math.floor(r() * 10), Math.floor(r() * 60));
    out.push({
      id: 'pur_' + i, date: date.toISOString(), merchant: s.name, category: s.category, amountCents: amount,
      cardId: choice.card.id, rewardCents: choice.rewardCents, rateLabel: choice.rateLabel,
      status: i === 6 ? 'refunded' : 'succeeded',
    });
  }
  return out;
}
