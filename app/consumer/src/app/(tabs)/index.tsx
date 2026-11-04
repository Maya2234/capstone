import { useState } from 'react';
import { View } from 'react-native';
import { api, label, money, pct } from '@/api';
import { linkAccount, Screen } from '@/screen';
import { useLoad } from '@/session';
import { Bar, Box, Button, Chip, ErrorText, Loading, Row, T, useTheme } from '@/ui';

const RANGES = [30, 90] as const;
const stats = { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 8, marginTop: 10 } as const;

export default function Overview() {
  const t = useTheme();
  const [days, setDays] = useState<number>(30);
  const accounts = useLoad(() => api.accounts());
  const insights = useLoad(() => api.insights(days), String(days));
  const refresh = async () => { await Promise.all([accounts.reload(), insights.reload()]); };

  if (accounts.loading && !accounts.data) return <Loading />;
  const a = accounts.data;
  const i = insights.data;

  if (a && a.cards.length === 0 && a.accounts.length === 0) {
    // REQ-14: empty state with Add a card.
    return (
      <Screen>
        <Box style={{ alignItems: 'center', paddingVertical: 32 }}>
          <T size={40}>💳</T>
          <T weight="700" size={20} style={{ marginTop: 8 }}>Link your first card</T>
          <T muted style={{ textAlign: 'center', marginVertical: 8 }}>
            Connect your banks and credit cards. CardStack picks the best card for every purchase and shows where your money goes.
          </T>
          <View style={{ width: '100%', maxWidth: 320 }}>
            <Button title="Add a card" onPress={async () => { await linkAccount(); refresh(); }} />
          </View>
        </Box>
      </Screen>
    );
  }

  const maxCat = Math.max(1, ...(i?.categories ?? []).map((c) => c.spentCents));
  return (
    <Screen onRefresh={refresh}>
      <ErrorText error={accounts.error || insights.error} />
      {a && (
        <Box>
          <T muted size={13}>Net position</T>
          <T size={32} weight="800">{money(a.totals.netCents)}</T>
          <View style={stats}>
            <View><T muted size={12}>Cash</T><T weight="700">{money(a.totals.cashCents)}</T></View>
            <View><T muted size={12}>Card balances</T><T weight="700">{money(a.totals.creditBalanceCents)}</T></View>
            <View><T muted size={12}>Utilization</T><T weight="700" color={a.totals.utilization > 0.3 ? t.warn : t.good}>{pct(a.totals.utilization)}</T></View>
          </View>
          <Bar value={a.totals.utilization} color={a.totals.utilization > 0.3 ? t.warn : t.good} />
          <T muted size={12} style={{ marginTop: 4 }}>{money(a.totals.creditLimitCents - a.totals.creditBalanceCents, 0)} available across {a.cards.length} cards</T>
        </Box>
      )}

      <Row style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
        {RANGES.map((d) => <Chip key={d} text={`Last ${d} days`} active={d === days} onPress={() => setDays(d)} />)}
      </Row>

      {i && (
        <>
          <Box>
            <T weight="700" size={17}>Rewards</T>
            <View style={stats}>
              <View><T muted size={12}>Earned</T><T weight="700" size={18}>{money(i.rewards.earnedCents)}</T></View>
              <View><T muted size={12}>Possible</T><T weight="700" size={18}>{money(i.rewards.possibleCents)}</T></View>
              <View><T muted size={12}>Missed</T><T weight="700" size={18} color={i.rewards.missedCents > 0 ? t.warn : t.good}>{money(i.rewards.missedCents)}</T></View>
            </View>
            <T muted size={13} style={{ marginTop: 8 }}>
              {i.rewards.missedCents > 0
                ? `Paying with CardStack would have earned ${money(i.rewards.missedCents)} more on these purchases.`
                : 'You used your best card on every purchase. Nice.'}
              {i.rewards.cardstackEarnedCents > 0 ? ` CardStack checkouts have earned you ${money(i.rewards.cardstackEarnedCents)} so far.` : ''}
            </T>
          </Box>

          <Box>
            <Row><T weight="700" size={17}>Spending by category</T><T muted>{money(i.totalSpentCents, 0)}</T></Row>
            {i.categories.map((c) => (
              <View key={c.category} style={{ marginTop: 12 }}>
                <Row>
                  <T weight="600">{label(c.category)}</T>
                  <T>{money(c.spentCents, 0)}</T>
                </Row>
                <Bar value={c.spentCents / maxCat} />
                {c.bestCardName ? (
                  <T muted size={12} style={{ marginTop: 3 }}>
                    Best card: {c.bestCardName} ({c.bestRate}x){c.possibleCents > c.earnedCents ? ` · ${money(c.possibleCents - c.earnedCents)} more possible` : ''}
                  </T>
                ) : null}
              </View>
            ))}
          </Box>

          <Box>
            <T weight="700" size={17}>Top merchants</T>
            {i.topMerchants.map((m, idx) => (
              <Row key={m.merchant} style={{ marginTop: 10 }}>
                <T>{idx + 1}. {m.merchant}</T><T weight="600">{money(m.spentCents, 0)}</T>
              </Row>
            ))}
          </Box>
        </>
      )}

      {a && a.accounts.length > 0 && (
        <Box>
          <T weight="700" size={17}>Bank accounts</T>
          {a.accounts.map((acct) => (
            <Row key={acct.id} style={{ marginTop: 10 }}>
              <View><T weight="600">{acct.name}</T><T muted size={12}>{acct.institution} · {acct.subtype} •••• {acct.mask}</T></View>
              <T weight="700">{money(acct.balanceCents)}</T>
            </Row>
          ))}
        </Box>
      )}
      <Button title="Link another account" kind="ghost" onPress={async () => { await linkAccount(); refresh(); }} />
    </Screen>
  );
}
