import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Minus, Plus, ShoppingBag, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text as RNText, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cartSummary, useDemoCart } from '@/demo/checkout';
import { DEMO_NOTICE, store as findStore, type DemoProduct, type DemoStore } from '@/demo/stores';
import { money } from '@/lib/format';
import { useWide } from '@/theme/theme';
import { usePageShown } from '@/ui/usePageShown';

/**
 * A pretend storefront in the store's own look (not CardMaxx's), so the demo feels like
 * shopping somewhere else and then paying with CardMaxx.
 */
export default function Storefront() {
  usePageShown();
  const { store: id } = useLocalSearchParams<{ store: string }>();
  const s = findStore(id ?? '');
  const insets = useSafeAreaInsets();
  const wide = useWide();
  // Tiles sized from the real content width, so the grid is always exactly 2 (phone) or 4 columns.
  const [contentWidth, setContentWidth] = useState(0);
  const cols = wide ? 4 : 2;
  const tileWidth = contentWidth ? Math.floor((contentWidth - GAP * (cols - 1)) / cols) : 0;
  const cart = useDemoCart((st) => (s ? st.carts[s.id] : undefined));
  if (!s) return null;
  const c = s.colors;
  const { count, subtotalCents } = cartSummary(s, cart);
  const Bag = s.id === 'freshcart' ? ShoppingCart : ShoppingBag;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/stores'));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Store header */}
      <View style={{ paddingTop: insets.top + 10, paddingBottom: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.bg }}>
        <View style={{ width: '100%', maxWidth: 1040, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to demo stores" onPress={back} hitSlop={8} style={{ padding: 6 }}>
            <ArrowLeft size={22} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <RNText style={{ color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>{s.name}</RNText>
            <RNText style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{s.tagline}</RNText>
          </View>
          <View accessibilityLabel={`${count} in cart`} style={{ padding: 6 }}>
            <Bag size={24} color={c.text} />
            {count > 0 && (
              <View style={{ position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <RNText style={{ color: c.onAccent, fontSize: 11, fontWeight: '700' }}>{count}</RNText>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: count ? 120 : 40 }}>
        <View style={{ width: '100%', maxWidth: 1040, alignSelf: 'center', gap: 28 }} onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}>
          {s.id === 'freshcart' && (
            <View style={{ backgroundColor: '#E2F3E6', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <RNText style={{ fontSize: 30 }}>🛵</RNText>
              <View style={{ flex: 1 }}>
                <RNText style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>Delivery today, 4–5 PM</RNText>
                <RNText style={{ color: c.muted, fontSize: 13 }}>From Riverside Market · {money(s.feeCents)} delivery</RNText>
              </View>
            </View>
          )}
          {s.id === 'trendbox' && (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {['For You', 'Beauty', 'Home', 'Fashion', 'Tech'].map((t, i) => (
                <View key={t} style={{ paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: i === 0 ? c.text : c.surface }}>
                  <RNText style={{ color: i === 0 ? c.bg : c.muted, fontWeight: '700', fontSize: 13 }}>{t}</RNText>
                </View>
              ))}
            </View>
          )}
          {s.sections.map((section) => (
            <View key={section.title} style={{ gap: 12 }}>
              <RNText style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{section.title}</RNText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                {tileWidth > 0 && section.products.map((p) => <ProductTile key={p.id} s={s} p={p} qty={cart?.[p.id] ?? 0} width={tileWidth} />)}
              </View>
            </View>
          ))}
          <RNText style={{ color: c.muted, fontSize: 12, textAlign: 'center', opacity: 0.8 }}>{DEMO_NOTICE}</RNText>
        </View>
      </ScrollView>

      {count > 0 && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/demo/checkout', params: { store: s.id } })}
            style={({ pressed }) => ({ width: '100%', maxWidth: 560, alignSelf: 'center', height: 54, borderRadius: 27, backgroundColor: c.accent, opacity: pressed ? 0.85 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 })}>
            <RNText style={{ color: c.onAccent, fontWeight: '800', fontSize: 16 }}>Checkout · {count} item{count === 1 ? '' : 's'}</RNText>
            <RNText style={{ color: c.onAccent, fontWeight: '800', fontSize: 16 }}>{money(subtotalCents)}</RNText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const GAP = 12;

function ProductTile({ s, p, qty, width }: { s: DemoStore; p: DemoProduct; qty: number; width: number }) {
  const c = s.colors;
  const add = useDemoCart((st) => st.add);
  const remove = useDemoCart((st) => st.remove);
  return (
    <View style={{ width, backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: c.line }}>
      <View style={{ aspectRatio: s.id === 'trendbox' ? 0.85 : 1.1, backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' }}>
        <RNText style={{ fontSize: 54 }}>{p.emoji}</RNText>
        {p.badge && (
          <View style={{ position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
            <RNText style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{p.badge}</RNText>
          </View>
        )}
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <RNText style={{ color: c.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{p.name}</RNText>
        <RNText style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{p.detail}</RNText>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <RNText style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{money(p.priceCents)}</RNText>
          {qty === 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${p.name}`}
              onPress={() => add(s.id, p.id)}
              style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
              <Plus size={18} color={c.onAccent} strokeWidth={2.6} />
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.accent, borderRadius: 17, height: 34 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${p.name}`} onPress={() => remove(s.id, p.id)} style={{ width: 32, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                <Minus size={16} color={c.onAccent} strokeWidth={2.6} />
              </Pressable>
              <RNText style={{ color: c.onAccent, fontWeight: '800', minWidth: 16, textAlign: 'center' }}>{qty}</RNText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Add another ${p.name}`} onPress={() => add(s.id, p.id)} style={{ width: 32, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={16} color={c.onAccent} strokeWidth={2.6} />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
