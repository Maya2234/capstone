import { router, useLocalSearchParams } from 'expo-router';
import { Check, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CATEGORIES } from '@/data/categories';
import { CUSTOM_COLORS, CUSTOM_ICONS, useSpendCategories } from '@/data/spendCategories';
import { useStore } from '@/data/store';
import type { CustomCategory } from '@/data/types';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

/** Make a spending category of your own, or change or delete one (?id=custom_…). */
export default function CategoryEdit() {
  const t = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { customs } = useSpendCategories();
  const setPref = useStore((s) => s.setPref);
  const deleteCustomCategory = useStore((s) => s.deleteCustomCategory);
  const existing = customs.find((c) => c.id === id);

  const [label, setLabel] = useState(existing?.label ?? '');
  const [color, setColor] = useState(existing?.color ?? CUSTOM_COLORS[customs.length % CUSTOM_COLORS.length]);
  const [icon, setIcon] = useState(existing?.icon ?? 'tag');

  const name = label.trim();
  const taken =
    !!name &&
    (Object.values(CATEGORIES).some((c) => c.label.toLowerCase() === name.toLowerCase()) ||
      customs.some((c) => c.id !== existing?.id && c.label.toLowerCase() === name.toLowerCase()));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/categories'));

  function save() {
    if (!name || taken) return;
    if (existing) {
      setPref('customCategories', customs.map((c) => (c.id === existing.id ? { ...c, label: name, color, icon } : c)));
      toast(`${name} saved`);
    } else {
      const made: CustomCategory = { id: `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: name, color, icon };
      setPref('customCategories', [...customs, made]);
      toast(`${name} added. Move purchases into it from any category.`);
    }
    close();
  }

  async function remove() {
    if (!existing) return;
    const ok = await confirm(
      `Delete ${existing.label}?`,
      'Purchases you put in it go back to the category they had before. Any budget for it is removed.',
      'Delete',
    );
    if (!ok) return;
    deleteCustomCategory(existing.id);
    toast(`${existing.label} deleted`);
    close();
  }

  const Preview = CUSTOM_ICONS[icon];
  return (
    <Sheet
      title={existing ? 'Edit category' : 'New category'}
      footer={
        <View style={{ gap: space.sm }}>
          <Button label={existing ? 'Save' : 'Add category'} onPress={save} disabled={!name || taken} full />
          {existing && <Button label="Delete category" icon={Trash2} variant="ghost" onPress={remove} full />}
        </View>
      }>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: color + (t.scheme === 'dark' ? '33' : '26'), alignItems: 'center', justifyContent: 'center' }}>
          <Preview size={27} color={color} strokeWidth={2.1} />
        </View>
        <Text variant="h2" numberOfLines={1} style={{ flex: 1 }}>{name || 'Your category'}</Text>
      </View>

      <Input
        label="Name"
        value={label}
        onChangeText={setLabel}
        placeholder="Pets, Gifts, Hobbies…"
        maxLength={24}
        autoFocus={!existing}
        error={taken ? 'There’s already a category with that name' : undefined}
        onSubmitEditing={save}
      />

      <View style={{ gap: space.sm }}>
        <Text variant="bodyStrong">Color</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {CUSTOM_COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ checked: c === color }}
              accessibilityLabel={`Color ${c}`}
              onPress={() => setColor(c)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: c === color ? 3 : 0, borderColor: t.text }}>
              {c === color && <Check size={16} color="#fff" strokeWidth={3} />}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="bodyStrong">Icon</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {Object.entries(CUSTOM_ICONS).map(([key, Icon]) => {
            const on = key === icon;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Icon ${key.replace(/-\d*/g, ' ').trim()}`}
                onPress={() => setIcon(key)}
                style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color + '33' : t.surfaceAlt, borderWidth: on ? 2 : 0, borderColor: color }}>
                <Icon size={20} color={on ? color : t.textMuted} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </Sheet>
  );
}
