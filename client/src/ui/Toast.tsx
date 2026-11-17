import { CircleCheck, CircleAlert } from 'lucide-react-native';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, useWide } from '@/theme/theme';
import { radius } from '@/theme/tokens';

import { Text } from './Text';

type Toast = { id: number; message: string; tone: 'success' | 'error' };
const Ctx = createContext<(message: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && <ToastView key={toast.id} toast={toast} />}
    </Ctx.Provider>
  );
}

function ToastView({ toast }: { toast: Toast }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const Icon = toast.tone === 'success' ? CircleCheck : CircleAlert;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + (wide ? 32 : 96), alignItems: 'center' }}>
      <Animated.View
        entering={FadeInDown.springify().damping(18)}
        exiting={FadeOutDown}
        accessibilityLiveRegion="polite"
        role="status"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.scheme === 'dark' ? '#F4F2FB' : '#1A1640', paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.pill, boxShadow: t.shadowLg, maxWidth: 420, marginHorizontal: 16 }}>
        <Icon size={18} color={toast.tone === 'success' ? '#5BD3A0' : '#FF8197'} />
        <Text variant="smallStrong" style={{ color: t.scheme === 'dark' ? '#1A1640' : '#FFFFFF' }}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
}

export const useToast = () => useContext(Ctx);
