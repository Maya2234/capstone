import { router, useLocalSearchParams } from 'expo-router';
import { Check, RotateCcw } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { View } from 'react-native';

import { merchantKey, merchantName, useMerchantCategories } from '@/data/derive';
import { useSpendCategories } from '@/data/spendCategories';
import { useStore } from '@/data/store';
import type { SpendCategory } from '@/data/types';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { CategoryIcon, Divider, Row } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { Segmented } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

type Scope = 'one' | 'all';

/**
 * Pick a category for a merchant (every purchase there, past and future) or, when opened from
 * a transaction, for just that purchase. Every merchant already has one automatic category
 * (the one the bank used most); a choice here replaces it.
 */
export default function CategoryPicker() {
  const t = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams<{ merchant: string; transactionId?: string }>();
  const name = merchantName(params.merchant ?? '');
  const key = merchantKey(params.merchant ?? '');
  const txId = params.transactionId;
  const [scope, setScope] = useState<Scope>(txId ? 'one' : 'all');

  const prefs = useStore((s) => s.prefs);
  const setPref = useStore((s) => s.setPref);
  const merchant = useMerchantCategories().get(key);
  const { list, info } = useSpendCategories();
  const pickedForTx = txId ? prefs.transactionCategories[txId] : undefined;

  const current = scope === 'one' ? (pickedForTx ?? merchant?.category) : merchant?.category;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  function pick(c: SpendCategory) {
    if (scope === 'one' && txId) {
      setPref('transactionCategories', { ...prefs.transactionCategories, [txId]: c });
      toast(`This ${name} purchase now counts as ${info(c).label}`);
    } else {
      setPref('merchantCategories', { ...prefs.merchantCategories, [key]: c });
      toast(`All ${name} purchases now count as ${info(c).label}`);
    }
    close();
  }

  function reset() {
    if (scope === 'one' && txId) {
      const next = { ...prefs.transactionCategories };
      delete next[txId];
      setPref('transactionCategories', next);
      toast(`This purchase follows ${name} again`);
    } else {
      const next = { ...prefs.merchantCategories };
      delete next[key];
      setPref('merchantCategories', next);
      toast(`${name} is back to its automatic category`);
    }
    close();
  }

  const canReset = scope === 'one' ? !!pickedForTx : !!merchant?.chosen;
  const explain =
    scope === 'one'
      ? pickedForTx
        ? `You put this purchase in ${info(pickedForTx).label}. Other ${name} purchases go in ${merchant ? info(merchant.category).label : 'their own category'}.`
        : `Change just this purchase. Other ${name} purchases stay in ${merchant ? info(merchant.category).label : 'their category'}.`
      : merchant?.chosen
        ? `You put every ${name} purchase in ${info(merchant.category).label}. Purchases you changed one at a time keep their own category.`
        : `All ${name} purchases go in ${merchant ? info(merchant.category).label : 'one category'}, the one your bank used most for them. Pick another for all of them.`;

  return (
    <Sheet
      title={name || 'Category'}
      footer={
        canReset ? (
          <Button
            label={scope === 'one' ? `Use the ${name} category` : 'Go back to automatic'}
            icon={RotateCcw}
            variant="outline"
            onPress={reset}
            full
          />
        ) : undefined
      }>
      {txId && (
        <Segmented<Scope>
          label="Change"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'one', label: 'This purchase' },
            { value: 'all', label: `All at ${name}` },
          ]}
        />
      )}
      <Text tone="muted">{explain}</Text>
      <Surface padded={false} style={{ padding: space.sm }}>
        {list.map((c, i) => (
          <Fragment key={c}>
            {i > 0 && <Divider inset={64} />}
            <Row
              left={<CategoryIcon category={c} />}
              title={info(c).label}
              onPress={() => pick(c)}
              accessibilityLabel={scope === 'one' ? `Put this purchase in ${info(c).label}` : `Put all ${name} purchases in ${info(c).label}`}
              right={c === current ? <View><Check size={20} color={t.primary} /></View> : undefined}
            />
          </Fragment>
        ))}
      </Surface>
    </Sheet>
  );
}
