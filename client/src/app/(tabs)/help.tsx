import { Mail, Phone, Send } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { CONTACT_TOPICS, FAQ, SUPPORT } from '@/content/help';
import { useStore } from '@/data/store';
import { useTheme, useWide } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Row, SectionHeader } from '@/ui/bits';
import { Accordion } from '@/ui/Accordion';
import { Button } from '@/ui/Button';
import { Chip, Input } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

export default function Help() {
  const wide = useWide();
  return (
    <Screen title="Help">
      {wide ? (
        <View style={{ flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.1 }}><Faq /></View>
          <View style={{ flex: 1 }}><Contact /></View>
        </View>
      ) : (
        <>
          <Faq />
          <Contact />
        </>
      )}
    </Screen>
  );
}

function Faq() {
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="Questions" />
      <Surface style={{ paddingVertical: space.xs }}>
        <Accordion items={FAQ} />
      </Surface>
    </View>
  );
}

function Contact() {
  const t = useTheme();
  const toast = useToast();
  const profile = useStore((s) => s.profile);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [topic, setTopic] = useState<string>(CONTACT_TOPICS[0]);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  async function send() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Add your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email';
    if (message.trim().length < 10) e.message = 'Tell us a little more';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, topic, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
      setMessage('');
      toast('Message sent. We’ll reply by email.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="Contact us" />
      {SUPPORT.phone ? (
        <Surface padded={false} style={{ padding: space.sm }}>
          <Row
            onPress={() => Linking.openURL('tel:' + SUPPORT.phone.replace(/[^\d+]/g, ''))}
            left={<IconDot><Phone size={18} color={t.primarySoftText} /></IconDot>}
            title={SUPPORT.phone}
            subtitle={SUPPORT.hours}
            chevron
          />
        </Surface>
      ) : null}
      <Surface style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconDot><Mail size={18} color={t.primarySoftText} /></IconDot>
          <Text variant="bodyStrong" style={{ flex: 1 }}>Send us a message</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Topic">
          {CONTACT_TOPICS.map((tp) => (
            <Chip key={tp} label={tp} on={topic === tp} onPress={() => setTopic(tp)} />
          ))}
        </View>
        <Input label="Name" value={name} onChangeText={setName} autoComplete="name" error={errors.name} />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
        <Input label="Message" value={message} onChangeText={setMessage} multiline numberOfLines={5} style={{ minHeight: 120, textAlignVertical: 'top' }} error={errors.message} />
        <Button label="Send message" icon={Send} onPress={send} loading={sending} full />
      </Surface>
    </View>
  );
}

function IconDot({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}
