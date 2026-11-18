import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Text as RNText, StyleSheet, View } from 'react-native';

import { palette } from '@/theme/tokens';

import { Mark, Wordmark } from './Logo';

/**
 * Shown from the first moment until the app is ready (fonts, saved settings, sign-in and the
 * user's data). It's also what the server sends as the page's first HTML, so the logo and
 * spinner show before any JavaScript has loaded. Doesn't depend on the theme or the custom
 * fonts, since neither is ready yet: the brand gradient reads the same in light and dark.
 */
export function LoadingScreen() {
  return (
    <View style={StyleSheet.absoluteFill} accessibilityRole="progressbar" accessibilityLabel="Loading CardMaxx">
      <LinearGradient colors={[palette.indigo, palette.violet, palette.orchid]} locations={[0, 0.65, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Mark size={72} mono="#FFFFFF" />
        <Wordmark height={30} showMark={false} tone="#FFFFFF" />
        <ActivityIndicator color="#FFFFFF" size="small" style={{ marginTop: 28 }} />
        <RNText style={styles.caption}>Getting your cards ready…</RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  caption: { color: '#FFFFFF', opacity: 0.85, fontSize: 14, marginTop: 4, textAlign: 'center' },
});
