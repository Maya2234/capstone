import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Both values are public on purpose (EXPO_PUBLIC_): the publishable key only allows what
// the row level security policies in supabase/schema.sql allow.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
if (!url || !key) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY in client/.env');
}

// The web build also renders on the server, where there's no storage or user to keep signed in.
const onServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(url, key, {
  auth: {
    storage: onServer ? undefined : AsyncStorage,
    persistSession: !onServer,
    autoRefreshToken: !onServer,
    // On web, email confirmation and reset links come back with the session in the URL.
    detectSessionInUrl: Platform.OS === 'web' && !onServer,
  },
});

// On phones, only refresh the session while the app is open.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
