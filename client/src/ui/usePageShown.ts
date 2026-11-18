import { useEffect } from 'react';

import { useStore } from '@/data/store';

/**
 * Called by every signed-in page (Screen and Sheet do it). The first one to draw after signing
 * in takes down the loading screen that covered the gap since the sign-in form.
 */
export function usePageShown() {
  useEffect(() => {
    if (useStore.getState().enteringApp) useStore.getState().setEnteringApp(false);
  }, []);
}
