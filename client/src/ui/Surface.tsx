import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** The rounded white (or deep purple, in dark mode) panel everything sits on. */
export function Surface({ children, style, padded = true, onPress, accessibilityLabel }: Props) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: t.border,
    padding: padded ? space.xl : 0,
    boxShadow: t.shadow,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [base, (pressed || hovered) && { backgroundColor: t.surfaceAlt }, style]}>
      {children}
    </Pressable>
  );
}
