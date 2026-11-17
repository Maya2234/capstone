// Plaid Link on the website, through Plaid's own React library.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

import { createLinkToken } from './plaid';
import type { PlaidConnect } from './plaidLink';

export function usePlaidConnect(onSuccess: (publicToken: string) => void, onError: (message: string) => void): PlaidConnect {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false); // open as soon as Plaid is ready

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken) => {
      setLoading(false);
      if (publicToken) onSuccess(publicToken);
      else onError('The bank connection didn’t finish.');
    },
    onExit: (err) => {
      setLoading(false);
      if (err) onError(err.display_message || 'The bank connection didn’t finish.');
    },
  });

  useEffect(() => {
    if (pending.current && ready) {
      pending.current = false;
      open();
    }
  }, [ready, open]);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      // Link tokens expire after a few hours, so get a fresh one each time.
      pending.current = true;
      setToken(await createLinkToken());
    } catch (e) {
      pending.current = false;
      setLoading(false);
      onError(e instanceof Error ? e.message : 'Couldn’t start Plaid.');
    }
  }, [onError]);

  return { available: true, start, loading };
}
