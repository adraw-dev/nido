import { StyleSheet, View } from 'react-native';

import { inkOn } from '../tokens';
import { Text } from './Text';

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text variant="title" color={inkOn(color)} style={{ fontSize: size * 0.42, lineHeight: size * 0.52 }}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
