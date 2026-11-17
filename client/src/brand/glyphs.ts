// CardMaxx brand geometry, shared by the app (react-native-svg) and scripts/build-brand.ts.
// Plain data only, so Node can import it directly to regenerate the files in /branding.

export const palette = {
  indigo: '#4039DF',
  periwinkle: '#6A6CF0',
  violet: '#864BE5',
  lavender: '#A98BE6',
  orchid: '#E39BDD',
  blush: '#FDC1E6',
  ice: '#CADCEB',
  mist: '#ECEBF0',
  ink: '#1A1640',
} as const;

type Pt = readonly [number, number];
type Glyph = { width: number; polys: readonly (readonly Pt[])[] };

// Lettering carried over from the star logo: chamfered corners, a flat-topped A
// with one straight leg, notched R and M. Drawn on a 14-unit cap height.
export const GLYPHS: Record<'C' | 'A' | 'R' | 'D' | 'M' | 'X', Glyph> = {
  C: { width: 10, polys: [[[0, 2.5], [2.5, 0], [10, 0], [10, 3], [3, 3], [3, 11], [10, 11], [10, 14], [2.5, 14], [0, 11.5]]] },
  A: {
    width: 10,
    polys: [
      [[0, 14], [5.4, 0], [10, 0], [10, 14], [7, 14], [7, 10.6], [3.9, 10.6], [3, 14]],
      [[4.85, 7.7], [7, 7.7], [7, 3], [6.35, 3]],
    ],
  },
  R: {
    width: 10,
    polys: [
      [[0, 0], [8, 0], [10, 2], [10, 6.4], [8.7, 7.7], [10.2, 14], [7, 14], [5.9, 8.7], [3, 8.7], [3, 14], [0, 14]],
      [[3, 3], [7, 3], [7, 5.7], [3, 5.7]],
    ],
  },
  D: {
    width: 10,
    polys: [
      [[0, 0], [7, 0], [10, 3], [10, 11], [7, 14], [0, 14]],
      [[3, 3], [5.8, 3], [7, 4.2], [7, 9.8], [5.8, 11], [3, 11]],
    ],
  },
  M: {
    width: 12.4,
    polys: [[[0, 14], [0, 0], [3.5, 0], [6.2, 5.2], [8.9, 0], [12.4, 0], [12.4, 14], [9.4, 14], [9.4, 5.6], [7.1, 9.6], [5.3, 9.6], [3, 5.6], [3, 14]]],
  },
  X: {
    width: 10.4,
    polys: [[[0, 0], [3.5, 0], [5.2, 4.1], [6.9, 0], [10.4, 0], [7.1, 7], [10.4, 14], [6.9, 14], [5.2, 9.9], [3.5, 14], [0, 14], [3.3, 7]]],
  },
};

export const CAP = 14;
const TRACK = 1.5;
const SLANT = 0.12; // forward lean, x shift per unit of height

/** Path data for a word, origin at top-left, cap height 14. */
export function wordPath(word: string, scale = 1) {
  let x = 0;
  const parts: string[] = [];
  for (const ch of word) {
    const g = GLYPHS[ch as keyof typeof GLYPHS];
    if (!g) continue;
    for (const poly of g.polys) {
      parts.push(
        'M' + poly.map(([px, py]) => `${((x + px + (CAP - py) * SLANT) * scale).toFixed(2)} ${(py * scale).toFixed(2)}`).join('L') + 'Z',
      );
    }
    x += g.width + TRACK;
  }
  return { d: parts.join(''), width: (x - TRACK + CAP * SLANT) * scale };
}

// Mark: four quarter-circles (r=80) anchored at the corners of a 160 square on a 200 grid,
// leaving a four-point sparkle in the middle. viewBox "20 20 160 160".
export const QUARTERS = [
  { x: 20, y: 20, dx: 1, dy: 1, deep: palette.indigo, light: palette.periwinkle },
  { x: 180, y: 20, dx: -1, dy: 1, deep: palette.periwinkle, light: palette.lavender },
  { x: 180, y: 180, dx: -1, dy: -1, deep: palette.violet, light: palette.orchid },
  { x: 20, y: 180, dx: 1, dy: -1, deep: palette.orchid, light: palette.blush },
] as const;

export function quarterPath(q: (typeof QUARTERS)[number]) {
  const sweep = q.dx * q.dy > 0 ? 1 : 0;
  return `M${q.x} ${q.y} L${q.x + q.dx * 80} ${q.y} A80 80 0 0 ${sweep} ${q.x} ${q.y + q.dy * 80} Z`;
}
