import type { CategoryId } from './categories';

/**
 * A category for tracking spending: one of the built-in ones, or one the user made
 * ("custom_" + a random id). Card rewards only know the built-in ones (CategoryId).
 */
export type SpendCategory = CategoryId | `custom_${string}`;

/** A spending category the user made in Settings → Spending categories. */
export type CustomCategory = { id: `custom_${string}`; label: string; color: string; icon: string };

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'loan';

export type Institution = { id: string; name: string; color: string };

export type Account = {
  id: string;
  institutionId: string;
  institutionName?: string; // from Plaid; demo banks look theirs up by id
  name: string;
  type: AccountType;
  mask: string; // last four
  balanceCents: number; // what you have (assets) or what you owe (credit, loan), always positive
  limitCents?: number;
  productId?: string; // card catalog id, credit cards only
  linkedAt: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  date: string; // ISO
  merchant: string;
  category: SpendCategory;
  amountCents: number; // positive = money out, negative = money in
  pending?: boolean;
  transfer?: boolean; // card payments, transfers and income: not spending
};

/** A card CardMaxx can pay with: either a linked credit account or one added by hand. */
export type WalletCard = {
  id: string;
  productId: string;
  mask: string;
  nickname?: string;
  accountId?: string; // set when it came from a linked account
  enabled: boolean;
  addedAt: string;
};

export type Purchase = {
  id: string;
  date: string;
  merchant: string;
  category: CategoryId;
  amountCents: number;
  cardId: string;
  rewardCents: number;
  rateLabel: string;
  status: 'succeeded' | 'refunded' | 'pending';
};

export type Budget = { category: SpendCategory; limitCents: number };

export type Profile = {
  name: string;
  username: string;
  email: string;
  phone: string;
  photoUri?: string;
};

export type Prefs = {
  showNetWorth: boolean;
  cardSuggestions: boolean;
  appearance: 'system' | 'light' | 'dark';
  /** The user closed the "set your budgets" prompt on Home. Budgets stay reachable from Settings. */
  budgetPromptDismissed: boolean;
  /**
   * Categories the user picked for merchants, keyed by merchantKey() (see derive.ts). They
   * replace the automatic one for every past and future purchase at that merchant.
   */
  merchantCategories: Partial<Record<string, SpendCategory>>;
  /** Categories the user picked for single transactions, keyed by transaction id. Beat merchant choices. */
  transactionCategories: Partial<Record<string, SpendCategory>>;
  /** Spending categories the user made. */
  customCategories: CustomCategory[];
  /** Built-in categories the user turned off. Their purchases count as "Everything else". */
  hiddenCategories: CategoryId[];
};
