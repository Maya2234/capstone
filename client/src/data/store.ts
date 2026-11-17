import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CategoryId } from './categories';
import { demoAccountsFor, demoPurchases, STARTING_INSTITUTIONS, walletCardFromAccount } from './demo';
import { pickForPurchase } from './rewards';
import type { Account, Budget, Prefs, Profile, Purchase, WalletCard } from './types';

type Session = { userId: string; email: string; method: 'google' | 'email' } | null;

type State = {
  session: Session;
  profile: Profile;
  prefs: Prefs;
  accounts: Account[];
  cards: WalletCard[];
  budgets: Budget[];
  purchases: Purchase[];
};

type Actions = {
  signIn: (email: string, method: 'google' | 'email', name?: string) => void;
  signOut: () => void;
  updateProfile: (p: Partial<Profile>) => void;
  setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
  linkAccounts: (accounts: Account[]) => void;
  unlinkInstitution: (institutionId: string) => void;
  addCard: (c: Omit<WalletCard, 'id' | 'addedAt' | 'enabled'>) => void;
  removeCard: (id: string) => void;
  setCardEnabled: (id: string, enabled: boolean) => void;
  setBudget: (category: CategoryId, limitCents: number) => void;
  removeBudget: (category: CategoryId) => void;
};

const DEFAULT_BUDGETS: Budget[] = [
  { category: 'dining', limitCents: 45000 },
  { category: 'groceries', limitCents: 60000 },
  { category: 'online_retail', limitCents: 35000 },
  { category: 'entertainment', limitCents: 30000 },
  { category: 'transit', limitCents: 15000 },
];

const emptyProfile: Profile = { name: '', username: '', email: '', phone: '' };

/** A brand-new demo user: a few banks connected, cards in the wallet, some CardMaxx history. */
function starterData(email: string, name?: string): Omit<State, 'session' | 'prefs'> {
  const accounts = STARTING_INSTITUTIONS.flatMap((id) => demoAccountsFor(id));
  const cards = accounts.filter((a) => a.type === 'credit' && a.productId).map(walletCardFromAccount);
  const display = name || email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    profile: { ...emptyProfile, name: display, email, username: email.split('@')[0].toLowerCase() },
    accounts,
    cards,
    budgets: DEFAULT_BUDGETS,
    purchases: demoPurchases(cards, pickForPurchase),
  };
}

export const useStore = create<State & Actions>()(
  persist(
    (set) => ({
      session: null,
      profile: emptyProfile,
      prefs: { showNetWorth: true, hideAmounts: false, cardSuggestions: true, appearance: 'system' },
      accounts: [],
      cards: [],
      budgets: [],
      purchases: [],

      signIn: (email, method, name) =>
        set((s) => ({
          session: { userId: 'demo-' + email.toLowerCase(), email, method },
          // Keep an existing profile if the same person signs back in.
          ...(s.profile.email === email && s.accounts.length ? {} : starterData(email, name)),
        })),
      signOut: () => set({ session: null }),
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setPref: (k, v) => set((s) => ({ prefs: { ...s.prefs, [k]: v } })),

      linkAccounts: (incoming) =>
        set((s) => {
          const ids = new Set(s.accounts.map((a) => a.id));
          const fresh = incoming.filter((a) => !ids.has(a.id));
          const cardIds = new Set(s.cards.map((c) => c.accountId));
          const newCards = fresh.filter((a) => a.type === 'credit' && a.productId && !cardIds.has(a.id)).map(walletCardFromAccount);
          return { accounts: [...s.accounts, ...fresh], cards: [...s.cards, ...newCards] };
        }),
      unlinkInstitution: (institutionId) =>
        set((s) => {
          const gone = new Set(s.accounts.filter((a) => a.institutionId === institutionId).map((a) => a.id));
          return {
            accounts: s.accounts.filter((a) => !gone.has(a.id)),
            cards: s.cards.filter((c) => !c.accountId || !gone.has(c.accountId)),
          };
        }),

      addCard: (c) =>
        set((s) => ({
          cards: [...s.cards, { ...c, id: 'card_' + Date.now().toString(36), enabled: true, addedAt: new Date().toISOString() }],
        })),
      removeCard: (id) => set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),
      setCardEnabled: (id, enabled) => set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, enabled } : c)) })),

      setBudget: (category, limitCents) =>
        set((s) => {
          const exists = s.budgets.some((b) => b.category === category);
          return {
            budgets: exists
              ? s.budgets.map((b) => (b.category === category ? { ...b, limitCents } : b))
              : [...s.budgets, { category, limitCents }],
          };
        }),
      removeBudget: (category) => set((s) => ({ budgets: s.budgets.filter((b) => b.category !== category) })),
    }),
    {
      name: 'cardmaxx',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** True once saved state has loaded from the device. The app waits for this so nothing flashes. */
export function useHydrated() {
  return useSyncExternalStore(
    (onChange) => useStore.persist.onFinishHydration(onChange),
    () => useStore.persist.hasHydrated(),
    () => false, // server render: never hydrated
  );
}
