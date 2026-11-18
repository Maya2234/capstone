import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { periodKey, periodKind, periodLabel, shiftPeriod } from '@/data/derive';

import { IconButton } from './Button';
import { Text } from './Text';

/**
 * ‹ October › or ‹ Nov 16 – 22 › — steps between months or weeks. Goes back as far as
 * `earliest` (the oldest period with spending) and forward up to the current one.
 */
export function MonthPicker({ month, earliest, onChange }: { month: string; earliest: string; onChange: (p: string) => void }) {
  const canBack = month > earliest;
  const canForward = month < periodKey(periodKind(month));
  const unit = periodKind(month) === 'week' ? 'week' : 'month';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <View style={{ opacity: canBack ? 1 : 0.35 }} pointerEvents={canBack ? 'auto' : 'none'}>
        <IconButton icon={ChevronLeft} label={`Previous ${unit}`} size={34} onPress={() => onChange(shiftPeriod(month, -1))} />
      </View>
      <Text variant="bodyStrong" style={{ minWidth: 104, textAlign: 'center' }} accessibilityLiveRegion="polite">{periodLabel(month)}</Text>
      <View style={{ opacity: canForward ? 1 : 0.35 }} pointerEvents={canForward ? 'auto' : 'none'}>
        <IconButton icon={ChevronRight} label={`Next ${unit}`} size={34} onPress={() => onChange(shiftPeriod(month, 1))} />
      </View>
    </View>
  );
}
