import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronRight, Landmark, Plus, Sparkles, Target, X } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useSpendCategories } from '@/data/spendCategories';
import { institution } from '@/data/demo';
import { GROUPS, isLiability, useAccountTitle, monthKey, periodKey, type PeriodKind, periodPhrase, useMonthSpending, useNetWorth } from '@/data/derive';
import { useStore } from '@/data/store';
import type { Account } from '@/data/types';
import { greeting, money, pct } from '@/lib/format';
import { useTheme, useWide } from '@/theme/theme';
import { palette, space } from '@/theme/tokens';
import { CategoryIcon, Divider, EmptyState, InstitutionBadge, Money, Row, SectionHeader } from '@/ui/bits';
import { Button, IconButton } from '@/ui/Button';
import { Donut, ProgressBar } from '@/ui/charts';
import { Segmented } from '@/ui/controls';
import { MonthPicker } from '@/ui/MonthPicker';
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
          <Money cents={debts} variant="bodyStrong" tone="inverse" />
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

/** One account. Its page has the balance, transactions and, for a known card, its benefits. */
function AccountRow({ a }: { a: Account }) {
  const inst = institution(a.institutionId, a.institutionName);
  const title = useAccountTitle(a);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <Row
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: a.id } })}
          accessibilityLabel={`${title}, ${inst.name}`}
          left={<InstitutionBadge name={inst.name} color={inst.color} />}
          title={title}
          subtitle={`${inst.name} ••${a.mask}`}
          right={
            <View style={{ alignItems: 'flex-end' }}>
              <Money cents={a.balanceCents} variant="amount" />
              {isLiability(a.type) && <Text variant="small" tone="subtle">owed</Text>}
            </View>
          }
        />
      </View>
    </View>
  );
}

function Spending() {
  const [kind, setKind] = useState<PeriodKind>('month');
  const [month, setMonth] = useState(monthKey);
  const { total, top, earliest } = useMonthSpending(month);
  // Switching between months and weeks starts at the current one.
  const switchKind = (k: PeriodKind) => {
    setKind(k);
    setMonth(periodKey(k));
  };
  const rest = total - top.reduce((s, r) => s + r.cents, 0);
  const t = useTheme();
  const { info } = useSpendCategories();
  // Biggest first, Other included: it takes its place by amount, not always last.
  const lines = [
    ...top.map((r) => ({ slug: r.category as string, label: info(r.category).label, color: info(r.category).color, cents: r.cents, muted: false })),
    ...(rest > 0 ? [{ slug: 'other', label: 'Other', color: t.textSubtle, cents: rest, muted: true }] : []),
  ].sort((a, b) => b.cents - a.cents);
  const data = lines.map((l) => ({ value: l.cents, color: l.color, label: l.label }));
  const current = month === periodKey(kind);
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader
        title="Spending"
        action={
          <View style={{ width: 168 }}>
            <Segmented<PeriodKind>
              label="Show spending by"
              value={kind}
              onChange={switchKind}
              options={[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
              ]}
            />
          </View>
        }
      />
      <Surface style={{ gap: space.lg }}>
        <View style={{ alignItems: 'center' }}>
          <MonthPicker month={month} earliest={earliest} onChange={setMonth} />
        </View>
        {total === 0 ? (
          <EmptyState icon={Sparkles} title={current ? `No spending yet this ${kind}` : `No spending ${periodPhrase(month)}`} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xl }}>
            <Donut data={data} size={156} stroke={20} format={(v) => money(v, { whole: true })}>
              <Text variant="small" tone="muted">Total</Text>
              <Money cents={total} variant="h2" whole />
            </Donut>
            <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
              {lines.map((l) => (
                <CategoryLine key={l.slug} slug={l.slug} month={month} label={l.label} color={l.color} cents={l.cents} share={l.cents / total} muted={l.muted} />
              ))}
            </View>
          </View>
        )}
      </Surface>
    </View>
  );
}

/** One legend line under the spending chart. Opens that category's transactions. */
function CategoryLine({ slug, month, label, color, cents, share, muted }: { slug: string; month: string; label: string; color: string; cents: number; share: number; muted?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: see transactions`}
      onPress={() => router.push({ pathname: '/spending/[category]', params: { category: slug, month } })}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 10 },
        (pressed || hovered) && { backgroundColor: t.surfaceAlt },
      ]}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text variant="bodyStrong" tone={muted ? 'muted' : undefined} style={{ flex: 1 }} numberOfLines={1}>{label}</Text>
      <Text variant="small" tone="subtle">{pct(share)}</Text>
      <Money cents={cents} variant="amount" whole style={{ minWidth: 64, textAlign: 'right' }} />
      <ChevronRight size={16} color={t.textSubtle} />
    </Pressable>
  );
}

function Budgets() {
  const t = useTheme();
  const { info, isActive } = useSpendCategories();
  // A budget for a category the user turned off or deleted stays saved but isn't shown.
  const budgets = useStore((s) => s.budgets).filter((b) => isActive(b.category));
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
            const color = over ? t.danger : ratio > 0.85 ? '#F0A53A' : info(b.category).color;
            return (
              <Pressable
                key={b.category}
                accessibilityRole="button"
                accessibilityLabel={`${info(b.category).label} budget: see transactions`}
                onPress={() => router.push({ pathname: '/spending/[category]', params: { category: b.category } })}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 8, margin: -8, borderRadius: 12 },
                  (pressed || hovered) && { backgroundColor: t.surfaceAlt },
                ]}>
                <CategoryIcon category={b.category} size={38} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{info(b.category).label}</Text>
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
              </Pressable>
            );
          })}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: space.xxl, overflow: 'hidden', minHeight: 190, justifyContent: 'center', boxShadow: '0px 18px 44px rgba(64,57,223,0.28)' },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.md, paddingBottom: 4, paddingTop: 4 },
});
