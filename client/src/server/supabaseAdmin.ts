// Server only. Imported by API routes, never by screens: the secret key bypasses row level security.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/**
 * The signed-in user making this request, from the "Authorization: Bearer <access token>"
 * header the app sends. Returns a 401 Response when it's missing or no longer valid.
 */
export async function requireUser(request: Request): Promise<{ id: string } | Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) return Response.json({ error: 'Your session ended. Sign in again.' }, { status: 401 });
  return { id: data.user.id };
}
