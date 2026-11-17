import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

import { Text } from './Text';

export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const t = useTheme();
  return (
    <View>
      {items.map((it, i) => (
        <View key={it.q} style={i > 0 && { borderTopWidth: 1, borderTopColor: t.border }}>
          <Item q={it.q} a={it.a} />
        </View>
      ))}
    </View>
  );
}

function Item({ q, a }: { q: string; a: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 180 }) }] }));
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
        <Text variant="bodyStrong" style={{ flex: 1 }}>{q}</Text>
        <Animated.View style={chevron}>
          <ChevronDown size={20} color={t.textMuted} />
        </Animated.View>
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(180)} style={{ paddingBottom: space.lg, paddingRight: space.xxl }}>
          <Text tone="muted">{a}</Text>
        </Animated.View>
      )}
    </View>
  );
}
