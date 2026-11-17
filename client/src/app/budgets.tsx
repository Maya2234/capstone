import { router } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { BUDGET_CATEGORIES, CATEGORIES, type CategoryId } from '@/data/categories';
import { useMonthSpending } from '@/data/derive';
import { useStore } from '@/data/store';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { CategoryIcon } from '@/ui/bits';
import { Button, IconButton } from '@/ui/Button';
import { Chip, Input } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

export default function Budgets() {
  const t = useTheme();
  const toast = useToast();
  const saved = useStore((s) => s.budgets);
  const setBudget = useStore((s) => s.setBudget);
  const removeBudget = useStore((s) => s.removeBudget);
  const { byCategory } = useMonthSpending();
  const [draft, setDraft] = useState(() => saved.map((b) => ({ category: b.category, value: String(Math.round(b.limitCents / 100)) })));
  const unused = BUDGET_CATEGORIES.filter((c) => !draft.some((d) => d.category === c));
  const invalid = draft.some((d) => !(Number(d.value) > 0));

  function save() {
    for (const b of saved) if (!draft.some((d) => d.category === b.category)) removeBudget(b.category);
    for (const d of draft) setBudget(d.category, Math.round(Number(d.value) * 100));
    toast('Budgets saved');
    router.back();
  }
  const add = (c: CategoryId) => {
    const spent = byCategory.get(c) ?? 0;
    setDraft((d) => [...d, { category: c, value: String(Math.max(50, Math.ceil(spent / 100 / 50) * 50)) }]);
  };

  return (
    <Sheet title="Monthly budgets" footer={<Button label="Save budgets" onPress={save} disabled={invalid} full />}>
      <Surface padded={false} style={{ padding: space.sm }}>
        {draft.length === 0 && <Text tone="muted" style={{ padding: space.md }}>Pick a category below to start.</Text>}
        {draft.map((d, i) => (
          <View key={d.category} style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }, i > 0 && { borderTopWidth: 1, borderTopColor: t.border }]}>
            <CategoryIcon category={d.category} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyStrong" numberOfLines={1}>{CATEGORIES[d.category].label}</Text>
              <Text variant="small" tone="subtle" numberOfLines={1}>{money(byCategory.get(d.category) ?? 0, { whole: true })} spent</Text>
            </View>
            <View style={{ width: 112 }}>
              <Input
                label={`${CATEGORIES[d.category].label} budget`}
                hideLabel
                prefix="$"
                value={d.value}
                keyboardType="number-pad"
                onChangeText={(v) => setDraft((all) => all.map((x) => (x.category === d.category ? { ...x, value: v.replace(/[^\d]/g, '').slice(0, 6) } : x)))}
                error={Number(d.value) > 0 ? undefined : 'Required'}
              />
            </View>
            <IconButton icon={X} label={`Remove ${CATEGORIES[d.category].label} budget`} size={36} onPress={() => setDraft((all) => all.filter((x) => x.category !== d.category))} />
          </View>
        ))}
      </Surface>
      {unused.length > 0 && (
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Plus size={16} color={t.textMuted} />
            <Text variant="smallStrong" tone="muted">Add a category</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {unused.map((c) => (
              <Chip key={c} label={CATEGORIES[c].label} on={false} onPress={() => add(c)} />
            ))}
          </View>
        </View>
      )}
    </Sheet>
  );
}
