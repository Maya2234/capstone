// Sign-in for the demo. Every call here is a stand-in with the same shape the real backend
// will have (Google sign-in per the Technical Specification, email + password, reset links),
// so screens don't change when it's swapped for the real service.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function signInWithGoogle(): Promise<{ email: string; name: string }> {
  await wait(600);
  return { email: 'maya@example.com', name: 'Maya' };
}

export async function signInWithEmail(email: string, password: string): Promise<{ email: string }> {
  await wait(500);
  if (password.length < 8) throw new Error('Passwords are at least 8 characters.');
  return { email: email.trim().toLowerCase() };
}

export async function sendPasswordReset(email: string): Promise<void> {
  await wait(500);
  if (!email) throw new Error('Add your email first.');
}
