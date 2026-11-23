import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text as RNText, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/data/categories';
import { shortName } from '@/data/catalog';
import { useStore } from '@/data/store';
import { cartSummary, rankCards, type RankedCard, turnedOffCards, useDemoCart } from '@/demo/checkout';
import { store as findStore, type DemoStore } from '@/demo/stores';
import { money } from '@/lib/format';
import { useTheme, useWide } from '@/theme/theme';
import { palette, radius, space } from '@/theme/tokens';
import { Button, IconButton } from '@/ui/Button';
import { CardArt } from '@/ui/CardArt';
import { Mark } from '@/ui/Logo';
import { Text } from '@/ui/Text';
import { usePageShown } from '@/ui/usePageShown';

type Phase = 'cart' | 'picking' | 'choose' | 'paying' | 'done';

/**
 * Demo checkout. The store's own order summary, then "Pay with CardMaxx": CardMaxx ranks your
 * Wallet's cards for this purchase, you confirm, and it shows what you earned. Simulated: no
 * payment is made and nothing is saved.
 */
export default function DemoCheckout() {
  usePageShown();
  const { store: id } = useLocalSearchParams<{ store: string }>();
  const s = findStore(id ?? '');
  const insets = useSafeAreaInsets();
  const wallet = useStore((st) => st.cards);
  const cart = useDemoCart((st) => (s ? st.carts[s.id] : undefined));
  const clear = useDemoCart((st) => st.clear);
  const [phase, setPhase] = useState<Phase>('cart');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ totalCents: number; pick: RankedCard; runnerUp?: RankedCard; order: string } | null>(null);

  const summary = s ? cartSummary(s, cart) : null;
  const ranked = useMemo(() => (s && summary ? rankCards(s.category, summary.totalCents, wallet) : []), [s, summary?.totalCents, wallet]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = ranked.find((r) => r.card.id === chosenId) ?? ranked[0];
  const off = s && summary ? turnedOffCards(s.category, summary.totalCents, wallet) : [];

  // The little pauses make each step readable when presenting.
  useEffect(() => {
    if (phase === 'picking') {
      const t = setTimeout(() => setPhase('choose'), 1300);
      return () => clearTimeout(t);
    }
    if (phase === 'paying' && s && summary && chosen) {
      const t = setTimeout(() => {
        setPaid({ totalCents: summary.totalCents, pick: chosen, runnerUp: ranked.find((r) => r.card.id !== chosen.card.id), order: `${s.id === 'trendbox' ? 'TT' : 'IC'}-${Math.floor(100000 + Math.random() * 899999)}` });
        clear(s.id);
        setPhase('done');
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s || !summary) return null;
  const c = s.colors;
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/demo/[store]', params: { store: s.id } }));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingBottom: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${s.name}`} onPress={back} hitSlop={8} style={{ padding: 6 }}>
            <ArrowLeft size={22} color={c.text} />
          </Pressable>
          <RNText style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>{s.name} · Checkout</RNText>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', gap: 16 }}>
          <View style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 16, gap: 12 }}>
            <RNText style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>Your order</RNText>
            {summary.lines.length === 0 && phase !== 'done' && <RNText style={{ color: c.muted }}>Your cart is empty.</RNText>}
            {summary.lines.map(({ product: p, qty }) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' }}>
                  <RNText style={{ fontSize: 22 }}>{p.emoji}</RNText>
                </View>
                <View style={{ flex: 1 }}>
                  <RNText style={{ color: c.text, fontWeight: '600' }} numberOfLines={1}>{p.name}</RNText>
                  <RNText style={{ color: c.muted, fontSize: 12 }}>Qty {qty}</RNText>
                </View>
                <RNText style={{ color: c.text, fontWeight: '700' }}>{money(p.priceCents * qty)}</RNText>
              </View>
            ))}
            {summary.count > 0 && (
              <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12, gap: 6 }}>
                <SummaryLine s={s} label="Subtotal" cents={summary.subtotalCents} />
                {s.feeCents > 0 && <SummaryLine s={s} label={s.feeLabel ?? 'Fees'} cents={summary.feeCents} />}
                <SummaryLine s={s} label="Shipping" text={s.feeCents > 0 ? 'Included' : 'Free'} />
                <SummaryLine s={s} label="Total" cents={summary.totalCents} strong />
              </View>
            )}
          </View>

          {summary.count > 0 && (
            <>
              <RNText style={{ color: c.muted, fontSize: 13, textAlign: 'center' }}>Choose how to pay</RNText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pay with CardMaxx"
                onPress={() => setPhase('picking')}
                style={({ pressed }) => ({ height: 56, borderRadius: 28, overflow: 'hidden', opacity: pressed ? 0.9 : 1 })}>
                <LinearGradient colors={[palette.indigo, palette.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
                  <Mark size={24} mono="#FFFFFF" />
                  <RNText style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Pay with CardMaxx</RNText>
                </LinearGradient>
              </Pressable>
              <View style={{ height: 52, borderRadius: 26, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                <RNText style={{ color: c.muted, fontWeight: '600' }}>Enter card details manually</RNText>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {phase !== 'cart' && (
        <CardMaxxPanel
          s={s}
          phase={phase}
          totalCents={paid?.totalCents ?? summary.totalCents}
          ranked={ranked}
          off={off}
          chosen={chosen}
          onChoose={setChosenId}
          onPay={() => setPhase('paying')}
          onCancel={() => setPhase('cart')}
          paid={paid}
        />
      )}
    </View>
  );
}

function SummaryLine({ s, label, cents, text, strong }: { s: DemoStore; label: string; cents?: number; text?: string; strong?: boolean }) {
  const st = { color: strong ? s.colors.text : s.colors.muted, fontWeight: strong ? ('800' as const) : ('500' as const), fontSize: strong ? 17 : 14 };
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <RNText style={st}>{label}</RNText>
      <RNText style={st}>{text ?? money(cents ?? 0)}</RNText>
    </View>
  );
}

/** Why a card wins: its category rate, or that it earns the same on everything. */
function reason(r: RankedCard, s: DemoStore, others: number) {
  const hasCategoryRate = r.product.rules.some((rule) => rule.category === s.category);
  if (hasCategoryRate) return `${shortName(r.product)} earns ${r.rateLabel} on ${s.categoryLabel.toLowerCase()}`;
  return others > 0
    ? `${shortName(r.product)} earns ${r.rateLabel} on everything, more than your other cards here`
    : `${shortName(r.product)} earns ${r.rateLabel} on everything`;
}

/** The CardMaxx part of checkout, drawn over the store in CardMaxx's own look. */
function CardMaxxPanel({
  s, phase, totalCents, ranked, off, chosen, onChoose, onPay, onCancel, paid,
}: {
  s: DemoStore; phase: Phase; totalCents: number; ranked: RankedCard[]; off: RankedCard[]; chosen?: RankedCard;
  onChoose: (id: string) => void; onPay: () => void; onCancel: () => void;
  paid: { totalCents: number; pick: RankedCard; runnerUp?: RankedCard; order: string } | null;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const best = ranked[0];

  return (
    // Phones: a sheet from the bottom. Wider screens: a dialog in the middle.
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,11,28,0.6)', justifyContent: wide ? 'center' : 'flex-end', padding: wide ? space.xl : 0 }]}>
      <View
        style={[
          { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: t.bg, padding: space.xl, gap: space.lg, boxShadow: '0px 24px 60px rgba(0,0,0,0.35)' },
          wide
            ? { borderRadius: radius.xl, maxHeight: '90%' }
            : { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + space.xl, maxHeight: '92%' },
        ]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {(phase === 'picking' || phase === 'choose') && (
            <IconButton icon={ArrowLeft} label={`Back to ${s.name} checkout`} size={36} onPress={onCancel} />
          )}
          <Mark size={26} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>CardMaxx</Text>
          <Text variant="small" tone="muted">{s.name} · {money(totalCents)}</Text>
        </View>

        {phase === 'picking' && (
          <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
            <ActivityIndicator color={t.primary} />
            <Text variant="h3" style={{ textAlign: 'center' }}>Finding your best card…</Text>
            <Text tone="muted" style={{ textAlign: 'center' }}>Comparing {ranked.length} cards for {CATEGORIES[s.category].label.toLowerCase()}</Text>
          </View>
        )}

        {phase === 'choose' && chosen && (
          <ScrollView contentContainerStyle={{ gap: space.lg }}>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.successSoft, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill }}>
                <Sparkles size={14} color={t.success} />
                <Text variant="smallStrong" tone="success">{chosen.card.id === best.card.id ? 'Best card for this purchase' : 'Your choice'}</Text>
              </View>
              <CardArt product={chosen.product} mask={chosen.card.mask} nickname={chosen.card.nickname} width={260} />
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text variant="h2">Earns {money(chosen.rewardCents)}</Text>
                <Text tone="muted" style={{ textAlign: 'center' }}>{reason(chosen, s, ranked.length - 1)}</Text>
              </View>
            </View>

            {ranked.length + off.length > 1 && (
              <View style={{ gap: space.sm }}>
                <Text variant="label" tone="subtle">Cards Available</Text>
                {ranked.map((r, i) => {
                  const on = r.card.id === chosen.card.id;
                  return (
                    <Pressable
                      key={r.card.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => onChoose(r.card.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: on ? t.primary : t.border, backgroundColor: t.surface }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? t.primary : t.border, alignItems: 'center', justifyContent: 'center' }}>
                        {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.primary }} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong" numberOfLines={1}>{r.card.nickname || shortName(r.product)} ••{r.card.mask}</Text>
                        <Text variant="small" tone="muted">{r.rateLabel} {i === 0 ? '· Best' : ''}</Text>
                      </View>
                      <Text variant="bodyStrong" tone={i === 0 ? 'success' : 'muted'}>+{money(r.rewardCents)}</Text>
                    </Pressable>
                  );
                })}
                {off.map((r) => (
                  <View key={r.card.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, opacity: 0.55 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: t.border }} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>{r.card.nickname || shortName(r.product)} ••{r.card.mask}</Text>
                      <Text variant="small" tone="muted">{r.rateLabel} · Off in your Wallet</Text>
                    </View>
                    <Text variant="bodyStrong" tone="muted">+{money(r.rewardCents)}</Text>
                  </View>
                ))}
              </View>
            )}
            {best.sample && <Text variant="small" tone="subtle" style={{ textAlign: 'center' }}>Your Wallet is empty, so this demo is using two sample cards.</Text>}

            <Button label={`Pay ${money(totalCents)}`} size="lg" onPress={onPay} full />
            <Button label="Cancel" variant="ghost" onPress={onCancel} full />
          </ScrollView>
        )}

        {phase === 'paying' && chosen && (
          <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
            <ActivityIndicator color={t.primary} />
            <Text variant="h3">Paying with {shortName(chosen.product)} ••{chosen.card.mask}</Text>
            <Text tone="muted">Securely, without sharing your card number with {s.name}</Text>
          </View>
        )}

        {phase === 'done' && paid && (
          <View style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.md }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: t.success, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={36} color="#fff" strokeWidth={3} />
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text variant="h1">Payment approved</Text>
              <Text tone="muted">{money(paid.totalCents)} at {s.name} · Order {paid.order}</Text>
            </View>
            <View style={{ alignSelf: 'stretch', backgroundColor: t.successSoft, borderRadius: radius.lg, padding: space.lg, gap: 4, alignItems: 'center' }}>
              <Text variant="h2" tone="success">You earned {money(paid.pick.rewardCents)}</Text>
              <Text variant="small" tone="success" style={{ textAlign: 'center' }}>
                with {shortName(paid.pick.product)}
                {paid.runnerUp && paid.pick.rewardCents > paid.runnerUp.rewardCents
                  ? `, ${money(paid.pick.rewardCents - paid.runnerUp.rewardCents)} more than ${shortName(paid.runnerUp.product)} would have earned`
                  : ''}
              </Text>
            </View>
            <Button label={`Back to ${s.name}`} onPress={() => router.replace({ pathname: '/demo/[store]', params: { store: s.id } })} full />
          </View>
        )}
      </View>
    </View>
  );
}
