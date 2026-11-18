import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Platform, useColorScheme, useWindowDimensions } from 'react-native';

import { useStore } from '@/data/store';

import { themes, WIDE, type Theme } from './tokens';

const Ctx = createContext<Theme>(themes.light);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const appearance = useStore((s) => s.prefs.appearance);
  const scheme = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;
  useAutofillColors(themes[scheme]);
  return <Ctx.Provider value={themes[scheme]}>{children}</Ctx.Provider>;
}

/**
 * Web only: browsers paint fields they autofill (saved email, password) with their own
 * light-blue background and black text, which clashes with the app, especially in dark mode.
 * This paints our field color over it instead. CSS pseudo-classes can't be set through
 * React Native styles, so it's a small stylesheet in the page head, updated with the theme.
 */
function useAutofillColors(t: Theme) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let tag = document.getElementById('cmx-autofill') as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'cmx-autofill';
      document.head.appendChild(tag);
    }
    const sel = ['', ':hover', ':focus', ':active'].map((s) => `input:-webkit-autofill${s}, textarea:-webkit-autofill${s}`).join(', ');
    tag.textContent = `${sel} {
  -webkit-box-shadow: 0 0 0 1000px ${t.surface} inset !important;
  box-shadow: 0 0 0 1000px ${t.surface} inset !important;
  -webkit-text-fill-color: ${t.text} !important;
  caret-color: ${t.text};
  transition: background-color 600000s 0s;
}`;
  }, [t]);
}

export const useTheme = () => useContext(Ctx);

export function useWide() {
  return useWindowDimensions().width >= WIDE;
}
