import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { signOut, verifiedFactor, verifyCode } from '@/services/auth';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/controls';
import { Mark } from '@/ui/Logo';
import { Text } from '@/ui/Text';

/**
 * Second sign-in step for people with two-factor on. The password is already checked; this asks
 * for the 6-digit code. Once it's right, Supabase upgrades the session and the app opens
 * (src/data/sync.ts picks that up), so there's nothing to navigate to here.
 */
export default function VerifyCode() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6 digits from your authenticator app');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const factor = await verifiedFactor();
      if (!factor) throw new Error('Couldn’t find your authenticator. Sign in again.');
      await verifyCode(factor.id, code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code didn’t work.');
      setCode('');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }}
        keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: space.lg }}>
          <View style={{ alignItems: 'center', marginBottom: space.sm }}>
            <Mark size={56} />
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={22} color={t.primary} />
              <Text variant="h1" accessibilityRole="header">Enter your code</Text>
            </View>
            <Text tone="muted">Open your authenticator app and type the 6-digit code for CardMaxx.</Text>
          </View>
          <Input
            label="6-digit code"
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            onSubmitEditing={submit}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            autoFocus
            error={error}
          />
          <Button label="Verify" onPress={submit} loading={busy} disabled={busy} full />
          <Button label="Use a different account" variant="ghost" onPress={() => signOut()} disabled={busy} full />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
