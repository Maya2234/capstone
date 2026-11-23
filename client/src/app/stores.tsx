import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text as RNText, View } from 'react-native';

import { CATEGORIES } from '@/data/categories';
import { DEMO_NOTICE, STORES } from '@/demo/stores';
import { useWide } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { CategoryIcon } from '@/ui/bits';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

/**
 * Demo stores: two pretend shops for showing CardMaxx checkout. Each is a different spending
 * category, so CardMaxx picks a different card in each.
 */
export default function DemoStores() {
  const wide = useWide();
  return (
    <Screen back title="Try CardMaxx checkout" inShell={false} maxWidth={wide ? 900 : undefined}>
      <Text tone="muted">
        Shop at a pretend store and check out with CardMaxx. It picks the card in your Wallet that earns the most for that kind of purchase. Nothing is charged.
      </Text>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}>
        {STORES.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${s.name}, a demo ${s.categoryLabel.toLowerCase()} store`}
            onPress={() => router.push({ pathname: '/demo/[store]', params: { store: s.id } })}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              { flex: wide ? 1 : undefined, borderRadius: radius.xl, padding: space.xl, gap: space.lg, backgroundColor: s.colors.bg, borderWidth: 1, borderColor: s.colors.line, minHeight: 210, justifyContent: 'space-between' },
              (pressed || hovered) && { transform: [{ translateY: -2 }], boxShadow: '0px 14px 32px rgba(0,0,0,0.18)' },
            ]}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {s.sections[0].products.slice(0, 4).map((p) => (
                <View key={p.id} style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' }}>
                  <RNText style={{ fontSize: 28 }}>{p.emoji}</RNText>
                </View>
              ))}
            </View>
            <View style={{ gap: 4 }}>
              <RNText style={{ color: s.colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>{s.name}</RNText>
              <RNText style={{ color: s.colors.muted, fontSize: 14 }}>{s.tagline}</RNText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: s.colors.surface, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: radius.pill }}>
                <CategoryIcon category={s.category} size={28} />
                <RNText style={{ color: s.colors.text, fontSize: 13, fontWeight: '600' }}>{CATEGORIES[s.category].label}</RNText>
              </View>
              <ChevronRight size={22} color={s.colors.text} />
            </View>
          </Pressable>
        ))}
      </View>
      <Text variant="small" tone="subtle" style={{ textAlign: 'center' }}>{DEMO_NOTICE}</Text>
    </Screen>
  );
}
