import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';

import { Text } from './Text';

type Variant = 'primary' | 'soft' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
};

const heights = { sm: 36, md: 46, lg: 54 };
const pad = { sm: 14, md: 20, lg: 24 };

export function Button({ label, variant = 'primary', size = 'md', icon: Icon, loading, full, disabled, style, ...rest }: Props) {
  const t = useTheme();
  const palette = {
    primary: { bg: t.primary, pressed: t.primaryPressed, fg: t.onPrimary, border: 'transparent' },
    soft: { bg: t.primarySoft, pressed: t.surfacePressed, fg: t.primarySoftText, border: 'transparent' },
    outline: { bg: 'transparent', pressed: t.surfacePressed, fg: t.text, border: t.border },
    ghost: { bg: 'transparent', pressed: t.surfacePressed, fg: t.primarySoftText, border: 'transparent' },
    danger: { bg: t.dangerSoft, pressed: t.dangerSoft, fg: t.danger, border: 'transparent' },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      {...rest}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: pad[size],
          backgroundColor: pressed || hovered ? palette.pressed : palette.bg,
          borderColor: palette.border,
          opacity: off && !loading ? 0.45 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {Icon && <Icon size={size === 'sm' ? 16 : 18} color={palette.fg} strokeWidth={2.2} />}
          <Text style={{ color: palette.fg, fontFamily: fonts.bold, fontSize: size === 'sm' ? 13 : 15 }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ icon: Icon, label, onPress, tone = 'plain', size = 40 }: { icon: LucideIcon; label: string; onPress?: () => void; tone?: 'plain' | 'soft'; size?: number }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed || hovered ? t.surfacePressed : tone === 'soft' ? t.surfaceAlt : 'transparent',
      })}>
      <Icon size={Math.round(size * 0.5)} color={t.text} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
