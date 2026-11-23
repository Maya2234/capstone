// Two pretend stores for demoing CardMaxx checkout, named after real apps so the demo reads
// instantly. Names only: no logos or artwork, products are made up, and every store screen says
// it's a demo that isn't affiliated with either company (DEMO_NOTICE). Nothing here is charged.

import type { CategoryId } from '@/data/categories';

export type DemoProduct = {
  id: string;
  name: string;
  /** Shown under the name: a creator handle, or a size/weight. */
  detail: string;
  priceCents: number;
  emoji: string;
  /** Tile background behind the emoji. */
  tint: string;
  /** Social store: a little social proof on each product. */
  badge?: string;
};

export type DemoStore = {
  id: 'trendbox' | 'freshcart';
  name: string;
  tagline: string;
  /** What CardMaxx sees the purchase as, which decides the best card. */
  category: CategoryId;
  /** "Online shopping", "Online groceries": said out loud in the checkout. */
  categoryLabel: string;
  colors: { bg: string; surface: string; text: string; muted: string; accent: string; onAccent: string; line: string };
  /** Grocery delivery adds a fee; the social shop ships free. */
  feeCents: number;
  feeLabel?: string;
  sections: { title: string; products: DemoProduct[] }[];
};

export const STORES: DemoStore[] = [
  {
    id: 'trendbox',
    name: 'TikTok Shop',
    tagline: 'Shop what’s trending, straight from creators',
    category: 'online_retail',
    categoryLabel: 'Online shopping',
    colors: { bg: '#0E0B14', surface: '#1B1624', text: '#FFFFFF', muted: '#A89FB8', accent: '#FF3D7F', onAccent: '#FFFFFF', line: '#2C2438' },
    feeCents: 0,
    sections: [
      {
        title: 'Trending now',
        products: [
          { id: 'tb-1', name: 'Cloud Glow Lip Oil', detail: '@glowwithjess', priceCents: 1499, emoji: '💄', tint: '#3A1730', badge: '🔥 12.4k sold' },
          { id: 'tb-2', name: 'Mini Sunset Lamp', detail: '@roomrefresh', priceCents: 2299, emoji: '🌅', tint: '#3A2414', badge: '⭐ 4.8 · 8.1k' },
          { id: 'tb-3', name: 'Oversized Knit Hoodie', detail: '@cozyfits', priceCents: 3899, emoji: '🧥', tint: '#1E2440', badge: '🔥 Viral' },
          { id: 'tb-4', name: 'Magnetic Phone Stand', detail: '@techunder20', priceCents: 1799, emoji: '📱', tint: '#14302A', badge: '⭐ 4.7 · 21k' },
        ],
      },
      {
        title: 'From your feed',
        products: [
          { id: 'tb-5', name: 'Cloud Slides', detail: '@stepsbystella', priceCents: 2499, emoji: '🩴', tint: '#2A1A3A', badge: '🔥 30k sold' },
          { id: 'tb-6', name: 'Gold Huggie Earrings', detail: '@shinyfinds', priceCents: 1299, emoji: '✨', tint: '#3A3014' },
          { id: 'tb-7', name: 'Mini Waffle Maker', detail: '@kitchenhacks', priceCents: 1999, emoji: '🧇', tint: '#3A2A14', badge: '⭐ 4.9' },
          { id: 'tb-8', name: 'Desk Plant Duo', detail: '@plantmom', priceCents: 2799, emoji: '🪴', tint: '#143A1E' },
        ],
      },
    ],
  },
  {
    id: 'freshcart',
    name: 'Instacart',
    tagline: 'Groceries delivered in as little as an hour',
    category: 'groceries',
    categoryLabel: 'Online groceries',
    colors: { bg: '#F6F8F4', surface: '#FFFFFF', text: '#1B2A1E', muted: '#5F6F62', accent: '#1E8E3E', onAccent: '#FFFFFF', line: '#E3E9E0' },
    feeCents: 399,
    feeLabel: 'Delivery fee',
    sections: [
      {
        title: 'Produce',
        products: [
          { id: 'fc-1', name: 'Organic Bananas', detail: '1 bunch, about 2.5 lb', priceCents: 249, emoji: '🍌', tint: '#FFF6D6' },
          { id: 'fc-2', name: 'Hass Avocados', detail: '4 count bag', priceCents: 599, emoji: '🥑', tint: '#E6F4DC' },
          { id: 'fc-3', name: 'Strawberries', detail: '1 lb clamshell', priceCents: 449, emoji: '🍓', tint: '#FDE3E3' },
          { id: 'fc-4', name: 'Baby Spinach', detail: '5 oz', priceCents: 379, emoji: '🥬', tint: '#E3F2E1' },
        ],
      },
      {
        title: 'Dairy & bakery',
        products: [
          { id: 'fc-5', name: 'Whole Milk', detail: '1 gal', priceCents: 459, emoji: '🥛', tint: '#EEF3F8' },
          { id: 'fc-6', name: 'Large Brown Eggs', detail: '12 count', priceCents: 529, emoji: '🥚', tint: '#F8EFE3' },
          { id: 'fc-7', name: 'Sourdough Loaf', detail: '24 oz', priceCents: 649, emoji: '🍞', tint: '#F6EADB' },
          { id: 'fc-8', name: 'Greek Yogurt', detail: '32 oz', priceCents: 699, emoji: '🫙', tint: '#EEF0F6' },
        ],
      },
      {
        title: 'Pantry',
        products: [
          { id: 'fc-9', name: 'Coffee Beans', detail: '12 oz, medium roast', priceCents: 1199, emoji: '☕', tint: '#EFE6DD' },
          { id: 'fc-10', name: 'Pasta Night Bundle', detail: 'Spaghetti + marinara', priceCents: 899, emoji: '🍝', tint: '#FBE9DE' },
        ],
      },
    ],
  },
];

export const store = (id: string) => STORES.find((s) => s.id === id);

/** Shown on every demo store screen. */
export const DEMO_NOTICE = 'Demo for CardMaxx only. Not affiliated with or endorsed by TikTok or Instacart. Products are made up and nothing is charged.';

export function findProduct(s: DemoStore, id: string) {
  for (const section of s.sections) for (const p of section.products) if (p.id === id) return p;
  return undefined;
}
