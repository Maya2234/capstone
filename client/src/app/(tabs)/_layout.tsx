import { router, usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { House, LifeBuoy, ReceiptText, Settings, WalletCards, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, useWide } from '@/theme/theme';
import { MAX_WIDTH, radius, space } from '@/theme/tokens';
import { Wordmark } from '@/ui/Logo';
import { Text } from '@/ui/Text';

const TABS: { href: '/' | '/wallet' | '/activity' | '/help'; name: string; label: string; icon: LucideIcon }[] = [
  { href: '/', name: 'index', label: 'Home', icon: House },
  { href: '/wallet', name: 'wallet', label: 'Wallet', icon: WalletCards },
  { href: '/activity', name: 'activity', label: 'Activity', icon: ReceiptText },
  { href: '/help', name: 'help', label: 'Help', icon: LifeBuoy },
];

export default function TabsLayout() {
  const t = useTheme();
  const wide = useWide();
  return (
    <Tabs style={{ flex: 1, backgroundColor: t.bg }}>
      {wide ? <DesktopHeader /> : <MobileHeader />}
      <TabSlot style={{ flex: 1 }} />
      {!wide && <BottomBar />}
      {/* Route list for the tab navigator; the visible navigation is drawn above. */}
      <TabList style={{ display: 'none' }}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} />
        ))}
        <TabTrigger name="settings" href="/settings" />
      </TabList>
    </Tabs>
  );
}

function useActive() {
  const path = usePathname();
  return (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
}

function SettingsButton() {
  const t = useTheme();
  const isActive = useActive()('/settings');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      accessibilityState={{ selected: isActive }}
      onPress={() => router.navigate('/settings')}
      hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.gear,
        { backgroundColor: isActive ? t.primarySoft : pressed || hovered ? t.surfacePressed : t.surface, borderColor: isActive ? 'transparent' : t.border },
      ]}>
      <Settings size={20} color={isActive ? t.primarySoftText : t.text} strokeWidth={2} />
    </Pressable>
  );
}

function DesktopHeader() {
  const t = useTheme();
  const isActive = useActive();
  return (
    <View style={[styles.desktopBar, { backgroundColor: t.bg, borderBottomColor: t.border }]}>
      <View style={styles.desktopInner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <SettingsButton />
          <Pressable accessibilityRole="link" accessibilityLabel="CardMaxx home" onPress={() => router.navigate('/')}>
            <Wordmark height={30} />
          </Pressable>
        </View>
        <View accessibilityRole="tablist" style={[styles.pillGroup, { backgroundColor: t.surface, borderColor: t.border }]}>
          {TABS.map((tab) => {
            const on = isActive(tab.href);
            return (
              <Pressable
                key={tab.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => router.navigate(tab.href)}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.pill,
                  { backgroundColor: on ? t.primary : pressed || hovered ? t.surfaceAlt : 'transparent' },
                ]}>
                <tab.icon size={17} color={on ? t.onPrimary : t.textMuted} strokeWidth={2.2} />
                <Text variant="smallStrong" style={{ color: on ? t.onPrimary : t.textMuted, fontSize: 14 }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function MobileHeader() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.mobileBar, { paddingTop: insets.top + 8, backgroundColor: t.bg }]}>
      <SettingsButton />
      <Wordmark height={26} />
      <View style={{ width: 40 }} />
    </View>
  );
}

function BottomBar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const isActive = useActive();
  return (
    <View pointerEvents="box-none" style={[styles.bottomWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View accessibilityRole="tablist" style={[styles.bottomBar, { backgroundColor: t.surface, borderColor: t.border, boxShadow: t.shadowLg }]}>
        {TABS.map((tab) => {
          const on = isActive(tab.href);
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              onPress={() => router.navigate(tab.href)}
              style={styles.bottomItem}>
              <View style={[styles.bottomIcon, on && { backgroundColor: t.primarySoft }]}>
                <tab.icon size={21} color={on ? t.primarySoftText : t.textSubtle} strokeWidth={on ? 2.4 : 2} />
              </View>
              <Text variant="smallStrong" style={{ fontSize: 11, lineHeight: 14, color: on ? t.text : t.textSubtle }}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gear: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  desktopBar: { borderBottomWidth: 1, paddingHorizontal: space.xxl, paddingVertical: space.md },
  desktopInner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pillGroup: { flexDirection: 'row', gap: 4, padding: 5, borderRadius: radius.pill, borderWidth: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 40, borderRadius: radius.pill },
  mobileBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: 8 },
  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: space.lg },
  bottomBar: { flexDirection: 'row', width: '100%', maxWidth: 520, borderRadius: 30, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 6 },
  bottomItem: { flex: 1, alignItems: 'center', gap: 2 },
  bottomIcon: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
