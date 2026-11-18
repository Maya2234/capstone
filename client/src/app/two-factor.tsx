import { router } from 'expo-router';
import { ShieldCheck, ShieldOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { confirm } from '@/lib/confirm';
import { removeTwoFactor, startTwoFactorSetup, verifiedFactor, verifyCode } from '@/services/auth';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

type Setup = { factorId: string; qrSvg: string; secret: string };

/** Turn two-factor login on (scan a QR code, confirm one code) or off. Opened from Settings. */
export default function TwoFactor() {
  const t = useTheme();
  const toast = useToast();
  const [factor, setFactor] = useState<{ id: string } | null | undefined>(undefined); // undefined = loading
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    verifiedFactor().then(setFactor, () => setFactor(null));
  }, []);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  async function begin() {
    setBusy(true);
    try {
      setSetup(await startTwoFactorSetup());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t start setup', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!setup) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6 digits your app shows');
      return;
    }
    setBusy(true);
    try {
      await verifyCode(setup.factorId, code);
      toast('Two-factor login is on');
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code didn’t work.');
      setCode('');
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!factor) return;
    const ok = await confirm('Turn off two-factor login?', 'Anyone with your password will be able to sign in without a code.', 'Turn off');
    if (!ok) return;
    setBusy(true);
    try {
      await removeTwoFactor(factor.id);
      toast('Two-factor login is off');
      done();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t turn it off', 'error');
      setBusy(false);
    }
  }

  if (factor === undefined) return <Sheet title="Two-factor login"><Text tone="muted">Loading…</Text></Sheet>;

  if (factor) {
    return (
      <Sheet title="Two-factor login" footer={<Button label="Turn off two-factor" icon={ShieldOff} variant="danger" onPress={turnOff} loading={busy} disabled={busy} full />}>
        <Surface style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <ShieldCheck size={28} color={t.success} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">On</Text>
            <Text variant="small" tone="muted">Signing in asks for a code from your authenticator app.</Text>
          </View>
        </Surface>
        <Text variant="small" tone="subtle">Changing phones? Turn this off on your old phone first, then set it up again on the new one.</Text>
      </Sheet>
    );
  }

  if (!setup) {
    return (
      <Sheet title="Two-factor login" footer={<Button label="Set up two-factor" icon={ShieldCheck} onPress={begin} loading={busy} disabled={busy} full />}>
        <Text>Add a second step to signing in: after your password, CardMaxx asks for a 6-digit code from an authenticator app on your phone. Someone who learns your password still can’t get in.</Text>
        <Text variant="small" tone="muted">You’ll need an authenticator app, such as Google Authenticator, Microsoft Authenticator, 1Password or Authy.</Text>
      </Sheet>
    );
  }

  return (
    <Sheet title="Scan this code" footer={<Button label="Turn on two-factor" onPress={finish} loading={busy} disabled={busy} full />}>
      <Text>1. In your authenticator app, add an account and scan this QR code.</Text>
      <View style={{ alignSelf: 'center', padding: space.md, backgroundColor: '#fff', borderRadius: radius.lg }}>
        <SvgXml xml={setup.qrSvg} width={200} height={200} />
      </View>
      <View style={{ gap: 4 }}>
        <Text variant="small" tone="muted">Can’t scan? Enter this key instead:</Text>
        <Text variant="bodyStrong" selectable style={{ letterSpacing: 1 }}>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</Text>
      </View>
      <Text>2. Type the 6-digit code it shows.</Text>
      <Input
        label="6-digit code"
        value={code}
        onChangeText={(v) => {
          setCode(v.replace(/\D/g, '').slice(0, 6));
          setError('');
        }}
        onSubmitEditing={finish}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        maxLength={6}
        error={error}
      />
    </Sheet>
  );
}
