// GET /api/plaid/accounts — fresh balances for every bank the signed-in user has linked through Plaid.

import { accountsForItem, errorResponse } from '@/server/plaid';
import { admin, requireUser } from '@/server/supabaseAdmin';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  try {
    const { data, error } = await admin()
      .from('plaid_items')
      .select('access_token_enc, institution_id, institution_name, created_at')
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    const accounts = (await Promise.all((data ?? []).map(accountsForItem))).flat();
    return Response.json({ accounts });
  } catch (e) {
    return errorResponse(e);
  }
}
