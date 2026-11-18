import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Gift, Landmark, Plus, Sparkles, Target, X } from 'lucide-react-native';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CATEGORIES } from '@/data/categories';
import { institution } from '@/data/demo';
import { GROUPS, isLiability, useMonthSpending, useNetWorth } from '@/data/derive';
import { useStore } from '@/data/store';
import type { Account } from '@/data/types';
import { greeting, monthName, pct } from '@/lib/format';
import { useTheme, useWide } from '@/theme/theme';
import { palette, space } from '@/theme/tokens';
import { CategoryIcon, Divider, EmptyState, InstitutionBadge, Money, Row, SectionHeader } from '@/ui/bits';
import { Button, IconButton } from '@/ui/Button';
import { Donut, ProgressBar } from '@/ui/charts';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';

export default function Home() {
  const wide = useWide();
  const name = useStore((s) => s.profile.name.split(' ')[0]);
  const showNetWorth = useStore((s) => s.prefs.showNetWorth);
  const left = (
    <>
      {showNetWorth && <NetWorth />}
      <Accounts />
    </>
  );
  const right = (
    <>
      <Spending />
      <Budgets />
    </>
  );
  return (
    <Screen>
      <View>
        <Text variant="h1" accessibilityRole="header">
          {greeting()}{name ? `, ${name}` : ''}
        </Text>
      </View>
      {wide ? (
        <View style={{ flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.15, gap: space.xl }}>{left}</View>
          <View style={{ flex: 1, gap: space.xl }}>{right}</View>
        </View>
      ) : (
        <>
          {left}
          {right}
        </>
      )}
    </Screen>
  );
}

function NetWorth() {
  const { net, assets, debts } = useNetWorth();
  return (
    <View style={styles.hero}>
      <LinearGradient colors={[palette.indigo, palette.violet, palette.orchid]} locations={[0, 0.62, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* Quarter-circle motif from the logo */}
      <Svg width={180} height={180} viewBox="0 0 180 180" style={{ position: 'absolute', right: -20, top: -20, opacity: 0.22 }}>
        <Path d="M180 0 L90 0 A90 90 0 0 0 180 90 Z" fill="#fff" />
        <Path d="M90 90 L0 90 A90 90 0 0 1 90 0 Z" fill="#fff" opacity={0.6} />
        <Path d="M90 90 L90 180 A90 90 0 0 0 180 90 Z" fill="#fff" opacity={0.45} />
      </Svg>
      <Text variant="smallStrong" tone="inverse" style={{ opacity: 0.9 }}>Net worth</Text>
      <Money cents={net} variant="hero" tone="inverse" style={{ marginTop: 4 }} />
      <View style={{ flexDirection: 'row', gap: space.xl, marginTop: space.lg }}>
        <View>
          <Text variant="small" tone="inverse" style={{ opacity: 0.8 }}>Assets</Text>
          <Money cents={assets} variant="bodyStrong" tone="inverse" whole />
        </View>
        <View>
          <Text variant="small" tone="inverse" style={{ opacity: 0.8 }}>Debts</Text>
          <Money cents={debts} variant="bodyStrong" tone="inverse" whole />
        </View>
      </View>
    </View>
  );
}

function Accounts() {
  const accounts = useStore((s) => s.accounts);
  const link = (
    <Button label="Link account" icon={Plus} size="sm" variant="soft" onPress={() => router.push('/link')} />
  );
  if (!accounts.length) {
    return (
      <Surface>
        <EmptyState
          icon={Landmark}
          title="See all your money in one place"
          body="Connect your banks and cards to see balances and spending together."
          action={<Button label="Link an account" icon={Plus} onPress={() => router.push('/link')} />}
        />
      </Surface>
    );
  }
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="Accounts" action={link} />
      <Surface padded={false} style={{ paddingVertical: space.sm, paddingHorizontal: space.sm }}>
        {GROUPS.map((g) => {
          const list = accounts.filter((a) => g.types.includes(a.type));
          if (!list.length) return null;
          const total = list.reduce((s, a) => s + a.balanceCents, 0);
          return (
            <View key={g.key} style={{ paddingTop: space.sm }}>
              <View style={styles.groupHead}>
                <Text variant="label" tone="subtle">{g.label}</Text>
                <Money cents={total} variant="smallStrong" tone="muted" />
              </View>
              {list.map((a, i) => (
                <Fragment key={a.id}>
                  {i > 0 && <Divider inset={68} />}
                  <AccountRow a={a} />
                </Fragment>
              ))}
            </View>
          );
        })}
      </Surface>
    </View>
  );
}

function AccountRow({ a }: { a: Account }) {
  const t = useTheme();
  const wide = useWide();
  const inst = institution(a.institutionId, a.institutionName);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <Row
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: a.id } })}
          accessibilityLabel={`${a.name}, ${inst.name}`}
          left={<InstitutionBadge name={inst.name} color={inst.color} />}
          title={a.name}
          subtitle={`${inst.name} ••${a.mask}`}
          right={
            <View style={{ alignItems: 'flex-end' }}>
              <Money cents={a.balanceCents} variant="amount" />
              {isLiability(a.type) && <Text variant="small" tone="subtle">owed</Text>}
            </View>
          }
        />
      </View>
      {a.productId && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${a.name} benefits`}
          onPress={() => router.push({ pathname: '/card/[id]', params: { id: a.productId! } })}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.benefits,
            !wide && { width: 36, paddingHorizontal: 0, justifyContent: 'center' },
            { backgroundColor: pressed || hovered ? t.surfacePressed : t.primarySoft },
          ]}>
          <Gift size={15} color={t.primarySoftText} />
          {wide && <Text variant="smallStrong" style={{ color: t.primarySoftText, fontSize: 12 }}>Benefits</Text>}
        </Pressable>
      )}
    </View>
  );
}

function Spending() {
  const { total, rows } = useMonthSpending();
  // "Everything else" is folded into Other so the chart never shows two grey slices.
  const named = rows.filter((r) => r.category !== 'general');
  const top = named.slice(0, 5);
  const rest = total - top.reduce((s, r) => s + r.cents, 0);
  const t = useTheme();
  const data = [...top.map((r) => ({ value: r.cents, color: CATEGORIES[r.category].color })), ...(rest ? [{ value: rest, color: t.textSubtle }] : [])];
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title={`Spending in ${monthName()}`} />
      <Surface>
        {total === 0 ? (
          <EmptyState icon={Sparkles} title="No spending yet this month" />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xl }}>
            <Donut data={data} size={156} stroke={20}>
              <Text variant="small" tone="muted">Total</Text>
              <Money cents={total} variant="h2" whole />
            </Donut>
            <View style={{ flex: 1, minWidth: 200, gap: space.md }}>
              {top.map((r) => (
                <View key={r.category} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CATEGORIES[r.category].color }} />
                  <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{CATEGORIES[r.category].label}</Text>
                  <Text variant="small" tone="subtle">{pct(r.cents / total)}</Text>
                  <Money cents={r.cents} variant="amount" whole style={{ minWidth: 64, textAlign: 'right' }} />
                </View>
              ))}
              {rest > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.textSubtle }} />
                  <Text variant="bodyStrong" tone="muted" style={{ flex: 1 }}>Other</Text>
                  <Text variant="small" tone="subtle">{pct(rest / total)}</Text>
                  <Money cents={rest} variant="amount" whole style={{ minWidth: 64, textAlign: 'right' }} />
                </View>
              )}
            </View>
          </View>
        )}
      </Surface>
    </View>
  );
}

function Budgets() {
  const t = useTheme();
  const budgets = useStore((s) => s.budgets);
  const dismissed = useStore((s) => s.prefs.budgetPromptDismissed);
  const setPref = useStore((s) => s.setPref);
  const { byCategory } = useMonthSpending();
  // No budgets until the user sets some. Until then, offer to; once they say "Not now", stay out of the way.
  if (budgets.length === 0 && dismissed) return null;
  if (budgets.length === 0) {
    return (
      <Surface>
        <View style={{ position: 'absolute', top: space.sm, right: space.sm, zIndex: 1 }}>
          <IconButton icon={X} label="Dismiss budgets prompt" size={36} onPress={() => setPref('budgetPromptDismissed', true)} />
        </View>
        <EmptyState
          icon={Target}
          title="Set monthly budgets?"
          body="Pick the categories you want to keep an eye on and we’ll track your spending against them. You can do this any time from Settings."
          action={
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button label="Set budgets" onPress={() => router.push('/budgets')} />
              <Button label="Not now" variant="ghost" onPress={() => setPref('budgetPromptDismissed', true)} />
            </View>
          }
        />
      </Surface>
    );
  }
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="Budgets" action={<Button label="Edit" size="sm" variant="ghost" onPress={() => router.push('/budgets')} />} />
      <Surface style={{ gap: space.lg }}>
        {budgets.map((b) => {
            const spent = byCategory.get(b.category) ?? 0;
            const ratio = spent / b.limitCents;
            const over = spent > b.limitCents;
            const color = over ? t.danger : ratio > 0.85 ? '#F0A53A' : CATEGORIES[b.category].color;
            return (
              <View key={b.category} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <CategoryIcon category={b.category} size={38} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{CATEGORIES[b.category].label}</Text>
                    <Text variant="small" tone={over ? 'danger' : 'muted'}>
                      <Money cents={over ? spent - b.limitCents : b.limitCents - spent} variant="smallStrong" whole tone={over ? 'danger' : 'text'} />
                      {over ? ' over' : ' left'}
                    </Text>
                  </View>
                  <ProgressBar value={ratio} color={color} />
                  <Text variant="small" tone="subtle">
                    <Money cents={spent} variant="small" whole tone="muted" /> of <Money cents={b.limitCents} variant="small" whole tone="muted" />
                  </Text>
                </View>
              </View>
            );
          })}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: space.xxl, overflow: 'hidden', minHeight: 190, justifyContent: 'center', boxShadow: '0px 18px 44px rgba(64,57,223,0.28)' },
  benefits: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 16, marginRight: 8, marginLeft: 2 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.md, paddingBottom: 4, paddingTop: 4 },
});
