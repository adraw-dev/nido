import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { inkOn, radius, space } from '../tokens';
import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Color de la línea que representa (persona o tronco). */
  color?: string;
  disabled?: boolean;
  /** 'radio' para elegir uno; 'checkbox' para varios. */
  role?: 'radio' | 'checkbox';
  compact?: boolean;
};

/** Ficha de selección con forma de placa de línea. */
export function Chip({ label, selected, onPress, color, disabled, role = 'radio', compact }: ChipProps) {
  const { colors } = useTheme();
  const fill = color ?? colors.ink;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={compact ? 6 : 0}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.compact,
        {
          backgroundColor: selected ? fill : colors.surface,
          borderColor: selected ? fill : colors.rule,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {!selected && color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text variant="label" color={selected ? inkOn(fill) : colors.ink} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
  compact: {
    minHeight: 40,
    minWidth: 40,
    paddingHorizontal: space.sm,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
