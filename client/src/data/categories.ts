import {
  Car, Clapperboard, Fuel, Hammer, House, Pill, Plane, Hotel, ShoppingBag, ShoppingBasket, Smartphone,
  Tv, Utensils, Warehouse, Zap, Bus, CircleDollarSign, type LucideIcon,
} from 'lucide-react-native';

import { palette } from '@/theme/tokens';

export type CategoryId =
  | 'dining' | 'groceries' | 'gas' | 'ev_charging' | 'travel' | 'flights' | 'hotels' | 'car_rental'
  | 'transit' | 'streaming' | 'drugstore' | 'online_retail' | 'entertainment' | 'wholesale_club'
  | 'rent' | 'phone' | 'home_improvement' | 'general';

type Meta = { label: string; icon: LucideIcon; color: string };

// Extra warm tones sit next to the brand palette so charts have enough distinct colors.
const peach = '#F59E7A';
const honey = '#E9B949';
const mint = '#56C29A';
const sky = '#5AA9E6';

export const CATEGORIES: Record<CategoryId, Meta> = {
  dining: { label: 'Dining', icon: Utensils, color: palette.orchid },
  groceries: { label: 'Groceries', icon: ShoppingBasket, color: mint },
  gas: { label: 'Gas', icon: Fuel, color: honey },
  ev_charging: { label: 'EV charging', icon: Zap, color: honey },
  travel: { label: 'Travel', icon: Plane, color: sky },
  flights: { label: 'Flights', icon: Plane, color: sky },
  hotels: { label: 'Hotels', icon: Hotel, color: sky },
  car_rental: { label: 'Car rental', icon: Car, color: sky },
  transit: { label: 'Rides & transit', icon: Bus, color: palette.periwinkle },
  streaming: { label: 'Streaming', icon: Tv, color: palette.violet },
  drugstore: { label: 'Drugstores', icon: Pill, color: peach },
  online_retail: { label: 'Shopping', icon: ShoppingBag, color: palette.indigo },
  entertainment: { label: 'Entertainment', icon: Clapperboard, color: palette.lavender },
  wholesale_club: { label: 'Wholesale clubs', icon: Warehouse, color: mint },
  rent: { label: 'Rent', icon: House, color: '#F2A65A' },
  phone: { label: 'Phone', icon: Smartphone, color: palette.periwinkle },
  home_improvement: { label: 'Home', icon: Hammer, color: '#3FB8C4' },
  general: { label: 'Everything else', icon: CircleDollarSign, color: '#9C98B5' },
};

/** Categories shown in Wallet's "best card for…" list, in display order. */
export const WALLET_CATEGORIES: CategoryId[] = [
  'dining', 'groceries', 'gas', 'travel', 'transit', 'streaming', 'online_retail', 'entertainment', 'drugstore', 'general',
];

export const BUDGET_CATEGORIES: CategoryId[] = [
  'dining', 'groceries', 'online_retail', 'entertainment', 'transit', 'gas', 'travel', 'streaming', 'drugstore', 'home_improvement', 'general',
];
