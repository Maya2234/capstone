import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, useWide } from '@/theme/theme';
import { MAX_WIDTH, space } from '@/theme/tokens';

import { IconButton } from './Button';
import { Text } from './Text';
import { usePageShown } from './usePageShown';

type Props = {
  children: ReactNode;
  title?: string;
  /** Right side of the title row. */
  action?: ReactNode;
  back?: boolean;
  /** Pages inside the tab shell already get top/bottom room from the nav. */
  inShell?: boolean;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Scrolling page with the warm canvas, centered max width and an optional title row. */
export function Screen({ children, title, action, back, inShell = true, maxWidth = MAX_WIDTH, contentStyle }: Props) {
  const t = useTheme();
  const wide = useWide();
  const insets = useSafeAreaInsets();
  usePageShown();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{
        paddingTop: inShell ? (wide ? space.xxl : space.md) : insets.top + space.md,
        paddingBottom: (inShell && !wide ? 110 : space.xxxl) + insets.bottom,
        paddingHorizontal: wide ? space.xxl : space.lg,
      }}
      keyboardShouldPersistTaps="handled">
      <View style={[{ width: '100%', maxWidth, alignSelf: 'center', gap: space.xl }, contentStyle]}>
        {(title || back) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}>
            {back && <IconButton icon={ArrowLeft} label="Back" onPress={goBack} tone="soft" />}
            {title && (
              <Text variant="h1" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
                {title}
              </Text>
            )}
            {action}
          </View>
        )}
        {children}
      </View>
    </ScrollView>
  );
}
