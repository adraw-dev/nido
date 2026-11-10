import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { radius, space } from '../tokens';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Botón de acción flotante de Material 3, en el azul del tronco. */
export function Fab({
  label,
  onPress,
  icon = 'plus',
  expanded,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** Para un menú desplegable: indica si está abierto. */
  expanded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: colors.trunk, transform: [{ scale: pressed ? 0.96 : 1 }] },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={28} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
