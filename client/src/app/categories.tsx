import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Fragment } from 'react';
import { View } from 'react-native';

import { CATEGORIES, type CategoryId } from '@/data/categories';
import { useSpendCategories } from '@/data/spendCategories';
import { useStore } from '@/data/store';
import { space } from '@/theme/tokens';
import { CategoryIcon, Divider, Row } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { Switch } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';

const BUILT_IN = (Object.keys(CATEGORIES) as CategoryId[]).filter((c) => c !== 'general');

/**
 * Settings → Spending categories: turn built-in categories on or off and manage your own.
 * Only affects how spending is grouped (Home, budgets, category sheets); card rewards still
 * use the built-in categories, since that's how card earn rates are defined.
 */
export default function Categories() {
  const { customs, hidden } = useSpendCategories();
  const setPref = useStore((s) => s.setPref);

  const toggle = (c: CategoryId, on: boolean) => setPref('hiddenCategories', on ? hidden.filter((h) => h !== c) : [...hidden, c]);

  return (
    <Sheet title="Spending categories">
      <Text tone="muted">
        Choose the categories your spending is grouped into. Purchases in a category you turn off count as Everything else. Card rewards aren’t affected.
      </Text>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="subtle" style={{ paddingHorizontal: 4 }}>Your categories</Text>
        <Surface padded={false} style={{ padding: space.sm }}>
          {customs.map((c) => (
            <Fragment key={c.id}>
              <Row
                left={<CategoryIcon category={c.id} />}
                title={c.label}
                onPress={() => router.push({ pathname: '/category-edit', params: { id: c.id } })}
                accessibilityLabel={`Edit ${c.label}`}
                chevron
              />
              <Divider inset={64} />
            </Fragment>
          ))}
          <View style={{ padding: space.sm }}>
            <Button label="Add a category" icon={Plus} variant="soft" onPress={() => router.push('/category-edit')} full />
          </View>
        </Surface>
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="subtle" style={{ paddingHorizontal: 4 }}>Built-in</Text>
        <Surface padded={false} style={{ padding: space.sm }}>
          {BUILT_IN.map((c, i) => {
            const on = !hidden.includes(c);
            return (
              <Fragment key={c}>
                {i > 0 && <Divider inset={64} />}
                <Row
                  left={<View style={{ opacity: on ? 1 : 0.4 }}><CategoryIcon category={c} /></View>}
                  title={CATEGORIES[c].label}
                  subtitle={on ? undefined : 'Off: counts as Everything else'}
                  right={<Switch value={on} onChange={(v) => toggle(c, v)} label={`Use ${CATEGORIES[c].label}`} />}
                />
              </Fragment>
            );
          })}
          <Divider inset={64} />
          <Row left={<CategoryIcon category="general" />} title={CATEGORIES.general.label} subtitle="Always on: anything that fits nowhere else" />
        </Surface>
      </View>
    </Sheet>
  );
}
