import { palette } from '@/brand/glyphs';

export { palette };

const light = {
  scheme: 'light' as 'light' | 'dark',
  bg: '#F6F2FA', // warm lilac canvas, never plain white
  bgDeep: '#EFE9F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EFFA',
  surfacePressed: '#EEE9F7',
  border: '#E8E2F2',
  text: palette.ink as string,
  textMuted: '#625E80',
  textSubtle: '#8E8AA8',
  primary: palette.indigo as string,
  primaryPressed: '#332DC4',
  onPrimary: '#FFFFFF',
  primarySoft: '#E9E7FE',
  primarySoftText: '#3A33C9',
  success: '#1B8A5E',
  successSoft: '#DDF4E9',
  danger: '#C8344F',
  dangerSoft: '#FBE3E8',
  warning: '#B86E0E',
  warningSoft: '#FCEFD9',
  overlay: 'rgba(26,22,64,0.38)',
  shadow: '0px 1px 2px rgba(26,22,64,0.04), 0px 10px 30px rgba(64,57,223,0.07)',
  shadowLg: '0px 18px 50px rgba(64,57,223,0.18)',
};

export type Theme = typeof light;

const dark: Theme = {
  scheme: 'dark',
  bg: '#110E24',
  bgDeep: '#0C0A1C',
  surface: '#1B1736',
  surfaceAlt: '#231E44',
  surfacePressed: '#2A2450',
  border: '#2E2853',
  text: '#F4F2FB',
  textMuted: '#B3AED0',
  textSubtle: '#847FA6',
  primary: '#8A87FA',
  primaryPressed: '#7471EC',
  onPrimary: '#120F2B',
  primarySoft: '#2A2563',
  primarySoftText: '#C9C7FF',
  success: '#5BD3A0',
  successSoft: '#163A2E',
  danger: '#FF8197',
  dangerSoft: '#43192A',
  warning: '#F5B65A',
  warningSoft: '#3D2C12',
  overlay: 'rgba(5,4,14,0.6)',
  shadow: '0px 1px 2px rgba(0,0,0,0.3)',
  shadowLg: '0px 18px 50px rgba(0,0,0,0.45)',
};

export const themes = { light, dark };

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  body: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const WIDE = 900; // px where the layout switches to the desktop header + columns
export const MAX_WIDTH = 1160;
