import { router } from 'expo-router';
import { RefreshCw, TriangleAlert, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { isNetworkError } from '@/lib/errors';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

/**
 * Full-screen error, shown by the root layout's ErrorBoundary when a screen fails. A server
 * that can't be reached (the most common case in development: the dev server stopped) gets its
 * own message and a reload; anything else gets a generic one, with details in development.
 */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const offline = isNetworkError(error);
  const Icon = offline ? WifiOff : TriangleAlert;

  async function tryAgain() {
    setBusy(true);
    // A screen whose code failed to download stays failed until the page reloads.
    if (Platform.OS === 'web' && offline) {
      window.location.reload();
      return;
    }
    await retry();
    setBusy(false);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl }}>
      <View accessibilityRole="alert" style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: space.lg, alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: offline ? t.primarySoft : t.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={30} color={offline ? t.primarySoftText : t.danger} />
        </View>
        <View style={{ gap: space.sm, alignItems: 'center' }}>
          <Text variant="h1" accessibilityRole="header" style={{ textAlign: 'center' }}>
            {offline ? 'Can’t reach CardMaxx' : 'Something went wrong'}
          </Text>
          <Text tone="muted" style={{ textAlign: 'center' }}>
            {offline
              ? __DEV__
                ? 'The dev server isn’t responding. It may have stopped or run out of memory. Start it again, then try again.'
                : 'Check your internet connection, then try again.'
              : 'This screen hit a problem. Try again, or go back to Home.'}
          </Text>
        </View>

        {__DEV__ && offline && (
          <View style={{ alignSelf: 'stretch', gap: 6, padding: space.md, borderRadius: radius.lg, backgroundColor: t.surfaceAlt }}>
            <Text variant="small" tone="muted">In the client folder, run:</Text>
            <Text variant="bodyStrong" selectable style={{ fontFamily: Platform.select({ web: 'ui-monospace, Consolas, monospace', default: undefined }) }}>
              npm run web -- --port 8083
            </Text>
          </View>
        )}
        {__DEV__ && !offline && (
          <Text variant="small" tone="subtle" selectable style={{ textAlign: 'center' }}>{error.message}</Text>
        )}

        <View style={{ alignSelf: 'stretch', gap: space.sm }}>
          <Button label="Try again" icon={RefreshCw} onPress={tryAgain} loading={busy} disabled={busy} full />
          {!offline && <Button label="Go to Home" variant="ghost" onPress={() => { void retry(); router.replace('/'); }} full />}
        </View>
      </View>
    </ScrollView>
  );
}
