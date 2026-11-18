// POST /api/plaid/refresh — for every bank the signed-in user has linked: fetch new and
// changed transactions into the transactions table, and return fresh account balances.

import { accountsForItem, errorResponse, itemsFor, syncTransactions } from '@/server/plaid';
import { rateLimit } from '@/server/rateLimit';
import { requireUser } from '@/server/supabaseAdmin';

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const limited = rateLimit('plaid/refresh:' + user.id, 30, 10 * 60_000);
  if (limited) return limited;
  try {
    const items = await itemsFor(user.id);
    const results = await Promise.allSettled(
      items.map(async (row) => {
        const [accounts] = await Promise.all([accountsForItem(row), syncTransactions(user.id, row)]);
        return accounts;
      }),
    );
    // One bank needing attention (expired login, outage) shouldn't hide the others.
    const accounts = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    const failed = items.filter((_, i) => results[i].status === 'rejected').map((r) => r.institution_name ?? 'A bank');
    for (const r of results) if (r.status === 'rejected') console.warn('[plaid] refresh:', r.reason instanceof Error ? r.reason.message : r.reason);
    return Response.json({ accounts, failed });
  } catch (e) {
    return errorResponse(e);
  }
}
