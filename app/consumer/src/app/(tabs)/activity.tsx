import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, CardStackTx, ExternalTx, label, money } from '@/api';
import { Screen } from '@/screen';
import { Box, Button, Chip, ErrorText, Loading, Row, T, useTheme } from '@/ui';

type Tab = 'cardstack' | 'all';

/** REQ-11: paginated history, 20 items per page. */
function usePaged<T>(fetchPage: (cursor: string) => Promise<{ items: T[]; nextCursor: string }>) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(async (from: string) => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchPage(from);
      setItems((prev) => (from ? [...prev, ...p.items] : p.items));
      setCursor(p.nextCursor);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);
  useEffect(() => {
    let alive = true;
    fetchPage('').then(
      (p) => { if (alive) { setItems(p.items); setCursor(p.nextCursor); setLoading(false); } },
      (e) => { if (alive) { setError(e); setLoading(false); } },
    );
    return () => { alive = false; };
  }, [fetchPage]);
  return { items, more: cursor !== '', loadMore: () => load(cursor), refresh: () => load(''), loading, error };
}

export default function Activity() {
  const [tab, setTab] = useState<Tab>('cardstack');
  const cs = usePaged<CardStackTx>(useCallback((c: string) => api.transactions(c), []));
  const ext = usePaged<ExternalTx>(useCallback((c: string) => api.external(c), []));
  const cur = tab === 'cardstack' ? cs : ext;

  return (
    <Screen onRefresh={cur.refresh}>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 0, marginBottom: 6 }}>
        <Chip text="CardStack payments" active={tab === 'cardstack'} onPress={() => setTab('cardstack')} />
        <Chip text="All linked spending" active={tab === 'all'} onPress={() => setTab('all')} />
      </Row>
      <ErrorText error={cur.error} />
      {tab === 'cardstack'
        ? cs.items.map((x) => <CardStackRow key={x.transactionId} tx={x} />)
        : ext.items.map((x) => <ExternalRow key={x.id} tx={x} />)}
      {!cur.loading && cur.items.length === 0 && (
        <Box><T muted>{tab === 'cardstack' ? 'No CardStack payments yet. Look for the Pay with CardStack button at checkout.' : 'No linked spending yet.'}</T></Box>
      )}
      {cur.loading && <Loading />}
      {cur.more && !cur.loading && <Button kind="ghost" title="Load more" onPress={cur.loadMore} />}
    </Screen>
  );
}

function CardStackRow({ tx }: { tx: CardStackTx }) {
  const t = useTheme();
  const ok = tx.state === 'SUCCEEDED';
  const color = ok ? t.good : tx.state === 'FAILED' || tx.state === 'ABANDONED' ? t.bad : t.warn;
  return (
    <Box>
      <Row>
        <View style={{ flex: 1 }}>
          <T weight="700">{tx.merchant}</T>
          <T muted size={12}>{new Date(tx.createdAt).toLocaleString()} · {tx.cardLast4 ? `•••• ${tx.cardLast4}` : 'no card'} · {tx.category}</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T weight="700">{money(tx.amountCents)}</T>
          <T size={12} color={color}>{ok ? `+${money(tx.pointsEarnedCents)} rewards` : tx.state.toLowerCase()}</T>
        </View>
      </Row>
    </Box>
  );
}

function ExternalRow({ tx }: { tx: ExternalTx }) {
  return (
    <Row style={{ paddingVertical: 10, paddingHorizontal: 4 }}>
      <View style={{ flex: 1 }}>
        <T weight="600">{tx.merchant}</T>
        <T muted size={12}>{tx.date} · {label(tx.category)}</T>
      </View>
      <T weight="600">{money(tx.amountCents)}</T>
    </Row>
  );
}
