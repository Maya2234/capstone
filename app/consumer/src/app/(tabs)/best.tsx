import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { api, money } from '@/api';
import { Screen } from '@/screen';
import { useLoad } from '@/session';
import { Box, Chip, ErrorText, Loading, Row, T, useTheme } from '@/ui';

const CATEGORIES = ['Restaurants', 'Groceries', 'Gas', 'Travel', 'Airline', 'Hotel', 'Rideshare', 'Streaming', 'Pharmacy', 'Clothing', 'Electronics', 'Home', 'Entertainment', 'General'];

export default function Best() {
  const t = useTheme();
  const [category, setCategory] = useState('Restaurants');
  const [amount, setAmount] = useState('100');
  const cents = Math.max(1, Math.round((parseFloat(amount) || 0) * 100));
  const rec = useLoad(() => api.recommend(category, cents), `${category}|${cents}`);

  return (
    <Screen>
      <Box>
        <T weight="700" size={17}>Which card should I use?</T>
        <T muted size={13}>The same ranking CardStack uses at checkout.</T>
        <Row style={{ marginTop: 12, justifyContent: 'flex-start' }}>
          <T size={22} weight="700">$</T>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal"
            style={[styles.input, { color: t.text, borderColor: t.line, backgroundColor: t.bg }]} />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
          {CATEGORIES.map((c) => <Chip key={c} text={c} active={c === category} onPress={() => setCategory(c)} />)}
        </View>
      </Box>

      <ErrorText error={rec.error} />
      {rec.loading && !rec.data ? <Loading /> : rec.data && (
        <>
          {rec.data.ranked.length === 0 && <Box><T>No eligible cards. Link a card first.</T></Box>}
          {rec.data.ranked.map((r, i) => (
            <Box key={r.cardId} style={i === 0 ? { borderColor: t.good, borderWidth: 2 } : undefined}>
              <Row>
                <View style={{ flex: 1 }}>
                  {i === 0 && <T size={12} weight="700" color={t.good}>BEST CHOICE</T>}
                  <T weight="700" size={16}>{r.productName}</T>
                  <T muted size={13}>{r.network} •••• {r.last4} · {r.reason}</T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T weight="800" size={18} color={i === 0 ? t.good : t.text}>{money(r.expectedValueCents)}</T>
                  <T muted size={12}>back</T>
                </View>
              </Row>
            </Box>
          ))}
          {(rec.data.excluded ?? []).length > 0 && (
            <T muted size={12}>{rec.data.excluded!.length} card(s) skipped: {[...new Set(rec.data.excluded!.map((e) => e.reason))].join(', ')}.</T>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { flex: 1, minWidth: 0, width: '100%', minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 22, fontWeight: '700' },
});
