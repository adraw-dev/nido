import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { useTheme } from '../theme';
import { fonts, radius, space } from '../tokens';
import { Text } from './Text';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  ref?: Ref<TextInputInstance>;
};

export function TextField({ label, error, hint, style, onFocus, onBlur, ref, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.ink : colors.rule;

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.inkSubtle}
        selectionColor={colors.trunk}
        cursorColor={colors.trunk}
        maxFontSizeMultiplier={1.6}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor,
            borderWidth: focused || error ? 2 : 1.5,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.xs + 2,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
});
