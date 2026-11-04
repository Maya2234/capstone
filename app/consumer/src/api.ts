import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const TOKEN_KEY = 'cardstack.session';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let token: string | null = null;
let onSignedOut: (() => void) | null = null;

export async function loadSession(): Promise<string | null> {
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
}

export function setSignedOutHandler(fn: () => void) {
  onSignedOut = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/server/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      await signOutLocal();
    }
    throw new ApiError(res.status, data.error ?? 'Error', data.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

async function signOutLocal() {
  token = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
  onSignedOut?.();
}

export async function signIn(idToken: string) {
  const r = await request<{ sessionToken: string; email: string; name: string }>('POST', '/auth/google', { idToken });
  token = r.sessionToken;
  await AsyncStorage.setItem(TOKEN_KEY, r.sessionToken);
  return r;
}

export async function signOut() {
  try {
    await request('POST', '/auth/logout');
  } finally {
    await signOutLocal();
  }
}

// ---- types ------------------------------------------------------------------

export type Rule = { category: string; rate: number; capCents?: number; capPeriod?: string; note?: string };

export type Card = {
  cardId: string;
  institution: string;
  productId: string;
  productName: string;
  issuer: string;
  last4: string;
  network: string;
  nickname: string;
  preferred: boolean;
  status: 'active' | 'frozen' | string;
  creditLimitCents: number;
  balanceCents: number;
  availableCents: number;
  utilization: number;
  annualFeeCents: number;
  rewardType: string;
  currency: string;
  baseRate: number;
  rules: Rule[];
  choices: string[];
  rotatingActive: string[];
  choiceCategory?: { rate: number; picks?: number; options: string[]; default: string };
  rotating?: { rate: number; capCents: number };
  sourceUrl: string;
};

export type Accounts = {
  cards: Card[];
  accounts: { id: string; name: string; subtype: string; mask: string; balanceCents: number; institution: string }[];
  totals: { cashCents: number; creditBalanceCents: number; creditLimitCents: number; utilization: number; netCents: number };
};

export type Insights = {
  days: number;
  totalSpentCents: number;
  categories: { category: string; spentCents: number; count: number; bestCardName?: string; bestRate?: number; earnedCents: number; possibleCents: number }[];
  topMerchants: { merchant: string; spentCents: number }[];
  rewards: { earnedCents: number; possibleCents: number; missedCents: number; cardstackEarnedCents: number };
};

export type Ranked = { cardId: string; last4: string; network: string; productName: string; expectedValueCents: number; rate: number; rule: string; reason: string };

export type Product = {
  id: string; name: string; issuer: string; network: string; annualFeeCents: number; rewardType: string; currency: string;
  pointValueCents: number; baseRate: number; rules: Rule[]; sourceUrl: string; confidence: string; notes?: string;
  rotating?: { rate: number }; choiceCategory?: { rate: number; options: string[] }; topCategory?: { rate: number; eligible: string[] };
};

export type CardStackTx = { transactionId: string; merchant: string; amountCents: number; createdAt: string; cardLast4: string; pointsEarnedCents: number; state: string; category: string };
export type ExternalTx = { id: string; accountRef: string; date: string; merchant: string; category: string; amountCents: number };
export type Page<T> = { items: T[]; nextCursor: string };

export const api = {
  me: () => request<{ email: string; name: string }>('GET', '/me'),
  accounts: () => request<Accounts>('GET', '/accounts'),
  insights: (days: number) => request<Insights>('GET', `/insights?days=${days}`),
  cards: () => request<{ cards: Card[] }>('GET', '/cards'),
  setPreferred: (id: string) => request('PUT', `/cards/${id}/preferred`),
  removeCard: (id: string) => request('DELETE', `/cards/${id}`),
  updateCard: (id: string, patch: { choices?: string[]; rotatingActive?: string[]; status?: string }) => request<Card>('PATCH', `/cards/${id}`, patch),
  linkToken: () => request<{ linkToken: string; linkUrl: string }>('POST', '/plaid/link-token'),
  recommend: (category: string, amountCents: number) =>
    request<{ ranked: Ranked[]; excluded: { cardId: string; reason: string }[] | null }>('GET', `/recommend?category=${encodeURIComponent(category)}&amountCents=${amountCents}`),
  products: () => request<{ asOf: string; products: Product[]; merchantCategories: Record<string, string[]> }>('GET', '/card-products'),
  transactions: (cursor = '') => request<Page<CardStackTx>>('GET', `/transactions?cursor=${cursor}&limit=20`),
  external: (cursor = '') => request<Page<ExternalTx>>('GET', `/external-transactions?cursor=${cursor}&limit=20`),
};

export const money = (cents: number, digits = 2) =>
  (cents < 0 ? '-$' : '$') + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export const label = (category: string) =>
  category.replace(/^merchant:/, '').replace(/^portal:/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
