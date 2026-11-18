import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { NO_MATCH, sendPasswordReset, signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/services/auth';
import { useTheme, useWide } from '@/theme/theme';
import { palette, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/controls';
import { Mark, Wordmark } from '@/ui/Logo';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

export default function SignIn() {
  const t = useTheme();
  const wide = useWide();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.bg }}>
      {wide && <BrandPanel />}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }}
          keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: space.xl }}>
            {!wide && (
              <View style={{ alignItems: 'center', gap: space.lg, marginBottom: space.md }}>
                <Mark size={64} />
                <Wordmark height={30} showMark={false} />
              </View>
            )}
            <Form />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function BrandPanel() {
  return (
    <View style={styles.panel}>
      <LinearGradient colors={[palette.indigo, palette.violet, palette.orchid]} locations={[0, 0.65, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* Big quarter tiles, echoing the logo and the poster */}
      <Svg width="100%" height="100%" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <Path d="M600 0 L420 0 A180 180 0 0 0 600 180 Z" fill="#fff" opacity={0.16} />
        <Path d="M420 180 L420 0 A180 180 0 0 0 240 180 Z" fill={palette.blush} opacity={0.22} />
        <Path d="M0 800 L0 560 A240 240 0 0 1 240 800 Z" fill="#fff" opacity={0.12} />
        <Path d="M240 800 L240 560 A240 240 0 0 1 480 800 Z" fill={palette.periwinkle} opacity={0.35} />
      </Svg>
      <View style={{ padding: 48, flex: 1, justifyContent: 'space-between' }}>
        <Wordmark height={34} tone="#FFFFFF" />
        <View style={{ gap: space.md, maxWidth: 420 }}>
          <Text variant="hero" tone="inverse" style={{ fontSize: 48, lineHeight: 52 }}>Put Your Cards to Work.</Text>
          <Text variant="body" tone="inverse" style={{ opacity: 0.9, fontSize: 17, lineHeight: 26 }}>
            All your cards in one place, your best card automatically selected at checkout.
          </Text>
        </View>
      </View>
    </View>
  );
}

function Form() {
  const t = useTheme();
  const toast = useToast();
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [noMatch, setNoMatch] = useState(false);

  async function google() {
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Google sign-in didn’t finish', 'error');
      setBusy(null);
    }
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (mode === 'up' && !name.trim()) e.name = 'Add your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email';
    if (password.length < 8) e.password = 'At least 8 characters';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy('email');
    try {
      // On success the auth listener loads this user's data and the app opens (src/data/sync.ts).
      if (mode === 'up') {
        const { needsConfirmation } = await signUpWithEmail(name, email, password);
        if (needsConfirmation) {
          toast(`Check ${email.trim()} for a link to confirm your account`);
          setMode('in');
          setBusy(null);
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Couldn’t sign in';
      if (message === NO_MATCH) setNoMatch(true);
      else toast(message, 'error');
      setBusy(null);
    }
  }

  function switchMode(next: 'in' | 'up' | 'reset') {
    setMode(next);
    setErrors({});
    setNoMatch(false);
    setSentTo(null);
  }

  async function sendReset() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrors({ email: 'Enter a valid email' });
      return;
    }
    setErrors({});
    setBusy('email');
    try {
      await sendPasswordReset(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Couldn’t send the link', 'error');
    } finally {
      setBusy(null);
    }
  }

  if (mode === 'reset') {
    return (
      <View style={{ gap: space.lg }}>
        <View style={{ gap: 6 }}>
          <Text variant="h1" accessibilityRole="header">Reset your password</Text>
          <Text tone="muted">Enter the email you sign in with and we’ll send you a link to choose a new password.</Text>
        </View>
        <Input
          label="Email"
          value={email}
          onChangeText={(v) => { setEmail(v); setSentTo(null); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoFocus
          error={errors.email}
          onSubmitEditing={sendReset}
        />
        {sentTo && (
          <View accessibilityRole="alert" style={[styles.alert, { backgroundColor: t.successSoft }]}>
            {/* Same message whether or not the account exists, so this can't be used to test emails. */}
            <Text variant="small" tone="success">If there’s an account for {sentTo}, a reset link is on its way. Check your inbox and spam folder.</Text>
          </View>
        )}
        <Button label={sentTo ? 'Send again' : 'Send reset link'} size="lg" onPress={sendReset} loading={busy === 'email'} full />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Text variant="small" tone="muted">Remembered it?</Text>
          <Pressable accessibilityRole="button" onPress={() => switchMode('in')} hitSlop={8}>
            <Text variant="smallStrong" tone="primary">Back to sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: 6 }}>
        <Text variant="h1" accessibilityRole="header">{mode === 'in' ? 'Welcome back' : 'Create your account'}</Text>
        <Text tone="muted">{mode === 'in' ? 'Sign in to CardMaxx' : 'It’s free, and takes a minute.'}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        onPress={google}
        disabled={!!busy}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.google,
          { backgroundColor: pressed || hovered ? t.surfaceAlt : t.surface, borderColor: t.border, opacity: busy && busy !== 'google' ? 0.5 : 1 },
        ]}>
        <GoogleG />
        <Text variant="bodyStrong">{busy === 'google' ? 'Connecting…' : 'Continue with Google'}</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
        <Text variant="small" tone="subtle">or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
      </View>

      {mode === 'up' && <Input label="Name" value={name} onChangeText={setName} autoComplete="name" error={errors.name} />}
      <Input
        label="Email"
        value={email}
        onChangeText={(v) => { setEmail(v); setNoMatch(false); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={errors.email}
      />
      <Input
        label="Password"
        value={password}
        onChangeText={(v) => { setPassword(v); setNoMatch(false); }}
        secureTextEntry
        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        error={errors.password}
        onSubmitEditing={submit}
      />
      {mode === 'in' && (
        <Pressable accessibilityRole="button" onPress={() => switchMode('reset')} style={{ alignSelf: 'flex-end', marginTop: -6 }} hitSlop={8}>
          <Text variant="smallStrong" tone="primary">Forgot password?</Text>
        </Pressable>
      )}
      {mode === 'in' && noMatch && (
        <View accessibilityRole="alert" style={[styles.alert, { backgroundColor: t.dangerSoft }]}>
          <Text variant="small" tone="danger">{NO_MATCH}</Text>
          <Pressable accessibilityRole="button" onPress={() => switchMode('up')} hitSlop={8}>
            <Text variant="smallStrong" tone="danger" style={{ textDecorationLine: 'underline' }}>New here? Create an account with this email</Text>
          </Pressable>
        </View>
      )}
      <Button label={mode === 'in' ? 'Sign in' : 'Create account'} size="lg" onPress={submit} loading={busy === 'email'} disabled={busy === 'google'} full />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Text variant="small" tone="muted">{mode === 'in' ? 'New to CardMaxx?' : 'Already have an account?'}</Text>
        <Pressable accessibilityRole="button" onPress={() => switchMode(mode === 'in' ? 'up' : 'in')} hitSlop={8}>
          <Text variant="smallStrong" tone="primary">{mode === 'in' ? 'Create an account' : 'Sign in'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, maxWidth: 640, overflow: 'hidden', borderTopRightRadius: radius.xl, borderBottomRightRadius: radius.xl },
  alert: { borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  google: { height: 52, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
