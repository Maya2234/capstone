import { useRef, useState } from 'react';
import { Platform, View, type ViewProps } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { useTheme } from '@/theme/theme';

import { Text } from './Text';

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const t = useTheme();
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height: '100%', borderRadius: height, backgroundColor: color ?? t.primary }} />
    </View>
  );
}

/**
 * Ring chart. Segments are drawn with small gaps. Give segments a `label` and a `format` and
 * pointing at one (hover on the web, tap on phones) shows its name, amount and share in the
 * middle in place of `children`, and fades the others.
 */
export function Donut({
  data,
  size = 168,
  stroke = 22,
  format,
  children,
}: {
  data: { value: number; color: string; label?: string }[];
  size?: number;
  stroke?: number;
  format?: (value: number) => string;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const [active, setActive] = useState<number | null>(null);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const gap = data.length > 1 ? 3 : 0;
  // Where each segment starts along the ring.
  const starts = data.map((_, i) => data.slice(0, i).reduce((s, d) => s + (d.value / total) * c, 0));
  const interactive = !!format && data.some((d) => d.label);

  /** Which segment is under a point (relative to the chart's top-left), or null. */
  function segmentAt(x: number, y: number): number | null {
    const dx = x - size / 2;
    const dy = y - size / 2;
    const dist = Math.hypot(dx, dy);
    if (dist < r - stroke / 2 - 4 || dist > r + stroke / 2 + 4) return null;
    // 0 at the top, going clockwise, like the drawing.
    const along = (((Math.atan2(dy, dx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)) * total;
    let run = 0;
    for (let i = 0; i < data.length; i++) {
      run += data[i].value;
      if (along <= run) return i;
    }
    return null;
  }

  function point(e: { nativeEvent: { clientX?: number; clientY?: number; locationX?: number; locationY?: number } }) {
    const n = e.nativeEvent;
    if (Platform.OS === 'web' && n.clientX !== undefined) {
      const box = (ref.current as unknown as HTMLElement).getBoundingClientRect();
      return segmentAt(n.clientX - box.left, (n.clientY ?? 0) - box.top);
    }
    return segmentAt(n.locationX ?? -1, n.locationY ?? -1);
  }

  const shown = active !== null ? data[active] : null;
  type At = Parameters<typeof point>[0];
  const handlers: ViewProps = !interactive
    ? {}
    : Platform.OS === 'web'
      ? {
          onPointerMove: (e) => setActive(point(e as unknown as At)),
          onPointerDown: (e) => setActive(point(e as unknown as At)),
          onPointerLeave: () => setActive(null),
        }
      : {
          // Phones: tap a slice to show it, tap it again to hide.
          onStartShouldSetResponder: () => true,
          onResponderGrant: (e) => {
            const i = point(e as unknown as At);
            setActive((cur) => (i === cur ? null : i));
          },
        };

  return (
    <View ref={ref} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} {...handlers}>
      <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none">
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.surfaceAlt} strokeWidth={stroke} fill="none" />
          {data.map((d, i) => {
            const len = (d.value / total) * c;
            const dash = Math.max(0.01, len - gap);
            return (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={d.color}
                strokeWidth={active === i ? stroke + 4 : stroke}
                strokeOpacity={active === null || active === i ? 1 : 0.3}
                strokeLinecap="butt"
                fill="none"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-starts[i] - gap / 2}
              />
            );
          })}
        </G>
      </Svg>
      {shown && format ? (
        <View pointerEvents="none" style={{ alignItems: 'center', maxWidth: size - stroke * 2 - 8 }} accessibilityLiveRegion="polite">
          <Text variant="small" tone="muted" numberOfLines={1}>{shown.label}</Text>
          <Text variant="h2" numberOfLines={1}>{format(shown.value)}</Text>
          <Text variant="small" tone="subtle">{Math.round((shown.value / total) * 100)}%</Text>
        </View>
      ) : (
        <View pointerEvents="none" style={{ alignItems: 'center' }}>{children}</View>
      )}
    </View>
  );
}
