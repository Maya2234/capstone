import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';

import { useStore } from '@/data/store';

import { themes, WIDE, type Theme } from './tokens';

const Ctx = createContext<Theme>(themes.light);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const appearance = useStore((s) => s.prefs.appearance);
  const scheme = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;
  return <Ctx.Provider value={themes[scheme]}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

export function useWide() {
  return useWindowDimensions().width >= WIDE;
}
