import { useMemo, useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';
import { api, label, money } from '@/api';
import { Screen } from '@/screen';
import { useLoad, useSession } from '@/session';
import { Box, Button, Chip, ErrorText, Loading, Row, T, useTheme } from '@/ui';

export default function More() {
  const t = useTheme();
  const { email, signOut } = useSession();
  const catalog = useLoad(() => api.products());
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const products = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (catalog.data?.products ?? []).filter((p) => !s || `${p.name} ${p.issuer} ${p.rules.map((r) => r.category).join(' ')}`.toLowerCase().includes(s));
  }, [catalog.data, q]);

  return (
    <Screen>
      <Box>
        <T weight="700" size={17}>Account</T>
        <T muted>{email}</T>
        <Button kind="ghost" title="Sign out" onPress={signOut} />
      </Box>

      <T weight="700" size={17} style={{ marginVertical: 8 }}>Card rewards library</T>
      <T muted size={13} style={{ marginBottom: 8 }}>
        {catalog.data ? `${catalog.data.products.length} cards · rates as of ${catalog.data.asOf}. Rates change; check the issuer link before applying.` : ''}
      </T>
      <TextInput value={q} onChangeText={setQ} placeholder="Search cards, issuers or categories" placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, borderColor: t.line, backgroundColor: t.surface }]} />
      <ErrorText error={catalog.error} />
      {catalog.loading && !catalog.data && <Loading />}
      {products.map((p) => (
        <Box key={p.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <T weight="700">{p.name}</T>
              <T muted size={12}>{p.issuer} · {p.network} · {p.annualFeeCents ? `${money(p.annualFeeCents, 0)}/yr` : 'No annual fee'}</T>
            </View>
            <Chip text={p.confidence === 'high' ? 'Verified' : p.confidence === 'medium' ? 'Check rates' : 'May be outdated'}
              active={p.confidence === 'high'} onPress={() => setOpen(open === p.id ? null : p.id)} />
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {p.rules.filter((r) => !r.category.startsWith('portal:')).slice(0, open === p.id ? 99 : 4).map((r) => (
              <Chip key={r.category} text={`${r.rate}x ${label(r.category)}`} />
            ))}
            {p.rotating && <Chip text={`${p.rotating.rate}% rotating`} />}
            {p.choiceCategory && <Chip text={`${p.choiceCategory.rate}% your choice`} />}
            {p.topCategory && <Chip text={`${p.topCategory.rate}% top category`} />}
            <Chip text={`${p.baseRate}x everything else`} />
          </View>
          {open === p.id && (
            <View style={{ marginTop: 6 }}>
              <T muted size={12}>{p.currency}, valued at {p.pointValueCents}¢ per point.{p.notes ? ` ${p.notes}` : ''}</T>
              {p.rules.filter((r) => r.note || r.category.startsWith('portal:')).map((r) => (
                <T key={r.category} muted size={12}>• {r.rate}x {label(r.category)}{r.category.startsWith('portal:') ? ' (issuer travel site only)' : ''}{r.note ? `: ${r.note}` : ''}</T>
              ))}
              <Button kind="ghost" title="Issuer page" onPress={() => Linking.openURL(p.sourceUrl)} />
            </View>
          )}
        </Box>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, marginBottom: 12 },
});
