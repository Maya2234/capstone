import { router, useLocalSearchParams } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { PRODUCTS, productsForBank, shortName, type Product } from '@/data/catalog';
import { institution } from '@/data/demo';
import { useStore } from '@/data/store';
import type { Account } from '@/data/types';
import { space } from '@/theme/tokens';
import { EmptyState, InstitutionBadge } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { Chip, Input } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

/**
 * "Add your cards": for linked credit card accounts the app couldn't recognize from the bank's
 * name (many banks just send "CREDIT CARD"), pick which card each one is and add them all to
 * the Wallet at once. Opens after linking a bank (?institution=<id>) and from the Wallet.
 */
export default function SetupCards() {
  const toast = useToast();
  const params = useLocalSearchParams<{ institution?: string }>();
  const accounts = useStore((s) => s.accounts);
  const cards = useStore((s) => s.cards);
  const assignProduct = useStore((s) => s.assignProduct);

  // Worked out once, so accounts don't disappear from the list while you're choosing.
  const [pending] = useState(() =>
    accounts.filter(
      (a) => a.type === 'credit' && !cards.some((c) => c.accountId === a.id) && (!params.institution || a.institutionId === params.institution),
    ),
  );
  const [picks, setPicks] = useState<Record<string, string | undefined>>({});
  const chosen = pending.filter((a) => picks[a.id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/wallet'));

  function addAll() {
    for (const a of chosen) assignProduct(a.id, picks[a.id]!);
    toast(`${chosen.length} card${chosen.length === 1 ? '' : 's'} added to your Wallet`);
    close();
  }

  if (!pending.length) {
    return (
      <Sheet title="Add your cards" footer={<Button label="Done" onPress={close} full />}>
        <Surface>
          <EmptyState icon={CreditCard} title="All set" body="Every linked credit card is already in your Wallet." />
        </Surface>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Add your cards"
      footer={
        <View style={{ gap: space.sm }}>
          <Button label={chosen.length ? `Add ${chosen.length} card${chosen.length === 1 ? '' : 's'} to Wallet` : 'Pick a card above'} onPress={addAll} disabled={!chosen.length} full />
          <Button label="Not now" variant="ghost" onPress={close} full />
        </View>
      }>
      <Text tone="muted">
        Your bank didn’t say which {pending.length === 1 ? 'card this is' : 'cards these are'}. Pick each one so CardMaxx knows what it earns. Skip any you don’t want to use with CardMaxx.
      </Text>
      {pending.map((a) => (
        <AccountPicker key={a.id} account={a} pick={picks[a.id]} onPick={(id) => setPicks((p) => ({ ...p, [a.id]: p[a.id] === id ? undefined : id }))} />
      ))}
    </Sheet>
  );
}

function AccountPicker({ account, pick, onPick }: { account: Account; pick?: string; onPick: (productId: string) => void }) {
  const inst = institution(account.institutionId, account.institutionName);
  const suggested = useMemo(() => productsForBank(inst.name), [inst.name]);
  const [searching, setSearching] = useState(suggested.length === 0);
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return PRODUCTS.filter((p) => p.name.toLowerCase().includes(s) || p.issuer.toLowerCase().includes(s)).slice(0, 8);
  }, [q]);
  const picked = pick ? PRODUCTS.find((p) => p.id === pick) : undefined;
  // A card picked from search shows up as a chip too, so you can see it's chosen.
  const chips: Product[] = picked && !suggested.some((p) => p.id === picked.id) ? [...suggested, picked] : suggested;

  return (
    <Surface style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <InstitutionBadge name={inst.name} color={inst.color} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{inst.name} ••{account.mask}</Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {picked ? `Adding as ${shortName(picked)}` : `Your bank calls it “${account.name}”`}
          </Text>
        </View>
      </View>
      {chips.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {chips.map((p) => (
            <Chip key={p.id} label={shortName(p)} on={pick === p.id} onPress={() => onPick(p.id)} />
          ))}
          {!searching && <Chip label="Something else…" on={false} onPress={() => setSearching(true)} />}
        </View>
      )}
      {searching && (
        <View style={{ gap: space.sm }}>
          <Input label="Find your card" placeholder="Search by card or bank" value={q} onChangeText={setQ} autoFocus={suggested.length > 0} />
          {results.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {results.map((p) => (
                <Chip key={p.id} label={p.name} on={pick === p.id} onPress={() => onPick(p.id)} />
              ))}
            </View>
          )}
          {q.trim() !== '' && results.length === 0 && (
            <Text variant="small" tone="muted">No card by that name in CardMaxx yet.</Text>
          )}
        </View>
      )}
    </Surface>
  );
}
