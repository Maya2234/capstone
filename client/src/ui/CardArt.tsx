import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { cardGradient, shortName, type Product } from '@/data/catalog';
import { radius } from '@/theme/tokens';

import { Text } from './Text';

/** Credit card picture: issuer gradient, a soft quarter-circle motif from the logo, name and last four. */
export function CardArt({ product, mask, nickname, width = 300, dim }: { product: Product; mask: string; nickname?: string; width?: number; dim?: boolean }) {
  const [a, b] = cardGradient(product.issuer);
  const h = Math.round(width * 0.63);
  const s = width / 300;
  return (
    <View
      accessibilityLabel={`${product.name} ending in ${mask}`}
      style={{ width, height: h, borderRadius: radius.lg * s, overflow: 'hidden', opacity: dim ? 0.55 : 1, boxShadow: '0px 12px 28px rgba(26,22,64,0.22)' }}>
      <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={h} viewBox="0 0 300 189" style={StyleSheet.absoluteFill}>
        <Path d="M300 0 L210 0 A90 90 0 0 0 300 90 Z" fill="#FFFFFF" opacity={0.13} />
        <Path d="M300 189 L300 110 A79 79 0 0 0 221 189 Z" fill="#FFFFFF" opacity={0.09} />
      </Svg>
      <View style={{ flex: 1, padding: 18 * s, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text variant="smallStrong" tone="inverse" style={{ opacity: 0.85, fontSize: 12 * s }}>{product.issuer}</Text>
          <Text variant="smallStrong" tone="inverse" style={{ fontSize: 12 * s, letterSpacing: 0.5 }}>{product.network.toUpperCase()}</Text>
        </View>
        <View>
          <Text variant="h3" tone="inverse" numberOfLines={1} style={{ fontSize: 16 * s, lineHeight: 21 * s }}>{nickname || shortName(product)}</Text>
          <Text variant="small" tone="inverse" style={{ opacity: 0.85, fontSize: 13 * s, letterSpacing: 1.5 }}>•••• {mask}</Text>
        </View>
      </View>
    </View>
  );
}
