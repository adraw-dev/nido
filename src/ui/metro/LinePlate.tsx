import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '../primitives/Text';
import { inkOn, radius, space } from '../tokens';

export type LinePlateProps = {
  label: string;
  color: string;
  style?: StyleProp<ViewStyle>;
};

/** Placa de línea: nombre en mayúsculas sobre el color de la línea. */
export function LinePlate({ label, color, style }: LinePlateProps) {
  return (
    <View style={[styles.plate, { backgroundColor: color }, style]}>
      <Text variant="plate" color={inkOn(color)} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.sm - 3,
  },
});
