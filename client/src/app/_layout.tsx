import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHydrated, useStore } from '@/data/store';
import { startAuthSync } from '@/data/sync';
import { useIdleSignOut } from '@/lib/idle';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { ErrorScreen } from '@/ui/ErrorScreen';
import { LoadingScreen } from '@/ui/LoadingScreen';
import { ToastProvider } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync();

/**
 * Catches any screen that fails to load or render, for example when the dev server stops and
 * a screen's code can't be downloaded ("Failed to fetch"), and shows a readable error instead.
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const hydrated = useHydrated();
  const authReady = useStore((s) => s.authReady);
  const ready = (fontsLoaded || !!fontError) && hydrated && authReady;

  useEffect(() => {
    startAuthSync();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <LoadingScreen />;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <Navigator />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigator() {
  const t = useTheme();
  const signedIn = useStore((s) => !!s.session);
  const codeNeeded = useStore((s) => s.codeNeeded);
  const enteringApp = useStore((s) => s.enteringApp);
  // Never leave the loading screen up for good if a page somehow doesn't report in.
  useEffect(() => {
    if (!enteringApp) return;
    const timer = setTimeout(() => useStore.getState().setEnteringApp(false), 15_000);
    return () => clearTimeout(timer);
  }, [enteringApp]);
  useIdleSignOut(signedIn);
  // On web the sheet floats over the current page; on phones it slides up as a native modal.
  const sheet =
    Platform.OS === 'web'
      ? { presentation: 'transparentModal' as const, animation: 'fade' as const, contentStyle: { backgroundColor: 'transparent' } }
      : { presentation: 'modal' as const, animation: 'slide_from_bottom' as const };
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="account/[id]" />
          <Stack.Screen name="card/[id]" />
          <Stack.Screen name="link" options={sheet} />
          <Stack.Screen name="add-card" options={sheet} />
          <Stack.Screen name="budgets" options={sheet} />
          <Stack.Screen name="spending/[category]" options={sheet} />
          <Stack.Screen name="two-factor" options={sheet} />
          <Stack.Screen name="merchant-category" options={sheet} />
          <Stack.Screen name="setup-cards" options={sheet} />
          <Stack.Screen name="categories" options={sheet} />
          <Stack.Screen name="category-edit" options={sheet} />
          <Stack.Screen name="stores" />
          <Stack.Screen name="demo/[store]" />
          <Stack.Screen name="demo/checkout" />
          <Stack.Screen name="new-password" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn && codeNeeded}>
          <Stack.Screen name="verify-code" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn && !codeNeeded}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      {/* Between signing in and the first page appearing: the sign-in form would otherwise sit there. */}
      {enteringApp && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
          <LoadingScreen />
        </View>
      )}
    </View>
  );
}
