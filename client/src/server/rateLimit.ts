// Server only. A simple in-memory rate limit: at most `max` calls per `windowMs` for one key
// (usually route + user id). It resets when the server restarts and isn't shared between
// server instances, which is fine for one Node server; a bigger deployment would move this
// to a shared store (for example Redis or a Supabase table).

const hits = new Map<string, number[]>();

/** Returns a 429 Response when `key` is over its limit, otherwise null (and counts this call). */
export function rateLimit(key: string, max: number, windowMs: number): Response | null {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    const retry = Math.ceil((windowMs - (now - recent[0])) / 1000);
    return Response.json({ error: 'Too many tries. Wait a few minutes and try again.' }, { status: 429, headers: { 'Retry-After': String(retry) } });
  }
  recent.push(now);
  hits.set(key, recent);
  return null;
}
