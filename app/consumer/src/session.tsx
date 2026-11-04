import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, loadSession, setSignedOutHandler, signIn as apiSignIn, signOut as apiSignOut } from './api';

type Session = {
  ready: boolean;
  signedIn: boolean;
  email: string;
  signIn: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    setSignedOutHandler(() => setSignedIn(false));
    loadSession()
      .then(async (tok) => {
        if (!tok) return;
        const me = await api.me();
        setEmail(me.email);
        setSignedIn(true);
      })
      .catch(() => setSignedIn(false))
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (idToken: string) => {
    const r = await apiSignIn(idToken);
    setEmail(r.email);
    setSignedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut().catch(() => {});
    setSignedIn(false);
  }, []);

  return <Ctx.Provider value={{ ready, signedIn, email, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

/** Loads data, reloads on demand, and tracks errors. Changing `key` refetches. */
export function useLoad<T>(fn: () => Promise<T>, key = '') {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fnRef.current());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    fnRef.current().then(
      (d) => { if (alive) { setData(d); setError(null); setLoading(false); } },
      (e) => { if (alive) { setError(e); setLoading(false); } },
    );
    return () => { alive = false; };
  }, [key]);
  return { data, error, loading, reload, setData };
}
