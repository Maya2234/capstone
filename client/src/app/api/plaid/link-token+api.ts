// POST /api/plaid/link-token — starts a Plaid Link session for the signed-in user.

import { errorResponse, plaid } from '@/server/plaid';
import { rateLimit } from '@/server/rateLimit';
import { requireUser } from '@/server/supabaseAdmin';

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const limited = rateLimit('plaid/link-token:' + user.id, 10, 10 * 60_000);
  if (limited) return limited;
  try {
    const { link_token } = await plaid<{ link_token: string }>('/link/token/create', {
      client_name: 'CardMaxx',
      user: { client_user_id: user.id },
      products: ['transactions'],
      // Ask for 6 months of history on the first sync (Plaid's default is 90 days).
      transactions: { days_requested: 180 },
      country_codes: ['US'],
      language: 'en',
    });
    return Response.json({ link_token });
  } catch (e) {
    return errorResponse(e);
  }
}
