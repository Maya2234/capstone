import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';

import { Text } from './Text';

export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useTheme();
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(value ? 20 : 0, { damping: 18, stiffness: 260 }) }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync();
        onChange(!value);
      }}
      hitSlop={8}
      style={[styles.track, { backgroundColor: value ? t.primary : t.scheme === 'dark' ? '#3A3460' : '#D9D3E8' }]}>
      <Animated.View style={[styles.knob, knob]} />
    </Pressable>
  );
}

export function Segmented<V extends string>({ value, options, onChange, label }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; label: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.seg, { backgroundColor: t.surfaceAlt }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && { backgroundColor: t.surface, boxShadow: t.shadow }]}>
            <Text variant="smallStrong" tone={on ? 'text' : 'muted'}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? t.text : t.surface, borderColor: on ? t.text : t.border }]}>
      <Text variant="smallStrong" style={{ color: on ? t.bg : t.textMuted }}>{label}</Text>
    </Pressable>
  );
}

type InputProps = TextInputProps & { label: string; hideLabel?: boolean; error?: string; hint?: string; prefix?: string };

export function Input({ label, hideLabel, error, hint, prefix, style, onFocus, onBlur, ...rest }: InputProps) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {!hideLabel && <Text variant="smallStrong" tone="muted">{label}</Text>}
      <View
        style={[
          styles.field,
          { backgroundColor: t.surface, borderColor: error ? t.danger : focus ? t.primary : t.border },
          focus && { boxShadow: `0px 0px 0px 4px ${t.primarySoft}` },
        ]}>
        {prefix && <Text variant="bodyStrong" tone="muted">{prefix}</Text>}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={t.textSubtle}
          {...rest}
          onFocus={(e) => { setFocus(true); onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); onBlur?.(e); }}
          style={[styles.input, { color: t.text }, style]}
        />
      </View>
      {error ? <Text variant="small" tone="danger">{error}</Text> : hint ? <Text variant="small" tone="subtle">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', boxShadow: '0px 1px 3px rgba(0,0,0,0.25)' },
  seg: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, alignSelf: 'flex-start' },
  segItem: { paddingHorizontal: 16, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 50 },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 12, outlineStyle: 'none' } as never,
});
