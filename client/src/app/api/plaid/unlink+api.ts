// POST /api/plaid/unlink { institutionId } — disconnect a bank linked through Plaid.
// Revokes CardMaxx's access at Plaid (/item/remove), deletes the saved token and the
// bank's transactions. The app deletes the account and card rows itself.

import { errorResponse, itemsFor, removeItem } from '@/server/plaid';
import { rateLimit } from '@/server/rateLimit';
import { requireUser } from '@/server/supabaseAdmin';

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const limited = rateLimit('plaid/unlink:' + user.id, 10, 10 * 60_000);
  if (limited) return limited;

  let institutionId = '';
  try {
    institutionId = String((await request.json()).institutionId ?? '').replace(/^plaid_/, '');
  } catch {}
  if (!institutionId) return Response.json({ error: 'Missing institutionId.' }, { status: 400 });

  try {
    const items = (await itemsFor(user.id)).filter((r) => (r.institution_id ?? 'unknown') === institutionId);
    for (const row of items) await removeItem(user.id, row);
    return Response.json({ removed: items.length });
  } catch (e) {
    return errorResponse(e);
  }
}
