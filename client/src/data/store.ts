import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { db, type UserData } from '@/services/db';

import type { CategoryId } from './categories';
import { demoAccountsFor, demoPurchases, STARTING_INSTITUTIONS, walletCardFromAccount } from './demo';
import { pickForPurchase } from './rewards';
import type { Account, Budget, Prefs, Profile, Purchase, WalletCard } from './types';

export type Session = { userId: string; email: string; method: 'google' | 'email' } | null;

type Data = {
  profile: Profile;
  prefs: Prefs;
  accounts: Account[];
  cards: WalletCard[];
  budgets: Budget[];
  purchases: Purchase[];
};

type State = Data & {
  session: Session;
  /** False until Supabase has said whether someone is signed in. */
  authReady: boolean;
};

type Actions = {
  /** Called by src/data/sync.ts once Supabase has a session and the user's data is loaded. */
  setSignedIn: (session: NonNullable<Session>, data: UserData) => void;
  /** Called by src/data/sync.ts after sign-out. Clears this device's copy. */
  setSignedOut: () => void;
  setAuthReady: () => void;
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
export const DEFAULT_PREFS: Prefs = { showNetWorth: true, hideAmounts: false, cardSuggestions: true, appearance: 'system' };
const emptyData: Data = { profile: emptyProfile, prefs: DEFAULT_PREFS, accounts: [], cards: [], budgets: [], purchases: [] };

/** A brand-new user: a few demo banks connected, cards in the wallet, some CardMaxx history. */
export function starterData(email: string, name?: string): Data {
  const accounts = STARTING_INSTITUTIONS.flatMap((id) => demoAccountsFor(id));
  const cards = accounts.filter((a) => a.type === 'credit' && a.productId).map(walletCardFromAccount);
  const display = name || email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  // Same rule Settings enforces: 3–24 of a-z, 0-9, . or _
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '_').slice(0, 24);
  const username = base.length >= 3 ? base : (base + '_user').slice(0, 24);
  return {
    profile: { ...emptyProfile, name: display, email, username },
    prefs: DEFAULT_PREFS,
    accounts,
    cards,
    budgets: DEFAULT_BUDGETS,
    purchases: demoPurchases(cards, pickForPurchase),
  };
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => {
      /** Write a change to Supabase after updating the screen. Failures are logged, not shown. */
      function remote(write: (userId: string) => Promise<unknown>) {
        const userId = get().session?.userId;
        if (!userId) return;
        write(userId).catch((e) => console.warn('[CardMaxx] Couldn’t save to Supabase:', e instanceof Error ? e.message : e));
      }

      return {
        ...emptyData,
        session: null,
        authReady: false,

        setSignedIn: (session, data) => set({ session, ...data, prefs: { ...DEFAULT_PREFS, ...data.prefs } }),
        setSignedOut: () => set({ session: null, ...emptyData, prefs: get().prefs }),
        setAuthReady: () => set({ authReady: true }),

        updateProfile: (p) => {
          set((s) => ({ profile: { ...s.profile, ...p } }));
          remote((uid) => db.saveProfile(uid, get().profile));
        },
        setPref: (k, v) => {
          set((s) => ({ prefs: { ...s.prefs, [k]: v } }));
          remote((uid) => db.savePrefs(uid, get().prefs));
        },

        linkAccounts: (incoming) => {
          const s = get();
          const ids = new Set(s.accounts.map((a) => a.id));
          const fresh = incoming.filter((a) => !ids.has(a.id));
          const cardIds = new Set(s.cards.map((c) => c.accountId));
          const newCards = fresh.filter((a) => a.type === 'credit' && a.productId && !cardIds.has(a.id)).map(walletCardFromAccount);
          set({ accounts: [...s.accounts, ...fresh], cards: [...s.cards, ...newCards] });
          remote(async (uid) => {
            await db.saveAccounts(uid, fresh);
            await db.saveCards(uid, newCards);
          });
        },
        unlinkInstitution: (institutionId) => {
          const s = get();
          const gone = new Set(s.accounts.filter((a) => a.institutionId === institutionId).map((a) => a.id));
          const goneCards = s.cards.filter((c) => c.accountId && gone.has(c.accountId)).map((c) => c.id);
          set({ accounts: s.accounts.filter((a) => !gone.has(a.id)), cards: s.cards.filter((c) => !goneCards.includes(c.id)) });
          remote(async () => {
            await db.deleteCards(goneCards);
            await db.deleteAccounts([...gone]);
          });
        },

        addCard: (c) => {
          const card: WalletCard = { ...c, id: 'card_' + Date.now().toString(36), enabled: true, addedAt: new Date().toISOString() };
          set((s) => ({ cards: [...s.cards, card] }));
          remote((uid) => db.saveCards(uid, [card]));
        },
        removeCard: (id) => {
          set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
          remote(() => db.deleteCards([id]));
        },
        setCardEnabled: (id, enabled) => {
          set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, enabled } : c)) }));
          const card = get().cards.find((c) => c.id === id);
          if (card) remote((uid) => db.saveCards(uid, [card]));
        },

        setBudget: (category, limitCents) => {
          set((s) => {
            const exists = s.budgets.some((b) => b.category === category);
            return {
              budgets: exists
                ? s.budgets.map((b) => (b.category === category ? { ...b, limitCents } : b))
                : [...s.budgets, { category, limitCents }],
            };
          });
          remote((uid) => db.saveBudget(uid, { category, limitCents }));
        },
        removeBudget: (category) => {
          set((s) => ({ budgets: s.budgets.filter((b) => b.category !== category) }));
          remote(() => db.deleteBudget(category));
        },
      };
    },
    {
      name: 'cardmaxx',
      // v2: data now lives in Supabase. This is a cache, and the session comes from Supabase Auth.
      version: 2,
      migrate: () => ({ ...emptyData }) as State & Actions,
      partialize: ({ session, authReady, ...rest }) => {
        void session;
        void authReady;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Data;
      },
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
