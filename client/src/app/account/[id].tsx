import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, CreditCard, Gift, Search, Unlink } from 'lucide-react-native';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { product, shortName } from '@/data/catalog';
import { institution } from '@/data/demo';
import { useAccountTitle, useTransactions } from '@/data/derive';
import { useStore } from '@/data/store';
import { confirm } from '@/lib/confirm';
import { dayLabel, money } from '@/lib/format';
import { useTheme, useWide } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { Badge, CategoryIcon, Divider, EmptyState, InstitutionBadge, Money, Row } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { ProgressBar } from '@/ui/charts';
import { Input } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

const TYPE_LABEL = { checking: 'Checking', savings: 'Savings', credit: 'Credit card', investment: 'Investments', loan: 'Loan' };

export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const unlink = useStore((s) => s.unlinkInstitution);
  const toast = useToast();
  const wide = useWide();
  const t = useTheme();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const txns = useTransactions(account);
  const title = useAccountTitle(account);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? txns.filter((x) => x.merchant.toLowerCase().includes(s)) : txns;
  }, [txns, q]);

  if (!account) {
    return (
      <Screen back inShell={false}>
        <EmptyState icon={Unlink} title="This account isn’t connected anymore" action={<Button label="Back to Home" onPress={() => router.replace('/')} />} />
      </Screen>
    );
  }
  const inst = institution(account.institutionId, account.institutionName);
  const isCredit = account.type === 'credit';
  const card = account.productId ? product(account.productId) : undefined;

  async function disconnect() {
    const ok = await confirm(`Disconnect ${inst.name}?`, `This removes every ${inst.name} account and its cards from CardMaxx. You can link it again any time.`, 'Disconnect');
    if (!ok) return;
    setBusy(true);
    try {
      await unlink(inst.id);
      toast(`${inst.name} disconnected`);
      router.replace('/');
    } catch (e) {
      toast(e instanceof Error ? e.message : `Couldn’t disconnect ${inst.name}. Try again.`, 'error');
      setBusy(false);
    }
  }

  const groups: { day: string; items: typeof shown }[] = [];
  for (const x of shown) {
    const day = new Date(x.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(x);
    else groups.push({ day, items: [x] });
  }

  return (
    <Screen back title={title} inShell={false} maxWidth={wide ? 820 : undefined}>
      <Surface style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <InstitutionBadge name={inst.name} color={inst.color} size={44} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{inst.name}</Text>
            <Text variant="small" tone="muted">{card ? shortName(card) : TYPE_LABEL[account.type]} ••{account.mask}</Text>
          </View>
        </View>
        <View>
          <Text variant="small" tone="muted">{isCredit || account.type === 'loan' ? 'Current balance' : 'Balance'}</Text>
          <Money cents={account.balanceCents} variant="h1" />
        </View>
        {isCredit && account.limitCents ? (
          <View style={{ gap: 8 }}>
            <ProgressBar value={account.balanceCents / account.limitCents} />
            <Text variant="small" tone="muted">
              {money(account.limitCents - account.balanceCents)} available of {money(account.limitCents, { whole: true })}
            </Text>
          </View>
        ) : null}
        {card && (
          // Which card this is, and the way to its benefits.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${card.name}: see benefits`}
            onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: t.primarySoft },
              (pressed || hovered) && { opacity: 0.85 },
            ]}>
            <Gift size={22} color={t.primarySoftText} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyStrong" numberOfLines={1} style={{ color: t.primarySoftText }}>{card.name}</Text>
              <Text variant="small" style={{ color: t.primarySoftText, opacity: 0.85 }}>See benefits and rewards</Text>
            </View>
            <ChevronRight size={18} color={t.primarySoftText} />
          </Pressable>
        )}
        {isCredit && !account.productId && (
          <View style={{ gap: 6 }}>
            <Text variant="small" tone="muted">We couldn’t tell which card this is from the bank’s name for it. Pick it so CardMaxx can use its rewards.</Text>
            <Button label="Choose which card this is" icon={CreditCard} variant="soft" onPress={() => router.push({ pathname: '/add-card', params: { account: account.id } })} />
          </View>
        )}
      </Surface>

      <View style={{ gap: space.md }}>
        <Text variant="h2" accessibilityRole="header">Transactions</Text>
        <Input label="Search transactions" placeholder="Search by name" value={q} onChangeText={setQ} />
        {groups.length === 0 ? (
          <Surface>
            <EmptyState icon={Search} title={q ? 'No matches' : 'No transactions yet'} />
          </Surface>
        ) : (
          groups.map((g) => (
            <View key={g.day} style={{ gap: space.sm }}>
              <Text variant="label" tone="subtle" style={{ paddingHorizontal: 4 }}>{g.day}</Text>
              <Surface padded={false} style={{ padding: space.sm }}>
                {g.items.map((x, i) => (
                  <Fragment key={x.id}>
                    {i > 0 && <Divider inset={64} />}
                    <Row
                      left={<CategoryIcon category={x.category} />}
                      title={x.merchant}
                      subtitle={dayLabel(x.date)}
                      right={
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <Money cents={-x.amountCents} sign tone={x.amountCents < 0 ? 'success' : 'text'} />
                          {x.pending && <Badge label="Pending" tone="warning" />}
                        </View>
                      }
                    />
                  </Fragment>
                ))}
              </Surface>
            </View>
          ))
        )}
      </View>

      <Button label={`Disconnect ${inst.name}`} icon={Unlink} variant="danger" onPress={disconnect} loading={busy} disabled={busy} />
    </Screen>
  );
}
