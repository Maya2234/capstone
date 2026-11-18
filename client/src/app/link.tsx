import { router } from 'expo-router';
import { Check, Landmark, Lock, MonitorSmartphone, Search } from 'lucide-react-native';
import { Fragment, useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { DEMO_ACCOUNTS, demoAccountsFor, INSTITUTIONS } from '@/data/demo';
import { useStore } from '@/data/store';
import type { Account } from '@/data/types';
import { refreshBanks } from '@/data/sync';
import { exchangePublicToken, PLAID_ENV } from '@/services/plaid';
import { usePlaidConnect } from '@/services/plaidLink';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Badge, Divider, EmptyState, InstitutionBadge, Row } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

/** Sample banks with made-up accounts, for demos. Off unless EXPO_PUBLIC_DEMO_BANKS=true. */
const DEMO_BANKS = process.env.EXPO_PUBLIC_DEMO_BANKS === 'true';

/**
 * Bank connection. On the website, "Continue with Plaid" opens Plaid Link: test banks when
 * EXPO_PUBLIC_PLAID_ENV is sandbox (user_good / pass_good), real ones when it's production.
 * Phones can't open Plaid until its phone library is added (PLAID.md, step 4).
 */
/**
 * After a bank connects: credit cards the app recognized are already in the Wallet. If any
 * weren't, go straight to "Add your cards" to pick them; otherwise close.
 */
function afterLink(added: Account[]) {
  const unknown = added.filter((a) => a.type === 'credit' && !a.productId);
  if (unknown.length) router.replace({ pathname: '/setup-cards', params: { institution: unknown[0].institutionId } });
  else if (router.canGoBack()) router.back();
  else router.replace('/');
}

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

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      setBusy('plaid');
      try {
        const { institution, accounts: added } = await exchangePublicToken(publicToken);
        linkAccounts(added);
        void refreshBanks(); // loads the transactions the server just pulled
        toast(`${institution} connected · ${added.length} account${added.length === 1 ? '' : 's'} added`);
        afterLink(added);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'The bank connection didn’t finish.', 'error');
        setBusy(null);
      }
    },
    [linkAccounts, toast],
  );
  const onPlaidError = useCallback((message: string) => toast(message, 'error'), [toast]);
  const plaid = usePlaidConnect(onPlaidSuccess, onPlaidError);

  function connectDemo(id: string, name: string) {
    setBusy(id);
    setTimeout(() => {
      const added = demoAccountsFor(id, 0);
      linkAccounts(added);
      toast(`${name} connected · ${added.length} account${added.length > 1 ? 's' : ''} added`);
      afterLink(added);
    }, 900);
  }

  return (
    <Sheet title="Link an account">
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: t.primarySoft, borderRadius: 16, padding: space.md }}>
        <Lock size={18} color={t.primarySoftText} />
        <Text variant="small" style={{ flex: 1, color: t.primarySoftText }}>Secured by Plaid. CardMaxx never sees your bank login.</Text>
      </View>

      {plaid.available && (
        <View style={{ gap: space.sm }}>
          <Button
            label={busy === 'plaid' ? 'Adding your accounts…' : 'Continue with Plaid'}
            icon={Landmark}
            size="lg"
            onPress={plaid.start}
            loading={plaid.loading || busy === 'plaid'}
            disabled={!!busy}
            full
          />
          {PLAID_ENV === 'sandbox' && (
            <Text variant="small" tone="subtle" style={{ textAlign: 'center' }}>Test mode: pick any bank and sign in with user_good / pass_good</Text>
          )}
        </View>
      )}

      {!plaid.available && !DEMO_BANKS && (
        <Surface>
          <EmptyState
            icon={MonitorSmartphone}
            title="Link banks on the website for now"
            body="Bank linking on phones is coming soon. Sign in to CardMaxx on the web to connect, and your accounts show up here too."
          />
        </Surface>
      )}

      {DEMO_BANKS && (
        <>
          <View style={{ gap: space.md }}>
            {plaid.available && <Text variant="smallStrong" tone="muted">Or try a demo bank</Text>}
            <Input label="Find your bank" placeholder="Search" value={q} onChangeText={setQ} autoFocus={!plaid.available} />
          </View>
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
                    onPress={done || busy ? undefined : () => connectDemo(i.id, i.name)}
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
            <Badge label="Demo banks · sample accounts" tone="neutral" />
          </View>
        </>
      )}
    </Sheet>
  );
}
