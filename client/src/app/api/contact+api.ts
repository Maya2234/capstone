// POST /api/contact — sends the Help form to the support inbox through Resend.
// Needs RESEND_API_KEY, CONTACT_TO_EMAIL and CONTACT_FROM_EMAIL in client/.env (see .env.example).

const MAX = { name: 100, email: 200, topic: 60, message: 4000 };
const recent = new Map<string, number[]>(); // simple per-address rate limit: 5 per 10 minutes

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const field = (k: keyof typeof MAX) => String(body[k] ?? '').trim().slice(0, MAX[k]);
  const name = field('name');
  const email = field('email');
  const topic = field('topic') || 'General';
  const message = field('message');

  // Hidden form field that people never fill in; bots usually do.
  if (body.website) return Response.json({ ok: true });
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Please add your name, a valid email and a message.' }, { status: 400 });
  }

  const now = Date.now();
  const hits = (recent.get(email) ?? []).filter((t) => now - t < 10 * 60_000);
  if (hits.length >= 5) return Response.json({ error: 'Too many messages. Please try again later.' }, { status: 429 });
  recent.set(email, [...hits, now]);

  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL ?? 'CardMaxx Support <onboarding@resend.dev>';
  if (!key || !to) {
    console.warn('[contact] RESEND_API_KEY or CONTACT_TO_EMAIL is not set; message not sent.');
    return Response.json({ error: 'Messages aren’t set up yet. Please try again later.' }, { status: 503 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `[CardMaxx] ${topic} — ${name}`,
      text: `From: ${name} <${email}>\nTopic: ${topic}\n\n${message}`,
    }),
  });
  if (!res.ok) {
    console.error('[contact] Resend error', res.status, await res.text());
    return Response.json({ error: 'We couldn’t send that. Please try again.' }, { status: 502 });
  }
  return Response.json({ ok: true });
}
