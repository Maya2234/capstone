import { ReceiptText } from 'lucide-react-native';
import { Fragment, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { product, shortName } from '@/data/catalog';
import { useStore } from '@/data/store';
import { shortDate } from '@/lib/format';
import { useWide } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Badge, CategoryIcon, Divider, EmptyState, Money, Row } from '@/ui/bits';
import { Chip } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';

export default function Activity() {
  const purchases = useStore((s) => s.purchases);
  const cards = useStore((s) => s.cards);
  const wide = useWide();
  const [cardFilter, setCardFilter] = useState<string | null>(null);

  const cardName = (id: string) => {
    const c = cards.find((x) => x.id === id);
    const p = c && product(c.productId);
    return p ? `${c.nickname || shortName(p)} ••${c.mask}` : 'Removed card';
  };

  const usedCards = useMemo(() => [...new Set(purchases.map((p) => p.cardId))], [purchases]);
  const shown = useMemo(
    () => purchases.filter((p) => !cardFilter || p.cardId === cardFilter).sort((a, b) => b.date.localeCompare(a.date)),
    [purchases, cardFilter],
  );
  const settled = purchases.filter((p) => p.status === 'succeeded');
  const earned = settled.reduce((s, p) => s + p.rewardCents, 0);
  const spent = settled.reduce((s, p) => s + p.amountCents, 0);

  const groups: { day: string; items: typeof shown }[] = [];
  for (const p of shown) {
    const day = new Date(p.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(p);
    else groups.push({ day, items: [p] });
  }

  return (
    <Screen title="Activity" maxWidth={wide ? 860 : undefined}>
      {purchases.length === 0 ? (
        <Surface>
          <EmptyState icon={ReceiptText} title="No CardMaxx purchases yet" body="When you check out with CardMaxx, each purchase and the rewards it earned show up here." />
        </Surface>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Stat label="Rewards earned" cents={earned} tone="success" />
            <Stat label="Paid with CardMaxx" cents={spent} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ flexGrow: 0 }}>
            <Chip label="All cards" on={!cardFilter} onPress={() => setCardFilter(null)} />
            {usedCards.map((id) => (
              <Chip key={id} label={cardName(id)} on={cardFilter === id} onPress={() => setCardFilter(id)} />
            ))}
          </ScrollView>

          <View style={{ gap: space.lg }}>
            {groups.map((g) => (
              <View key={g.day} style={{ gap: space.sm }}>
                <Text variant="label" tone="subtle" style={{ paddingHorizontal: 4 }}>{g.day}</Text>
                <Surface padded={false} style={{ padding: space.sm }}>
                  {g.items.map((p, i) => (
                    <Fragment key={p.id}>
                      {i > 0 && <Divider inset={64} />}
                      <Row
                        left={<CategoryIcon category={p.category} />}
                        title={p.merchant}
                        subtitle={`${shortDate(p.date)} · ${cardName(p.cardId)}`}
                        right={
                          <View style={{ alignItems: 'flex-end', gap: 2 }}>
                            <Money cents={p.amountCents} style={p.status === 'refunded' ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined} />
                            {p.status === 'refunded' ? (
                              <Badge label="Refunded" tone="neutral" />
                            ) : (
                              <Text variant="small" tone="subtle">
                                {p.rateLabel} · <Money cents={p.rewardCents} variant="smallStrong" tone="success" sign />
                              </Text>
                            )}
                          </View>
                        }
                      />
                    </Fragment>
                  ))}
                </Surface>
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, cents, tone }: { label: string; cents: number; tone?: 'success' }) {
  return (
    <Surface style={{ flex: 1, gap: 4 }}>
      <Text variant="small" tone="muted">{label}</Text>
      <Money cents={cents} variant="h2" tone={tone} />
    </Surface>
  );
}
