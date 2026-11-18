// POST /api/plaid/exchange { public_token } — finishes a Plaid Link session.
// Trades the one-time public token for a long-lived access token, saves it encrypted,
// pulls its first transactions, and returns the new bank's accounts. The access token never leaves the server.

import { accountsForItem, errorResponse, plaid, saveItem, syncTransactions } from '@/server/plaid';
import { rateLimit } from '@/server/rateLimit';
import { requireUser } from '@/server/supabaseAdmin';

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const limited = rateLimit('plaid/exchange:' + user.id, 10, 10 * 60_000);
  if (limited) return limited;

  let publicToken = '';
  try {
    publicToken = String((await request.json()).public_token ?? '');
  } catch {}
  if (!publicToken) return Response.json({ error: 'Missing public_token.' }, { status: 400 });

  try {
    const { access_token, item_id } = await plaid<{ access_token: string; item_id: string }>('/item/public_token/exchange', {
      public_token: publicToken,
    });

    let row;
    try {
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
      row = await saveItem(user.id, item_id, access_token, inst);
    } catch (e) {
      // The token was never saved, so nothing could ever revoke it later: revoke it now.
      await plaid('/item/remove', { access_token }).catch((err) => console.warn('[plaid] revoke unsaved item:', err instanceof Error ? err.message : err));
      throw e;
    }
    const inst = { name: row.institution_name ?? 'Your bank' };
    const accounts = await accountsForItem(row);
    // First pull of transactions. Plaid is often still gathering history at this point;
    // whatever isn't ready yet comes in on the next refresh, so a failure here isn't fatal.
    await syncTransactions(user.id, row).catch((e) => console.warn('[plaid] first sync:', e instanceof Error ? e.message : e));
    return Response.json({ institution: inst.name, accounts });
  } catch (e) {
    return errorResponse(e);
  }
}
