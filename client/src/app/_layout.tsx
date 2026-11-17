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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHydrated, useStore } from '@/data/store';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { ToastProvider } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync();

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
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
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
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}
