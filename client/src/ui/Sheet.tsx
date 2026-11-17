import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, useWide } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

import { IconButton } from './Button';
import { Text } from './Text';

/** Layout for modal routes: title + close, scrolling body, optional pinned footer. */
export function Sheet({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  const t = useTheme();
  const wide = useWide();
  const insets = useSafeAreaInsets();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: wide ? t.overlay : t.bg }}>
      <View
        style={[
          { flex: 1, backgroundColor: t.bg },
          wide && { maxWidth: 560, width: '100%', alignSelf: 'center', marginVertical: 40, borderRadius: radius.xl, overflow: 'hidden', boxShadow: t.shadowLg, maxHeight: 820 },
        ]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingTop: (wide ? space.xl : insets.top + space.md), paddingBottom: space.md }}>
          <Text variant="h1" accessibilityRole="header" style={{ flex: 1, fontSize: 26, lineHeight: 32 }}>{title}</Text>
          <IconButton icon={X} label="Close" onPress={close} tone="soft" />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer && (
          <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: (wide ? space.xl : insets.bottom + space.md), borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.bg }}>
            {footer}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
