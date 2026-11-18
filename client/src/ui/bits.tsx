import { Image } from 'expo-image';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { CATEGORIES, type CategoryId } from '@/data/categories';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

import { Text, type Variant } from './Text';

export function Money({ cents, variant = 'amount', whole, sign, tone, style }: { cents: number; variant?: Variant; whole?: boolean; sign?: boolean; tone?: 'text' | 'muted' | 'success' | 'danger' | 'inverse'; style?: object }) {
  return (
    <Text variant={variant} tone={tone} style={style}>
      {money(cents, { whole, sign })}
    </Text>
  );
}

export function SectionHeader({ title, action, style }: { title: string; action?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }, style]}>
      <Text variant="h2" accessibilityRole="header">{title}</Text>
      {action}
    </View>
  );
}

export function Avatar({ name, uri, size = 40 }: { name: string; uri?: string; size?: number }) {
  const t = useTheme();
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={name} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, lineHeight: size * 0.5, fontFamily: 'BricolageGrotesque_700Bold', color: t.primarySoftText }}>{initials}</Text>
    </View>
  );
}

/** Rounded-square badge with the bank's first letter in its color. */
export function InstitutionBadge({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: size * 0.42, lineHeight: size * 0.52 }}>{name[0]}</Text>
    </View>
  );
}

export function CategoryIcon({ category, size = 40 }: { category: CategoryId; size?: number }) {
  const t = useTheme();
  const c = CATEGORIES[category];
  const Icon = c.icon;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.color + (t.scheme === 'dark' ? '33' : '26'), alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.48} color={t.scheme === 'dark' ? c.color : shade(c.color)} strokeWidth={2.1} />
    </View>
  );
}

// Darken a hex color so icons on tinted circles keep enough contrast in light mode.
function shade(hex: string, k = 0.72) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * k).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

type RowProps = {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  accessibilityLabel?: string;
};

export function Row({ left, title, subtitle, right, onPress, chevron, accessibilityLabel }: RowProps) {
  const t = useTheme();
  const body = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="small" tone="muted" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron && <ChevronRight size={18} color={t.textSubtle} />}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, paddingVertical: 12, paddingHorizontal: space.md, borderRadius: radius.lg };
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [style, (pressed || hovered) && { backgroundColor: t.surfaceAlt }]}>
      {body}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.border, marginLeft: inset }} />;
}

export function Badge({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'success' | 'warning' | 'neutral' | 'danger' }) {
  const t = useTheme();
  const c = {
    primary: [t.primarySoft, t.primarySoftText],
    success: [t.successSoft, t.success],
    warning: [t.warningSoft, t.warning],
    danger: [t.dangerSoft, t.danger],
    neutral: [t.surfaceAlt, t.textMuted],
  }[tone];
  return (
    <View style={{ backgroundColor: c[0], borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text variant="smallStrong" style={{ color: c[1], fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Icon size={26} color={t.primarySoftText} />
      </View>
      <Text variant="h3" style={{ textAlign: 'center' }}>{title}</Text>
      {body ? <Text variant="small" tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>{body}</Text> : null}
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}
