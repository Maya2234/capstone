import React, { createContext, useContext } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextStyle, useColorScheme, View, ViewStyle } from 'react-native';

const light = {
  bg: '#f6f7f9', surface: '#ffffff', text: '#111827', muted: '#6b7280', line: '#e5e7eb',
  accent: '#111827', accentText: '#ffffff', good: '#047857', bad: '#b91c1c', warn: '#b45309', chip: '#f3f4f6',
  brand: ['#A78BFA', '#38BDF8', '#34D399'],
};
const dark: typeof light = {
  bg: '#0b1020', surface: '#111827', text: '#f3f4f6', muted: '#9ca3af', line: '#1f2937',
  accent: '#f3f4f6', accentText: '#111827', good: '#34d399', bad: '#f87171', warn: '#fbbf24', chip: '#1f2937',
  brand: ['#A78BFA', '#38BDF8', '#34D399'],
};
export type Theme = typeof light;

const ThemeCtx = createContext<Theme>(light);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  return <ThemeCtx.Provider value={scheme === 'dark' ? dark : light}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

export function T({ children, style, muted, size = 15, weight, color, numberOfLines }: {
  children: React.ReactNode; style?: TextStyle; muted?: boolean; size?: number; weight?: TextStyle['fontWeight']; color?: string; numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: color ?? (muted ? t.muted : t.text), fontSize: size, fontWeight: weight, lineHeight: size * 1.4 }, style]}>
      {children}
    </Text>
  );
}

export function Box({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.line }, style]}>{children}</View>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Button({ title, onPress, kind = 'primary', disabled, busy }: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; busy?: boolean;
}) {
  const t = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.btn, {
        backgroundColor: primary ? t.accent : 'transparent',
        borderColor: kind === 'danger' ? t.bad : primary ? t.accent : t.line,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      }]}
    >
      {busy ? <ActivityIndicator color={primary ? t.accentText : t.text} /> :
        <T weight="600" color={primary ? t.accentText : kind === 'danger' ? t.bad : t.text}>{title}</T>}
    </Pressable>
  );
}

export function Chip({ text, active, onPress }: { text: string; active?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={[styles.chip, { backgroundColor: active ? t.accent : t.chip }]}>
      <T size={13} weight="600" color={active ? t.accentText : t.text}>{text}</T>
    </Pressable>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: t.chip }]}>
      <View style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: color ?? t.accent, height: '100%', borderRadius: 4 }} />
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return <View style={{ padding: 40 }}><ActivityIndicator color={t.text} /></View>;
}

export function ErrorText({ error }: { error: unknown }) {
  const t = useTheme();
  if (!error) return null;
  return <T color={t.bad} style={{ marginVertical: 8 }}>{error instanceof Error ? error.message : String(error)}</T>;
}

export function Logo({ size = 22 }: { size?: number }) {
  const t = useTheme();
  const w = size * 0.72, h = size * 0.5;
  return (
    <View style={{ width: size, height: size }}>
      {t.brand.map((c, i) => (
        <View key={c} style={{ position: 'absolute', width: w, height: h, borderRadius: 4, backgroundColor: c, left: (2 - i) * size * 0.1, top: i * size * 0.17 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  btn: { minHeight: 46, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginRight: 6, marginBottom: 6 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
});
