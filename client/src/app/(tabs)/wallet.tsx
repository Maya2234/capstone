import { router } from 'expo-router';
import { CreditCard, Plus } from 'lucide-react-native';
import { Fragment } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { CATALOG_AS_OF, isCash, product, shortName } from '@/data/catalog';
import { CATEGORIES, WALLET_CATEGORIES } from '@/data/categories';
import { bestCard, suggestions } from '@/data/rewards';
import { useStore } from '@/data/store';
import type { WalletCard } from '@/data/types';
import { money, rate, shortDate } from '@/lib/format';
import { useWide } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Badge, CategoryIcon, Divider, EmptyState, Row, SectionHeader } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { CardArt } from '@/ui/CardArt';
import { Switch } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';

export default function Wallet() {
  const cards = useStore((s) => s.cards);
  const wide = useWide();
  const add = <Button label="Add card" icon={Plus} size="sm" onPress={() => router.push('/add-card')} />;

  if (!cards.length) {
    return (
      <Screen title="Wallet" action={add}>
        <Surface>
          <EmptyState
            icon={CreditCard}
            title="Add your first card"
            body="CardMaxx picks the card that earns the most each time you check out."
            action={<Button label="Add card" icon={Plus} onPress={() => router.push('/add-card')} />}
          />
        </Surface>
      </Screen>
    );
  }

  return (
    <Screen title="Wallet" action={add}>
      <Cards cards={cards} />
      {wide ? (
        <View style={{ flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><BestByCategory cards={cards} /></View>
          <View style={{ flex: 1 }}><Suggestions cards={cards} /></View>
        </View>
      ) : (
        <>
          <BestByCategory cards={cards} />
          <Suggestions cards={cards} />
        </>
      )}
    </Screen>
  );
}

function Cards({ cards }: { cards: WalletCard[] }) {
  const wide = useWide();
  const setEnabled = useStore((s) => s.setCardEnabled);
  const on = cards.filter((c) => c.enabled).length;
  const items = cards.map((c) => {
    const p = product(c.productId);
    if (!p) return null;
    return (
      <View key={c.id} style={{ gap: space.md, width: wide ? 272 : 252 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${p.name} ending ${c.mask}, details`}
          onPress={() => router.push({ pathname: '/card/[id]', params: { id: p.id, card: c.id } })}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <CardArt product={p} mask={c.mask} nickname={c.nickname} width={wide ? 272 : 252} dim={!c.enabled} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Text variant="smallStrong" tone={c.enabled ? 'text' : 'muted'}>{c.enabled ? 'On for CardMaxx' : 'Off'}</Text>
          <Switch value={c.enabled} onChange={(v) => setEnabled(c.id, v)} label={`Use ${p.name} for CardMaxx purchases`} />
        </View>
      </View>
    );
  });
  return (
    <View style={{ gap: space.md }}>
      <Text variant="small" tone="muted">{on} of {cards.length} cards can be used at checkout</Text>
      {wide ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xl }}>{items}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: space.lg, paddingHorizontal: space.lg, paddingBottom: space.md, paddingTop: 2 }}>
          {items}
        </ScrollView>
      )}
    </View>
  );
}

function BestByCategory({ cards }: { cards: WalletCard[] }) {
  const anyOn = cards.some((c) => c.enabled);
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="Best card for each category" />
      <Surface padded={false} style={{ padding: space.sm }}>
        {!anyOn ? (
          <EmptyState icon={CreditCard} title="Turn on a card to see your best picks" />
        ) : (
          WALLET_CATEGORIES.map((cat, i) => {
            const b = bestCard(cat, cards);
            return (
              <Fragment key={cat}>
                {i > 0 && <Divider inset={64} />}
                <Row
                  left={<CategoryIcon category={cat} />}
                  title={CATEGORIES[cat].label}
                  subtitle={b ? `${b.card.nickname || shortName(b.product)} ••${b.card.mask}` : 'No card on'}
                  right={b ? <Badge label={rate(b.rate, isCash(b.product))} tone={b.centsPerDollar >= 3 ? 'success' : 'primary'} /> : null}
                />
              </Fragment>
            );
          })
        )}
      </Surface>
    </View>
  );
}

function Suggestions({ cards }: { cards: WalletCard[] }) {
  const show = useStore((s) => s.prefs.cardSuggestions);
  const setPref = useStore((s) => s.setPref);
  const list = show ? suggestions(cards) : [];
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader
        title="Cards that could earn more"
        action={<Switch value={show} onChange={(v) => setPref('cardSuggestions', v)} label="Show card suggestions" />}
      />
      {!show ? (
        <Text variant="small" tone="muted">Suggestions are off.</Text>
      ) : list.length === 0 ? (
        <Surface>
          <Text tone="muted">Your cards already cover your top categories well.</Text>
        </Surface>
      ) : (
        <>
          {list.map((s) => (
            <Surface key={s.product.id} onPress={() => router.push({ pathname: '/card/[id]', params: { id: s.product.id } })} accessibilityLabel={`${s.product.name}, see details`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
              <CardArt product={s.product} mask="0000" width={96} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={1}>{s.product.name}</Text>
                <Text variant="small" tone="success">
                  {isCash(s.product) ? '' : '~'}{rate(s.centsPerDollar, true)} back on {CATEGORIES[s.category].label.toLowerCase()}
                  <Text variant="small" tone="muted"> vs {rate(s.currentCentsPerDollar, true)} now</Text>
                </Text>
                <Text variant="small" tone="subtle">{s.product.annualFeeCents ? `${money(s.product.annualFeeCents, { whole: true })} annual fee` : 'No annual fee'}</Text>
              </View>
            </Surface>
          ))}
          <Text variant="small" tone="subtle">Rates from issuer sites as of {shortDate(CATALOG_AS_OF + 'T12:00:00')}. Not paid placements.</Text>
        </>
      )}
    </View>
  );
}
