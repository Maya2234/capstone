import React, { useState } from 'react';
import { Linking, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { api } from './api';
import { useTheme } from './ui';

export function Screen({ children, onRefresh }: { children: React.ReactNode; onRefresh?: () => Promise<void> }) {
  const t = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={onRefresh ? (
        <RefreshControl refreshing={refreshing} tintColor={t.text}
          onRefresh={async () => { setRefreshing(true); await onRefresh().finally(() => setRefreshing(false)); }} />
      ) : undefined}
    >
      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}>{children}</View>
    </ScrollView>
  );
}

/**
 * Opens Plaid Link (the sandbox stand-in served by the API) to link a bank or
 * card (REQ-06). Resolves when linking finishes on web; on native the consumer
 * returns to the app and pulls to refresh.
 */
export async function linkAccount(): Promise<void> {
  const { linkUrl } = await api.linkToken();
  if (Platform.OS !== 'web') {
    await Linking.openURL(linkUrl);
    return;
  }
  const popup = window.open(linkUrl, 'plaid_link', 'width=440,height=720');
  if (!popup) {
    window.location.href = linkUrl;
    return;
  }
  await new Promise<void>((resolve) => {
    const done = () => { window.removeEventListener('message', onMsg); clearInterval(timer); resolve(); };
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'cardstack:linked') done(); };
    const timer = setInterval(() => { if (popup.closed) done(); }, 500);
    window.addEventListener('message', onMsg);
  });
}
