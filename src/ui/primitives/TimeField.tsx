import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { formatTime } from '@/lib/dates';

import { useTheme } from '../theme';
import { fonts, radius, space, touchTarget } from '../tokens';
import { Text } from './Text';

export type TimeFieldProps = {
  label: string;
  /** 'HH:MM' (24 h) o '' sin hora. */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  /** Hora con la que abre el reloj si no hay valor. */
  defaultTime?: string;
};

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(value: string, fallback: string): Date {
  const [h, m] = (value || fallback).split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isNaN(h) ? 8 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return d;
}

/**
 * Campo de hora: abre el reloj nativo (Android) en vez de escribir a mano.
 * En iOS muestra el selector debajo; en web, un campo de texto HH:MM.
 */
export function TimeField({ label, value, onChange, hint, placeholder = 'Sin hora', defaultTime = '08:00' }: TimeFieldProps) {
  const { colors, scheme } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const shown = value ? formatTime(value) : null;

  const set = (date?: Date) => {
    if (date) onChange(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
  };

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value, defaultTime),
        mode: 'time',
        is24Hour: false,
        title: label,
        positiveButton: { label: 'Listo' },
        negativeButton: { label: 'Cancelar' },
        onValueChange: (_e, date) => set(date),
      });
    } else {
      setIosOpen((o) => !o);
    }
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          placeholder="HH:MM"
          placeholderTextColor={colors.inkSubtle}
          maxLength={5}
          style={[styles.field, styles.webInput, { color: colors.ink, borderColor: colors.rule, backgroundColor: colors.surface }]}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View style={[styles.field, { borderColor: colors.rule, backgroundColor: colors.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown ?? placeholder}`}
          accessibilityHint="Abre el reloj para elegir la hora"
          onPress={open}
          style={styles.main}
        >
          <MaterialCommunityIcons name="clock-outline" size={20} color={shown ? colors.ink : colors.inkSubtle} />
          <Text variant="body" tone={shown ? 'default' : 'subtle'} style={styles.value}>
            {shown ?? placeholder}
          </Text>
        </Pressable>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar la hora"
            onPress={() => {
              onChange('');
              setIosOpen(false);
            }}
            hitSlop={6}
            style={styles.clear}
          >
            <MaterialCommunityIcons name="close-circle" size={20} color={colors.inkSubtle} />
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === 'ios' && iosOpen ? (
        <DateTimePicker
          value={toDate(value, defaultTime)}
          mode="time"
          display="spinner"
          themeVariant={scheme}
          onValueChange={(_e, date) => set(date)}
        />
      ) : null}
      {hint ? (
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
  field: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  main: {
    flex: 1,
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
  clear: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webInput: {
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 16,
  },
});
