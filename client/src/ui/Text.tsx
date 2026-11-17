import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/theme';
import { fonts, type Theme } from '@/theme/tokens';

const variants = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  h1: { fontFamily: fonts.displayHeavy, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  amount: { fontFamily: fonts.display, fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type Variant = keyof typeof variants;
type Tone = 'text' | 'muted' | 'subtle' | 'primary' | 'success' | 'danger' | 'warning' | 'inverse';

const toneColor = (t: Theme, tone: Tone) =>
  ({ text: t.text, muted: t.textMuted, subtle: t.textSubtle, primary: t.primarySoftText, success: t.success, danger: t.danger, warning: t.warning, inverse: '#FFFFFF' })[tone];

export function Text({ variant = 'body', tone = 'text', style, ...rest }: TextProps & { variant?: Variant; tone?: Tone }) {
  const t = useTheme();
  return <RNText {...rest} style={[variants[variant], { color: toneColor(t, tone) }, style]} />;
}
