// Sign-in through Supabase Auth. Screens call these; the signed-in session reaches the
// store through the auth listener in src/data/sync.ts, not through return values.

import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Where email links (confirm, reset) send people back to. Must be in Supabase's Redirect URLs. */
function redirectTo(path = '') {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin + path;
  return 'cardmaxx://' + path.replace(/^\//, '');
}

/**
 * Supabase gives the same error for an unknown email and a wrong password, on purpose,
 * so nobody can use sign-in to test which emails have accounts. Keep it that way.
 */
export const NO_MATCH = 'No account found with that email, or the password is wrong.';

/** Turn Supabase's error text into something a person can act on. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return NO_MATCH;
  if (m.includes('email not confirmed')) return 'Confirm your email first. Check your inbox for the link.';
  if (m.includes('already registered')) return 'There’s already an account with that email. Sign in instead.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Too many tries. Wait a minute and try again.';
  if (m.includes('password')) return message;
  return 'Something went wrong. Try again.';
}

export async function signInWithGoogle(): Promise<void> {
  // Comes next: needs a Google Cloud OAuth client added under Authentication > Providers.
  throw new Error('Google sign-in isn’t set up yet. Use email for now.');
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(friendly(error.message));
}

/** Returns true when Supabase wants the email confirmed before the first sign-in. */
export async function signUpWithEmail(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name.trim() }, emailRedirectTo: redirectTo() },
  });
  if (error) throw new Error(friendly(error.message));
  return { needsConfirmation: !data.session };
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!email) throw new Error('Add your email first.');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: redirectTo('/new-password') });
  if (error) throw new Error(friendly(error.message));
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendly(error.message));
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// Two-factor login (TOTP: 6-digit codes from an authenticator app) ---------------------------
// Supabase tracks how strongly a session was signed in: aal1 = password only, aal2 = password
// plus a code. Once someone has a verified authenticator, the database and our API routes only
// accept aal2 sessions from them (supabase/005_require_two_factor.sql).

/** True when this session signed in with a password but still owes a 6-digit code. */
export async function needsCode(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(friendly(error.message));
  return data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
}

/** The user's working authenticator, if they've set one up. */
export async function verifiedFactor(): Promise<{ id: string } | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(friendly(error.message));
  return data.totp.find((f) => f.status === 'verified') ?? null;
}

/** Step 1 of setup: a new authenticator to scan. Clears any half-finished earlier attempt first. */
export async function startTwoFactorSetup(): Promise<{ factorId: string; qrSvg: string; secret: string }> {
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'CardMaxx' });
  if (error) throw new Error(friendly(error.message));
  // qr_code is an SVG data URL; the raw SVG renders the same on web and phones.
  const raw = data.totp.qr_code;
  const svg = raw.startsWith('data:') ? decodeURIComponent(raw.slice(raw.indexOf(',') + 1)) : raw;
  return { factorId: data.id, qrSvg: svg, secret: data.totp.secret };
}

/** Checks a 6-digit code against an authenticator. Finishes setup, or the sign-in code step. */
export async function verifyCode(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) throw new Error(/invalid|expired|code/i.test(error.message) ? 'That code didn’t work. Check your app and try the newest one.' : friendly(error.message));
}

/** Turns two-factor off. Supabase only allows this from a session that entered a code. */
export async function removeTwoFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(friendly(error.message));
}
