import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { updatePassword } from '@/services/auth';
import { space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

/** Where a password reset link lands. The link has already signed the person in. */
export default function NewPassword() {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const e: Record<string, string> = {};
    if (password.length < 8) e.password = 'At least 8 characters';
    else if (confirm !== password) e.confirm = 'Passwords don’t match';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await updatePassword(password);
      toast('Password updated');
      router.replace('/');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Couldn’t update your password', 'error');
      setBusy(false);
    }
  }

  return (
    <Screen title="New password" back inShell={false} maxWidth={480}>
      <Surface style={{ gap: space.lg }}>
        <Text tone="muted">Choose a new password for your CardMaxx account.</Text>
        <View style={{ gap: space.md }}>
          <Input label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} />
          <Input label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" error={errors.confirm} onSubmitEditing={save} />
        </View>
        <Button label="Save password" size="lg" onPress={save} loading={busy} full />
      </Surface>
    </Screen>
  );
}
