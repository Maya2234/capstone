import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { useTheme } from '@/theme/theme';

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const t = useTheme();
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height: '100%', borderRadius: height, backgroundColor: color ?? t.primary }} />
    </View>
  );
}

/** Ring chart. Segments are drawn with small gaps and rounded ends. */
export function Donut({ data, size = 168, stroke = 22, children }: { data: { value: number; color: string }[]; size?: number; stroke?: number; children?: React.ReactNode }) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const gap = data.length > 1 ? 3 : 0;
  // Where each segment starts along the ring.
  const starts = data.map((_, i) => data.slice(0, i).reduce((s, d) => s + (d.value / total) * c, 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
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
                strokeWidth={stroke}
                strokeLinecap="butt"
                fill="none"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-starts[i] - gap / 2}
              />
            );
          })}
        </G>
      </Svg>
      {children}
    </View>
  );
}
