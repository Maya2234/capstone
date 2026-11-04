import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/session';
import { Box, Button, ErrorText, Logo, T, useTheme } from '@/ui';

export default function SignIn() {
  const { signIn } = useSession();
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    if (!email.includes('@')) return setError(new Error('Enter your email address'));
    setBusy(true);
    setError(null);
    try {
      // Development sign-in. With GOOGLE_CLIENT_ID set on the server, this is
      // replaced by a Google ID token from Google Sign-In (REQ-02).
      await signIn('dev:' + email.trim());
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.inner}>
          <View style={styles.brand}><Logo size={36} /><T size={28} weight="800">CardStack</T></View>
          <T muted size={16} style={{ marginBottom: 24 }}>
            One checkout button. Every purchase charged to the card that earns you the most.
          </T>
          <Box>
            <T weight="700" size={17} style={{ marginBottom: 10 }}>Sign in</T>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onSubmitEditing={submit}
              style={[styles.input, { borderColor: t.line, color: t.text, backgroundColor: t.bg }]}
            />
            <ErrorText error={error} />
            <Button title="Continue" onPress={submit} busy={busy} />
            <T muted size={12} style={{ marginTop: 10 }}>
              Development sign-in. Use the same email at checkout to pay with your linked cards.
            </T>
          </Box>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 440, alignSelf: 'center', padding: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
});
