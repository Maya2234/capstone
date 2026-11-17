// POST /api/plaid/exchange { public_token } — finishes a Plaid Link session.
// Trades the one-time public token for a long-lived access token, saves it encrypted,
// and returns the new bank's accounts. The access token never leaves the server.

import { accountsForItem, errorResponse, plaid, saveItem } from '@/server/plaid';
import { requireUser } from '@/server/supabaseAdmin';

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let publicToken = '';
  try {
    publicToken = String((await request.json()).public_token ?? '');
  } catch {}
  if (!publicToken) return Response.json({ error: 'Missing public_token.' }, { status: 400 });

  try {
    const { access_token, item_id } = await plaid<{ access_token: string; item_id: string }>('/item/public_token/exchange', {
      public_token: publicToken,
    });

    // Which bank this is, from Plaid itself (not from anything the app sent).
    const { item } = await plaid<{ item: { institution_id?: string | null } }>('/item/get', { access_token });
    let inst = { id: item.institution_id ?? 'unknown', name: 'Your bank' };
    if (item.institution_id) {
      const { institution } = await plaid<{ institution: { name: string } }>('/institutions/get_by_id', {
        institution_id: item.institution_id,
        country_codes: ['US'],
      });
      inst = { id: item.institution_id, name: institution.name };
    }

    const row = await saveItem(user.id, item_id, access_token, inst);
    const accounts = await accountsForItem(row);
    return Response.json({ institution: inst.name, accounts });
  } catch (e) {
    return errorResponse(e);
  }
}
