// POST /api/plaid/link-token — starts a Plaid Link session for the signed-in user.

import { errorResponse, plaid } from '@/server/plaid';
import { requireUser } from '@/server/supabaseAdmin';

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  try {
    const { link_token } = await plaid<{ link_token: string }>('/link/token/create', {
      client_name: 'CardMaxx',
      user: { client_user_id: user.id },
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    return Response.json({ link_token });
  } catch (e) {
    return errorResponse(e);
  }
}
