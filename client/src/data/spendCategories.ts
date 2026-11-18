// Spending categories as the user has set them up: the built-in ones they kept, plus their own.
// Screens about spending (Home chart, budgets, category sheets, the category picker) go through
// here instead of reading CATEGORIES directly, so custom and hidden categories show up right.
// Card rewards keep using the built-in CategoryId list, since card earn rates are defined on it.

import {
  Baby, Bike, BookOpen, Briefcase, Coffee, Dumbbell, Gamepad2, Gift, GraduationCap, HandHeart, Heart, Leaf, type LucideIcon, Music,
  Palette, PawPrint, PiggyBank, Scissors, Shirt, Sparkles, Stethoscope, Tag, Ticket, Wine, Wrench,
} from 'lucide-react-native';
import { useMemo } from 'react';

import { CATEGORIES, type CategoryId } from './categories';
import { useStore } from './store';
import type { CustomCategory, SpendCategory } from './types';

/** Icons a custom category can use, by name (the name is what's saved). */
export const CUSTOM_ICONS: Record<string, LucideIcon> = {
  tag: Tag, heart: Heart, gift: Gift, coffee: Coffee, wine: Wine, shirt: Shirt, sparkles: Sparkles, scissors: Scissors,
  dumbbell: Dumbbell, bike: Bike, 'paw-print': PawPrint, baby: Baby, 'graduation-cap': GraduationCap, 'book-open': BookOpen,
  music: Music, 'gamepad-2': Gamepad2, ticket: Ticket, palette: Palette, stethoscope: Stethoscope, briefcase: Briefcase,
  wrench: Wrench, leaf: Leaf, 'hand-heart': HandHeart, 'piggy-bank': PiggyBank,
};

/** Colors a custom category can use. Chosen to sit well next to the built-in ones. */
export const CUSTOM_COLORS = ['#E86A92', '#F59E7A', '#E9B949', '#56C29A', '#3FB8C4', '#5AA9E6', '#8A87FA', '#B07CE8', '#9C98B5'];

export type CategoryInfo = { label: string; color: string; icon: LucideIcon };

const BUILT_IN = Object.keys(CATEGORIES) as CategoryId[];

export const isCustom = (c: string): c is `custom_${string}` => c.startsWith('custom_');

/** Name, color and icon for any spending category. A deleted custom one reads as Everything else. */
export function categoryInfo(c: SpendCategory, customs: CustomCategory[]): CategoryInfo {
  if (isCustom(c)) {
    const found = customs.find((x) => x.id === c);
    if (found) return { label: found.label, color: found.color, icon: CUSTOM_ICONS[found.icon] ?? Tag };
    return CATEGORIES.general;
  }
  return CATEGORIES[c as CategoryId] ?? CATEGORIES.general;
}

/** The categories in use, in order: kept built-in ones, then the user's own, then Everything else. */
export function activeCategories(customs: CustomCategory[], hidden: CategoryId[]): SpendCategory[] {
  const off = new Set(hidden);
  return [...BUILT_IN.filter((c) => c !== 'general' && !off.has(c)), ...customs.map((c) => c.id), 'general'];
}

/**
 * Where a purchase's category actually lands: a turned-off built-in category or a deleted
 * custom one becomes Everything else.
 */
export function landing(c: SpendCategory, customs: CustomCategory[], hidden: CategoryId[]): SpendCategory {
  if (isCustom(c)) return customs.some((x) => x.id === c) ? c : 'general';
  return hidden.includes(c as CategoryId) ? 'general' : c;
}

/** Everything a screen needs about the user's categories, kept up to date. */
export function useSpendCategories() {
  const customs = useStore((s) => s.prefs.customCategories);
  const hidden = useStore((s) => s.prefs.hiddenCategories);
  return useMemo(
    () => ({
      list: activeCategories(customs, hidden),
      info: (c: SpendCategory) => categoryInfo(c, customs),
      isActive: (c: string) => activeCategories(customs, hidden).includes(c as SpendCategory),
      customs,
      hidden,
    }),
    [customs, hidden],
  );
}
