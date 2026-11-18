import Svg, { ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { palette, QUARTERS, quarterPath, wordPath, CAP } from '@/brand/glyphs';
import { useTheme } from '@/theme/theme';

/** The quarter-tile mark. `mono` paints all four quarters one color. */
export function Mark({ size = 32, mono }: { size?: number; mono?: string }) {
  // Fixed, not useId(): the same on the server and in the browser (useId differed and broke
  // hydration). Every copy of the logo draws identical gradients, so sharing ids is harmless.
  const id = 'cmxmark';
  return (
    <Svg width={size} height={size} viewBox="20 20 160 160" accessibilityLabel="CardMaxx">
      <Defs>
        <ClipPath id={`${id}c`}>
          <Rect x={20} y={20} width={160} height={160} rx={22} />
        </ClipPath>
        {QUARTERS.map((q, i) => (
          <RadialGradient key={i} id={`${id}${i}`} gradientUnits="userSpaceOnUse" cx={q.x} cy={q.y} r={80} fx={q.x} fy={q.y}>
            <Stop offset={0} stopColor={q.deep} />
            <Stop offset={0.55} stopColor={q.deep} />
            <Stop offset={1} stopColor={q.light} />
          </RadialGradient>
        ))}
      </Defs>
      <G clipPath={`url(#${id}c)`}>
        {QUARTERS.map((q, i) => (
          <Path key={i} d={quarterPath(q)} fill={mono ?? `url(#${id}${i})`} />
        ))}
      </G>
    </Svg>
  );
}

const CARD = wordPath('CARD');
const MAXX = wordPath('MAXX');
const GAP = 3.2;

/** Mark + CARDMAXX lettering from the star logo. `height` is the mark size. */
export function Wordmark({ height = 30, showMark = true, tone }: { height?: number; showMark?: boolean; tone?: string }) {
  const t = useTheme();
  // Fixed, not useId(): the same on the server and in the browser (useId differed and broke
  // hydration). Every copy of the logo draws identical gradients, so sharing ids is harmless.
  const id = 'cmxword';
  const cap = height * 0.62;
  const s = cap / CAP;
  const w = (CARD.width + GAP + MAXX.width) * s;
  return (
    <Svg
      width={(showMark ? height + height * 0.36 : 0) + w}
      height={height}
      accessibilityRole="image"
      accessibilityLabel="CardMaxx">
      <Defs>
        <LinearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset={0} stopColor={palette.indigo} />
          <Stop offset={0.6} stopColor={palette.violet} />
          <Stop offset={1} stopColor={palette.orchid} />
        </LinearGradient>
      </Defs>
      {showMark && (
        <G>
          <MarkInline size={height} />
        </G>
      )}
      <G transform={`translate(${showMark ? height * 1.36 : 0} ${(height - cap) / 2}) scale(${s})`}>
        <Path d={CARD.d} fill={tone ?? t.text} fillRule="evenodd" />
        <Path d={MAXX.d} transform={`translate(${CARD.width + GAP} 0)`} fill={tone ?? `url(#${id}g)`} fillRule="evenodd" />
      </G>
    </Svg>
  );
}

// The mark drawn inside another Svg (nested Svg elements are unreliable on web).
function MarkInline({ size }: { size: number }) {
  // Fixed, not useId(): the same on the server and in the browser (useId differed and broke
  // hydration). Every copy of the logo draws identical gradients, so sharing ids is harmless.
  const id = 'cmxtile';
  const k = size / 160;
  return (
    <G transform={`scale(${k}) translate(-20 -20)`}>
      <Defs>
        <ClipPath id={`${id}c`}>
          <Rect x={20} y={20} width={160} height={160} rx={22} />
        </ClipPath>
        {QUARTERS.map((q, i) => (
          <RadialGradient key={i} id={`${id}${i}`} gradientUnits="userSpaceOnUse" cx={q.x} cy={q.y} r={80} fx={q.x} fy={q.y}>
            <Stop offset={0} stopColor={q.deep} />
            <Stop offset={0.55} stopColor={q.deep} />
            <Stop offset={1} stopColor={q.light} />
          </RadialGradient>
        ))}
      </Defs>
      <G clipPath={`url(#${id}c)`}>
        {QUARTERS.map((q, i) => (
          <Path key={i} d={quarterPath(q)} fill={`url(#${id}${i})`} />
        ))}
      </G>
    </G>
  );
}
