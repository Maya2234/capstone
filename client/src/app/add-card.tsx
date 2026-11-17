import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Landmark } from 'lucide-react-native';
import { Fragment, useMemo, useState } from 'react';
import { View } from 'react-native';

import { PRODUCTS, product as findProduct, type Product } from '@/data/catalog';
import { useStore } from '@/data/store';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Divider, Row } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { CardArt } from '@/ui/CardArt';
import { Input } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

export default function AddCard() {
  const params = useLocalSearchParams<{ product?: string }>();
  const [picked, setPicked] = useState<Product | undefined>(() => (params.product ? findProduct(params.product) : undefined));
  return picked ? <Details product={picked} onBack={() => setPicked(undefined)} /> : <Choose onPick={setPicked} />;
}

function Choose({ onPick }: { onPick: (p: Product) => void }) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return PRODUCTS.filter((p) => !s || p.name.toLowerCase().includes(s) || p.issuer.toLowerCase().includes(s)).sort((a, b) => a.name.localeCompare(b.name));
  }, [q]);
  return (
    <Sheet title="Add a card">
      <Surface onPress={() => router.replace('/link')} accessibilityLabel="Link a bank instead" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Landmark size={22} color={t.primarySoftText} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Link your bank</Text>
          <Text variant="small" tone="muted">Fastest. Cards and balances come in automatically.</Text>
        </View>
      </Surface>
      <Text variant="label" tone="subtle" style={{ marginTop: space.sm }}>Or add one by hand</Text>
      <Input label="Card name" placeholder="Search 40+ cards" value={q} onChangeText={setQ} />
      <Surface padded={false} style={{ padding: space.sm }}>
        {list.length === 0 && <Text tone="muted" style={{ padding: space.lg }}>No cards match. Try the issuer name.</Text>}
        {list.map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && <Divider inset={84} />}
            <Row
              onPress={() => onPick(p)}
              left={<CardArt product={p} mask="" width={60} />}
              title={p.name}
              subtitle={p.annualFeeCents ? `${money(p.annualFeeCents, { whole: true })} annual fee` : 'No annual fee'}
              chevron
            />
          </Fragment>
        ))}
      </Surface>
    </Sheet>
  );
}

function Details({ product, onBack }: { product: Product; onBack: () => void }) {
  const toast = useToast();
  const addCard = useStore((s) => s.addCard);
  const [mask, setMask] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  function add() {
    if (!/^\d{4}$/.test(mask)) return setError('Enter the last 4 digits');
    addCard({ productId: product.id, mask, nickname: nickname.trim() || undefined });
    toast(`${product.name} added`);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }
  return (
    <Sheet
      title="Card details"
      footer={
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button label="Back" icon={ArrowLeft} variant="outline" onPress={onBack} />
          <Button label="Add to wallet" onPress={add} style={{ flex: 1 }} full />
        </View>
      }>
      <View style={{ alignItems: 'center', paddingVertical: space.sm }}>
        <CardArt product={product} mask={mask.padEnd(4, '•')} nickname={nickname} width={280} />
      </View>
      <Input label="Last 4 digits" value={mask} onChangeText={(v) => { setMask(v.replace(/\D/g, '').slice(0, 4)); setError(''); }} keyboardType="number-pad" maxLength={4} error={error} hint="Only the last four. We never ask for the full number here." />
      <Input label="Nickname (optional)" value={nickname} onChangeText={setNickname} placeholder={product.name} maxLength={28} />
    </Sheet>
  );
}
