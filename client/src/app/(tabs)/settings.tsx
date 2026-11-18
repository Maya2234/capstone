import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, KeyRound, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useStore } from '@/data/store';
import type { Prefs } from '@/data/types';
import { sendPasswordReset, signOut } from '@/services/auth';
import { useTheme, useWide } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Avatar, Divider, Row, SectionHeader } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { Input, Segmented, Switch } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

export default function Settings() {
  const wide = useWide();
  return (
    <Screen title="Settings" maxWidth={wide ? 980 : undefined}>
      {wide ? (
        <View style={{ flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.2 }}><Profile /></View>
          <View style={{ flex: 1, gap: space.xl }}>
            <Preferences />
            <Account />
          </View>
        </View>
      ) : (
        <>
          <Profile />
          <Preferences />
          <Account />
        </>
      )}
    </Screen>
  );
}

function Profile() {
  const t = useTheme();
  const toast = useToast();
  const profile = useStore((s) => s.profile);
  const update = useStore((s) => s.updateProfile);
  const [form, setForm] = useState(profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = (['name', 'username', 'email', 'phone'] as const).some((k) => form[k] !== profile[k]);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      update({ photoUri: res.assets[0].uri });
      toast('Photo updated');
    }
  }

  function save() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Add your name';
    if (!/^[a-z0-9_.]{3,24}$/.test(form.username)) e.username = '3–24 lowercase letters, numbers, . or _';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (form.phone && form.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a 10-digit number';
    setErrors(e);
    if (Object.keys(e).length) return;
    update({ name: form.name.trim(), username: form.username, email: form.email.trim(), phone: form.phone.trim() });
    toast('Profile saved');
  }

  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="Profile" />
      <Surface style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={pickPhoto}>
            <Avatar name={profile.name} uri={profile.photoUri} size={72} />
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.surface }}>
              <Camera size={14} color={t.onPrimary} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text variant="h2" numberOfLines={1}>{profile.name}</Text>
            <Text variant="small" tone="muted">@{profile.username}</Text>
          </View>
        </View>
        <Input label="Name" value={form.name} onChangeText={set('name')} autoComplete="name" error={errors.name} />
        <Input label="Username" value={form.username} onChangeText={(v) => set('username')(v.toLowerCase())} autoCapitalize="none" prefix="@" error={errors.username} />
        <Input label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
        <Input label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" placeholder="(555) 555-0123" error={errors.phone} />
        <Button label="Save changes" onPress={save} disabled={!dirty} full />
      </Surface>
    </View>
  );
}

function Preferences() {
  const prefs = useStore((s) => s.prefs);
  const setPref = useStore((s) => s.setPref);
  const budgetCount = useStore((s) => s.budgets.length);
  const toggle = (k: 'showNetWorth' | 'cardSuggestions', label: string) => (
    <Row title={label} right={<Switch value={prefs[k]} onChange={(v) => setPref(k, v)} label={label} />} />
  );
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="Preferences" />
      <Surface padded={false} style={{ padding: space.sm }}>
        {toggle('showNetWorth', 'Show net worth on Home')}
        <Divider inset={12} />
        {toggle('cardSuggestions', 'Suggest cards that earn more')}
        <Divider inset={12} />
        <Row
          title="Monthly budgets"
          subtitle={budgetCount ? `${budgetCount} ${budgetCount === 1 ? 'category' : 'categories'}` : 'Not set'}
          onPress={() => router.push('/budgets')}
          chevron
        />
        <Divider inset={12} />
        <View style={{ padding: space.md, gap: space.md }}>
          <Text variant="bodyStrong">Appearance</Text>
          <Segmented<Prefs['appearance']>
            label="Appearance"
            value={prefs.appearance}
            onChange={(v) => setPref('appearance', v)}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </View>
      </Surface>
    </View>
  );
}

function Account() {
  const t = useTheme();
  const toast = useToast();
  const email = useStore((s) => s.profile.email);
  const [sending, setSending] = useState(false);
  async function reset() {
    setSending(true);
    try {
      await sendPasswordReset(email);
      toast(`Reset link sent to ${email}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t send the link', 'error');
    } finally {
      setSending(false);
    }
  }
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="Security" />
      <Surface padded={false} style={{ padding: space.sm }}>
        <Row
          onPress={sending ? undefined : reset}
          left={<KeyRound size={20} color={t.textMuted} />}
          title="Reset password"
          subtitle="We’ll email you a link"
          chevron
        />
        <Divider inset={12} />
        <Row onPress={() => signOut()} left={<LogOut size={20} color={t.danger} />} title="Log out" />
      </Surface>
    </View>
  );
}
