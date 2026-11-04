import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { api, Card, label, money, pct } from '@/api';
import { linkAccount, Screen } from '@/screen';
import { useLoad } from '@/session';
import { Bar, Box, Button, Chip, ErrorText, Loading, Row, T, useTheme } from '@/ui';

// Rotating 5% categories the consumer can activate each quarter (issuer calendars vary).
const ROTATING = ['groceries', 'gas', 'dining', 'online_retail', 'streaming', 'drugstore', 'home_improvement', 'entertainment', 'transit'];

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function Cards() {
  const cards = useLoad(() => api.cards().then((r) => r.cards));
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await cards.reload();
    } catch (e) {
      setError(e);
    }
  }

  if (cards.loading && !cards.data) return <Loading />;
  const list = cards.data ?? [];
  return (
    <Screen onRefresh={cards.reload}>
      <ErrorText error={error || cards.error} />
      {list.length === 0 && (
        <Box><T weight="700" size={17}>No cards yet</T><T muted>Link a credit card so CardStack can pick the best one at checkout.</T></Box>
      )}
      {list.map((c) => (
        <CardRow key={c.cardId} card={c} open={open === c.cardId} onToggle={() => setOpen(open === c.cardId ? null : c.cardId)} act={act} />
      ))}
      <Button title="Add a card" onPress={() => act(linkAccount)} />
    </Screen>
  );
}

function CardRow({ card: c, open, onToggle, act }: { card: Card; open: boolean; onToggle: () => void; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const t = useTheme();
  const frozen = c.status === 'frozen';
  const maxPicks = c.choiceCategory?.picks ?? 1;
  return (
    <Box style={frozen ? { opacity: 0.7 } : undefined}>
      <Pressable onPress={onToggle} accessibilityRole="button">
        <Row>
          <View style={{ flex: 1 }}>
            <Row style={{ justifyContent: 'flex-start', gap: 6 }}>
              <T weight="700" size={16} numberOfLines={1}>{c.productName}</T>
              {c.preferred && <T size={14}>⭐</T>}
            </Row>
            <T muted size={13}>{c.network} •••• {c.last4} · {c.institution}{frozen ? ' · Frozen' : ''}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T weight="700">{money(c.balanceCents)}</T>
            <T muted size={12}>of {money(c.creditLimitCents, 0)}</T>
          </View>
        </Row>
        <Bar value={c.utilization} color={c.utilization > 0.3 ? t.warn : t.good} />
        <T muted size={12} style={{ marginTop: 4 }}>{pct(c.utilization)} used · {money(c.availableCents, 0)} available</T>
      </Pressable>

      {open && (
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 12 }}>
          <T weight="700">Rewards</T>
          <T muted size={13}>{c.currency} · {c.baseRate}x on everything else{c.annualFeeCents ? ` · ${money(c.annualFeeCents, 0)} annual fee` : ' · No annual fee'}</T>
          {c.rules.filter((r) => !r.category.startsWith('portal:')).map((r) => (
            <Row key={r.category} style={{ marginTop: 6 }}>
              <T>{label(r.category)}</T>
              <T weight="700">{r.rate}x{r.capCents ? <T muted size={12}> up to {money(r.capCents, 0)}/{r.capPeriod}</T> : null}</T>
            </Row>
          ))}

          {c.choiceCategory && (
            <View style={{ marginTop: 12 }}>
              <T weight="700">Your {c.choiceCategory.rate}% category{maxPicks > 1 ? `s (pick ${maxPicks})` : ''}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                {c.choiceCategory.options.map((o) => {
                  const active = (c.choices.length ? c.choices : [c.choiceCategory!.default]).includes(o);
                  return (
                    <Chip key={o} text={label(o)} active={active} onPress={() => act(() => {
                      const cur = c.choices.length ? c.choices : [c.choiceCategory!.default];
                      const next = active ? cur.filter((x) => x !== o) : [...cur, o].slice(-maxPicks);
                      return api.updateCard(c.cardId, { choices: next });
                    })} />
                  );
                })}
              </View>
            </View>
          )}

          {c.rotating && (
            <View style={{ marginTop: 12 }}>
              <T weight="700">{`This quarter's ${c.rotating.rate}% categories`}</T>
              <T muted size={12}>Turn on the categories you activated with {c.issuer}.</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                {ROTATING.map((o) => {
                  const active = c.rotatingActive.includes(o);
                  return <Chip key={o} text={label(o)} active={active} onPress={() => act(() =>
                    api.updateCard(c.cardId, { rotatingActive: active ? c.rotatingActive.filter((x) => x !== o) : [...c.rotatingActive, o] }))} />;
                })}
              </View>
            </View>
          )}

          <View style={{ marginTop: 8 }}>
            {!c.preferred && <Button kind="ghost" title="Make preferred card" onPress={() => act(() => api.setPreferred(c.cardId))} />}
            <Button kind="ghost" title={frozen ? 'Unfreeze card' : 'Freeze card'} onPress={() => act(() => api.updateCard(c.cardId, { status: frozen ? 'active' : 'frozen' }))} />
            <Button kind="danger" title="Remove card" onPress={() => act(async () => {
              if (await confirm('Remove card?', `${c.productName} •••• ${c.last4} will no longer be used at checkout.`)) await api.removeCard(c.cardId);
            })} />
          </View>
        </View>
      )}
    </Box>
  );
}
