// Signs people out after a stretch with no activity, so a computer left open (or a browser
// closed without logging out) doesn't stay signed in to someone's finances.
// Activity is saved on the device, so other open tabs count, and a visit after a long gap
// starts signed out.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { signOut } from '@/services/auth';
import { useToast } from '@/ui/Toast';

export const IDLE_LIMIT_MS = 30 * 60_000;
const KEY = 'cardmaxx.lastActive';
const SAVE_EVERY_MS = 30_000;

export function useIdleSignOut(signedIn: boolean) {
  const toast = useToast();

  useEffect(() => {
    if (!signedIn) return;
    let last = Date.now();
    let saved = 0;
    let stopped = false;

    const save = () => {
      saved = last;
      AsyncStorage.setItem(KEY, String(last)).catch(() => {});
    };
    const touch = () => {
      last = Date.now();
      if (last - saved > SAVE_EVERY_MS) save();
    };
    const check = async () => {
      if (stopped) return;
      const stored = Number((await AsyncStorage.getItem(KEY).catch(() => null)) ?? 0);
      const newest = Math.max(last, stored); // another tab may have been in use
      if (Date.now() - newest < IDLE_LIMIT_MS) return;
      stopped = true;
      await AsyncStorage.removeItem(KEY).catch(() => {});
      await signOut();
      toast('Signed out after 30 minutes without activity');
    };

    // A visit after a long gap: check the saved time before counting this visit as activity.
    void check().then(() => {
      if (!stopped) save();
    });

    // Web: every click, key or scroll counts, checked each minute. Phones: taps aren't visible
    // app-wide, so the app counts as active while it's open and only time in the background is
    // idle (checked when it comes back).
    const timer = Platform.OS === 'web' ? setInterval(check, 60_000) : undefined;
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    if (Platform.OS === 'web') for (const e of events) window.addEventListener(e, touch, { passive: true });
    const sub = AppState.addEventListener('change', (s) => {
      if (Platform.OS === 'web') return;
      if (s === 'active') {
        void check().then(() => {
          if (stopped) return;
          last = Date.now();
          save();
        });
      }
      else {
        last = Date.now();
        save();
      }
    });

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (Platform.OS === 'web') for (const e of events) window.removeEventListener(e, touch);
      sub.remove();
    };
  }, [signedIn, toast]);
}
