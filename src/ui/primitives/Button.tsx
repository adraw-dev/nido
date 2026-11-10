import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { useTheme } from '../theme';
import { radius, space, touchTarget } from '../tokens';
import { Text } from './Text';

export type ButtonVariant = 'filled' | 'tonal' | 'outline' | 'text';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** Color de relleno para 'filled' (por defecto, el tronco azul). */
  color?: string;
};

export function Button({
  label,
  variant = 'filled',
  loading = false,
  disabled,
  color,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const fill = color ?? colors.trunk;

  const container = {
    filled: { backgroundColor: fill, borderColor: fill },
    tonal: { backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceMuted },
    outline: { backgroundColor: 'transparent', borderColor: colors.rule },
    text: { backgroundColor: 'transparent', borderColor: 'transparent' },
  }[variant];

  const labelColor = variant === 'filled' ? '#FFFFFF' : variant === 'text' ? colors.trunk : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={(e) => {
        if (variant === 'filled') Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        container,
        variant === 'text' && styles.textVariant,
        { opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={labelColor} /> : null}
        <Text variant="label" color={labelColor} style={styles.label}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textVariant: {
    paddingHorizontal: space.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  label: {
    fontSize: 15,
  },
});
