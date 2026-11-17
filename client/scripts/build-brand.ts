// Regenerates the CardMaxx logo SVGs in ../../branding from src/brand/glyphs.ts.
// Run: node scripts/build-brand.ts   (Node 23+ strips the TypeScript types itself)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { palette, QUARTERS, quarterPath, wordPath, CAP } from '../src/brand/glyphs.ts';

const out = fileURLToPath(new URL('../../branding/', import.meta.url));
mkdirSync(out, { recursive: true });

type Mode = 'gradient' | 'flat' | { mono: string };
function markBody(mode: Mode, id: string) {
  let defs = `<clipPath id="${id}c"><rect x="20" y="20" width="160" height="160" rx="22"/></clipPath>`;
  let body = '';
  QUARTERS.forEach((q, i) => {
    let fill: string;
    if (mode === 'gradient') {
      defs += `<radialGradient id="${id}${i}" gradientUnits="userSpaceOnUse" cx="${q.x}" cy="${q.y}" r="80"><stop offset="0" stop-color="${q.deep}"/><stop offset=".55" stop-color="${q.deep}"/><stop offset="1" stop-color="${q.light}"/></radialGradient>`;
      fill = `url(#${id}${i})`;
    } else fill = mode === 'flat' ? q.deep : mode.mono;
    body += `<path d="${quarterPath(q)}" fill="${fill}"/>`;
  });
  return { defs, body: `<g clip-path="url(#${id}c)">${body}</g>` };
}
const svg = (vb: string, w: number, h: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">${inner}</svg>\n`;

export function mark(mode: Mode = 'gradient', size = 200) {
  const m = markBody(mode, 'm');
  return svg('20 20 160 160', size, size, `<defs>${m.defs}</defs>${m.body}`);
}
export function icon(bg: string) {
  const m = markBody('gradient', 'i');
  return svg('0 0 200 200', 1024, 1024, `<defs>${m.defs}</defs><rect width="200" height="200" fill="${bg}"/><g transform="translate(100 100) scale(.72) translate(-100 -100)">${m.body}</g>`);
}
// Lockup: mark, then CARD in ink and MAXX in an indigo-to-orchid gradient.
export function lockup(text: string, mode: Mode = 'gradient') {
  const s = 6; // cap height 14 * 6 = 84
  const card = wordPath('CARD', s);
  const maxx = wordPath('MAXX', s);
  const gap = 1.5 * s * 2.2;
  const m = markBody(mode, 'w');
  const top = (120 - CAP * s) / 2;
  const x0 = 118;
  const W = Math.ceil(x0 + card.width + gap + maxx.width + 8);
  const maxxFill = typeof mode === 'object' ? mode.mono : 'url(#wg)';
  return svg(`0 0 ${W} 120`, W, 120, `<defs>${m.defs}<linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.indigo}"/><stop offset=".6" stop-color="${palette.violet}"/><stop offset="1" stop-color="${palette.orchid}"/></linearGradient></defs>
<g transform="translate(0 0) scale(.6) translate(0 0)"><g transform="translate(-20 -20)">${m.body}</g></g>
<path transform="translate(${x0} ${top})" fill-rule="evenodd" d="${card.d}" fill="${text}"/>
<path transform="translate(${x0 + card.width + gap} ${top})" fill-rule="evenodd" d="${maxx.d}" fill="${maxxFill}"/>`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files: Record<string, string> = {
    'cardmaxx-mark.svg': mark(),
    'cardmaxx-mark-flat.svg': mark('flat'),
    'cardmaxx-mark-white.svg': mark({ mono: '#ffffff' }),
    'cardmaxx-mark-ink.svg': mark({ mono: palette.ink }),
    'cardmaxx-icon.svg': icon(palette.mist),
    'cardmaxx-icon-dark.svg': icon(palette.ink),
    'cardmaxx-wordmark.svg': lockup(palette.ink),
    'cardmaxx-wordmark-white.svg': lockup('#ffffff'),
  };
  for (const [name, content] of Object.entries(files)) writeFileSync(out + name, content);
  console.log('wrote', Object.keys(files).join(', '));
}
