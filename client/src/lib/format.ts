const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Cents to "$1,234.56". `whole` drops the cents. */
export function money(cents: number, opts: { whole?: boolean; sign?: boolean } = {}) {
  const s = (opts.whole ? usd0 : usd).format(Math.abs(cents) / 100);
  if (cents < 0) return '−' + s;
  return opts.sign && cents > 0 ? '+' + s : s;
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

/** 3 -> "3x" for points, "3%" for cash back. */
export function rate(r: number, cash: boolean) {
  const n = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return cash ? `${n}%` : `${n}x`;
}

const day = 24 * 60 * 60 * 1000;
export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / day);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: diff < 7 ? 'long' : undefined, month: 'short', day: 'numeric' });
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function monthName(d = new Date()) {
  return d.toLocaleDateString('en-US', { month: 'long' });
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
