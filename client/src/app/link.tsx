import { router } from 'expo-router';
import { Check, Lock, Search } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { DEMO_ACCOUNTS, demoAccountsFor, INSTITUTIONS } from '@/data/demo';
import { useStore } from '@/data/store';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Badge, Divider, InstitutionBadge, Row } from '@/ui/bits';
import { Input } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

/**
 * Bank connection. In demo mode this lists sample banks and adds their sample accounts.
 * With Plaid connected, tapping a bank is replaced by Plaid Link (see PLAID.md, step 4).
 */
export default function LinkAccount() {
  const t = useTheme();
  const toast = useToast();
  const accounts = useStore((s) => s.accounts);
  const linkAccounts = useStore((s) => s.linkAccounts);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const linked = new Set(accounts.map((a) => a.institutionId));
  const list = INSTITUTIONS.filter((i) => DEMO_ACCOUNTS[i.id] && i.name.toLowerCase().includes(q.trim().toLowerCase())).sort(
    (a, b) => Number(linked.has(a.id)) - Number(linked.has(b.id)),
  );

  function connect(id: string, name: string) {
    setBusy(id);
    setTimeout(() => {
      const added = demoAccountsFor(id, 0);
      linkAccounts(added);
      toast(`${name} connected · ${added.length} account${added.length > 1 ? 's' : ''} added`);
      router.back();
    }, 900);
  }

  return (
    <Sheet title="Link an account">
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: t.primarySoft, borderRadius: 16, padding: space.md }}>
        <Lock size={18} color={t.primarySoftText} />
        <Text variant="small" style={{ flex: 1, color: t.primarySoftText }}>Secured by Plaid. CardMaxx never sees your bank login.</Text>
      </View>
      <Input label="Find your bank" placeholder="Search" value={q} onChangeText={setQ} autoFocus />
      <Surface padded={false} style={{ padding: space.sm }}>
        {list.length === 0 && (
          <View style={{ padding: space.lg, alignItems: 'center', gap: 6 }}>
            <Search size={20} color={t.textSubtle} />
            <Text tone="muted">No banks match “{q}”</Text>
          </View>
        )}
        {list.map((i, idx) => {
          const done = linked.has(i.id);
          return (
            <Fragment key={i.id}>
              {idx > 0 && <Divider inset={64} />}
              <Row
                onPress={done || busy ? undefined : () => connect(i.id, i.name)}
                left={<InstitutionBadge name={i.name} color={i.color} />}
                title={i.name}
                right={
                  busy === i.id ? <ActivityIndicator color={t.primary} /> : done ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Check size={16} color={t.success} />
                      <Text variant="smallStrong" tone="success">Linked</Text>
                    </View>
                  ) : null
                }
                chevron={!done && busy !== i.id}
              />
            </Fragment>
          );
        })}
      </Surface>
      <View style={{ alignItems: 'center' }}>
        <Badge label="Demo mode · sample accounts" tone="neutral" />
      </View>
    </Sheet>
  );
}
