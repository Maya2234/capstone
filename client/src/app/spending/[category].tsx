import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronRight, ReceiptText } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { Pressable, View } from 'react-native';

import { byMerchant, isPeriodKey, monthKey, periodPhrase, useMonthSpending } from '@/data/derive';
import { useSpendCategories } from '@/data/spendCategories';
import type { SpendCategory } from '@/data/types';
import { shortDate } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Badge, CategoryIcon, Divider, EmptyState, Money, Row } from '@/ui/bits';
import { MonthPicker } from '@/ui/MonthPicker';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';

/**
 * One category's spending in a month, opened from the Home chart (that month) or a budget
 * (this month). "other" is everything the chart lumps together outside its top categories.
 * Merchants that show up more than once get a total of their own. Tapping a merchant or a
 * transaction lets you pick the category that merchant always goes in.
 */
export default function CategorySpending() {
  const params = useLocalSearchParams<{ category: string; month?: string }>();
  const [month, setMonth] = useState(() => (isPeriodKey(params.month) ? params.month : monthKey()));
  const [open, setOpen] = useState({ merchants: true, transactions: true });
  const { items, isOther, earliest } = useMonthSpending(month);
  const { info, isActive } = useSpendCategories();
  const known = isActive(params.category) ? (params.category as SpendCategory) : null;
  const title = known ? info(known).label : 'Other';
  const shown = items.filter((x) => (known ? x.category === known : isOther(x.category)));
  const total = shown.reduce((s, x) => s + x.amountCents, 0);
  // Merchants with more than one purchase get their own line, biggest first; one-off purchases
  // share an "Other merchants" line at the bottom.
  const merchants = byMerchant(shown);
  const singles = merchants.filter((m) => m.count === 1);
  const merchantLines = [
    ...merchants.filter((m) => m.count > 1).map((m) => ({ ...m, other: false })),
    ...(singles.length
      ? [{ key: '__other', name: 'Other merchants', cents: singles.reduce((s, m) => s + m.cents, 0), count: singles.length, other: true }]
      : []),
  ];
  const repeated = merchantLines.some((m) => !m.other) ? merchantLines : [];

  const chooseCategory = (merchant: string, transactionId?: string) =>
    router.push({ pathname: '/merchant-category', params: transactionId ? { merchant, transactionId } : { merchant } });

  return (
    <Sheet title={title}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' }}>
        <View style={{ gap: 2 }}>
          <Text variant="small" tone="muted">Spent {periodPhrase(month)}</Text>
          <Money cents={total} variant="h1" />
          <Text variant="small" tone="subtle">{shown.length} {shown.length === 1 ? 'transaction' : 'transactions'}</Text>
        </View>
        <MonthPicker month={month} earliest={earliest} onChange={setMonth} />
      </View>

      {shown.length === 0 ? (
        <Surface>
          <EmptyState icon={ReceiptText} title={`Nothing here ${periodPhrase(month)}`} />
        </Surface>
      ) : (
        <>
          {repeated.length > 0 && (
            <View style={{ gap: space.sm }}>
              <SectionToggle label="By merchant" count={repeated.length} open={open.merchants} onToggle={() => setOpen((o) => ({ ...o, merchants: !o.merchants }))} />
              {open.merchants && (
                <Surface padded={false} style={{ padding: space.sm }}>
                  {repeated.map((m, i) => (
                    <Fragment key={m.key}>
                      {i > 0 && <Divider inset={12} />}
                      <Row
                        title={m.name}
                        subtitle={`${m.count} ${m.other ? (m.count === 1 ? 'merchant' : 'merchants') : 'purchases'} · ${Math.round((m.cents / total) * 100)}% of ${title.toLowerCase()}`}
                        right={<Money cents={m.cents} variant="bodyStrong" />}
                        onPress={m.other ? undefined : () => chooseCategory(m.name)}
                        accessibilityLabel={m.other ? undefined : `${m.name}: choose its category`}
                        chevron={!m.other}
                      />
                    </Fragment>
                  ))}
                </Surface>
              )}
            </View>
          )}

          <View style={{ gap: space.sm }}>
            <SectionToggle label="Transactions" count={shown.length} open={open.transactions} onToggle={() => setOpen((o) => ({ ...o, transactions: !o.transactions }))} />
            {open.transactions && (
              <Surface padded={false} style={{ padding: space.sm }}>
                {shown.map((x, i) => (
                  <Fragment key={x.id}>
                    {i > 0 && <Divider inset={64} />}
                    <Row
                      left={<CategoryIcon category={x.category} />}
                      title={x.merchant}
                      subtitle={`${shortDate(x.date)} · ${known ? x.accountName : info(x.category).label}`}
                      onPress={() => chooseCategory(x.merchant, x.id)}
                      accessibilityLabel={`${x.merchant}: choose its category`}
                      right={
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <Money cents={x.amountCents} />
                          {x.pending && <Badge label="Pending" tone="warning" />}
                        </View>
                      }
                    />
                  </Fragment>
                ))}
              </Surface>
            )}
          </View>
          <Text variant="small" tone="subtle" style={{ textAlign: 'center' }}>Tap a merchant to move all its purchases to another category, or a transaction to move just that one.</Text>
        </>
      )}
    </Sheet>
  );
}

/** A section label that shows or hides the list under it. */
function SectionToggle({ label, count, open, onToggle }: { label: string; count: number; open: boolean; onToggle: () => void }) {
  const t = useTheme();
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}, ${count}. ${open ? 'Hide' : 'Show'}`}
      onPress={onToggle}
      hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8, alignSelf: 'flex-start' },
        (pressed || hovered) && { backgroundColor: t.surfaceAlt },
      ]}>
      <Icon size={16} color={t.textSubtle} />
      <Text variant="label" tone="subtle">{label}</Text>
      <Text variant="small" tone="subtle">({count})</Text>
    </Pressable>
  );
}
