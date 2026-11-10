import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space, touchTarget } from '../tokens';
import { Text } from './Text';

export type Segment<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.wrap, { borderColor: colors.rule, backgroundColor: colors.surface }]}>
      {segments.map((s, i) => {
        const selected = s.value === value;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(s.value);
            }}
            style={[
              styles.segment,
              i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.rule },
              selected && { backgroundColor: colors.indicator },
            ]}
          >
            <Text variant="label" color={selected ? colors.ink : colors.inkMuted}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: touchTarget - 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
});
