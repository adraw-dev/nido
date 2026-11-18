import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { diffDays, fromKey, toKey, todayKey, type DateKey } from '@/lib/dates';

import { useTheme } from '../theme';
import { fonts, radius, space, touchTarget } from '../tokens';
import { Text } from './Text';

export type DateFieldProps = {
  label: string;
  value: DateKey | null;
  onChange: (value: DateKey | null) => void;
  /** Texto cuando no hay fecha. */
  placeholder?: string;
  hint?: string;
  error?: string | null;
  /** Fecha con la que abre el calendario si no hay valor (por defecto, hoy). */
  defaultDate?: DateKey;
  minimumDate?: DateKey;
  maximumDate?: DateKey;
  /** Muestra la ✕ para dejarla sin fecha. */
  clearable?: boolean;
  clearLabel?: string;
};

const KEY = /^\d{4}-\d{2}-\d{2}$/;

/** "Hoy · martes 18 de noviembre" · "viernes 5 de diciembre de 2027" */
export function longDay(key: DateKey, today: DateKey = todayKey()): string {
  const date = fromKey(key);
  const sameYear = date.getFullYear() === fromKey(today).getFullYear();
  const full = format(date, sameYear ? "EEEE d 'de' MMMM" : "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  const d = diffDays(key, today);
  const near = d === 0 ? 'Hoy' : d === -1 ? 'Ayer' : d === 1 ? 'Mañana' : null;
  return near ? `${near} · ${full}` : full.charAt(0).toUpperCase() + full.slice(1);
}

/**
 * Campo de fecha: abre el calendario nativo (Android) en vez de elegir entre
 * botones. En iOS muestra el calendario debajo; en web, un campo AAAA-MM-DD.
 */
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Sin fecha',
  hint,
  error,
  defaultDate,
  minimumDate,
  maximumDate,
  clearable = false,
  clearLabel = 'Quitar la fecha',
}: DateFieldProps) {
  const { colors, scheme } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [webText, setWebText] = useState(value ?? '');
  const today = todayKey();
  const shown = value ? longDay(value, today) : null;
  const current = fromKey(value ?? defaultDate ?? today);
  const min = minimumDate ? fromKey(minimumDate) : undefined;
  const max = maximumDate ? fromKey(maximumDate) : undefined;

  const set = (date?: Date) => {
    if (date) onChange(toKey(date));
  };

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        title: label,
        positiveButton: { label: 'Listo' },
        negativeButton: { label: 'Cancelar' },
        onValueChange: (_e, date) => set(date),
      });
    } else {
      setIosOpen((o) => !o);
    }
  }

  const footer = error ? (
    <Text variant="caption" tone="danger">
      {error}
    </Text>
  ) : hint ? (
    <Text variant="caption" tone="subtle">
      {hint}
    </Text>
  ) : null;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        <TextInput
          accessibilityLabel={label}
          value={webText}
          onChangeText={(t) => {
            setWebText(t);
            if (!t && clearable) onChange(null);
            else if (KEY.test(t) && toKey(fromKey(t)) === t) onChange(t);
          }}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={colors.inkSubtle}
          maxLength={10}
          style={[styles.field, styles.webInput, { color: colors.ink, borderColor: colors.rule, backgroundColor: colors.surface }]}
        />
        {footer}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View
        style={[styles.field, { borderColor: error ? colors.danger : colors.rule, backgroundColor: colors.surface }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown ?? placeholder}`}
          accessibilityHint="Abre el calendario para elegir la fecha"
          onPress={open}
          style={styles.main}
        >
          <MaterialCommunityIcons name="calendar-month-outline" size={20} color={shown ? colors.ink : colors.inkSubtle} />
          <Text variant="body" tone={shown ? 'default' : 'subtle'} style={styles.value} numberOfLines={1}>
            {shown ?? placeholder}
          </Text>
        </Pressable>
        {clearable && value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            onPress={() => {
              onChange(null);
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
          value={current}
          mode="date"
          display="inline"
          locale="es"
          minimumDate={min}
          maximumDate={max}
          themeVariant={scheme}
          onValueChange={(_e, date) => set(date)}
        />
      ) : null}
      {footer}
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
    flex: 1,
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
