import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { z } from 'zod';

import { WEEKDAY_SHORT, type Weekday } from '@/lib/recurrence';
import { Button, Chip, Screen, Text, TextField, TimeField, radius, space, touchTarget, useTheme } from '@/ui';

import { type Habit, type HabitInput, type HabitPeriod } from '../types';

const nameSchema = z.string().trim().min(1, 'Ponle un nombre.').max(60, 'Máximo 60 caracteres.');
const ALL_DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export type HabitFormProps = {
  initial?: Habit;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: HabitInput) => void;
};

export function HabitForm({ initial, submitLabel, submitting, error, onSubmit }: HabitFormProps) {
  const { colors } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [period, setPeriod] = useState<HabitPeriod>(initial?.period ?? 'day');
  const [target, setTarget] = useState(initial?.target_count ?? 1);
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [days, setDays] = useState<Weekday[]>(initial?.weekdays?.length ? initial.weekdays : ALL_DAYS);
  const [shared, setShared] = useState(initial?.visibility === 'shared');
  const [reminder, setReminder] = useState(initial?.reminder_at?.slice(0, 5) ?? '');
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  function toggleDay(d: Weekday) {
    setDays((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      return next.length ? next.sort() : prev;
    });
  }

  function submit() {
    const parsed = nameSchema.safeParse(name);
    setNameError(parsed.success ? null : parsed.error.issues[0].message);
    const reminderOk = reminder.trim() === '' || TIME_RE.test(reminder.trim());
    setReminderError(reminderOk ? null : 'Usa el formato 24 h, por ejemplo 07:30.');
    if (!parsed.success || !reminderOk) return;
    const [rh, rm] = reminder.trim() ? reminder.trim().split(':') : [];
    onSubmit({
      name: parsed.data,
      period,
      target_count: target,
      unit: unit.trim() || null,
      weekdays: period === 'day' && days.length < 7 ? days : null,
      visibility: shared ? 'shared' : 'personal',
      reminder_at: rh ? `${rh.padStart(2, '0')}:${rm}` : null,
    });
  }

  const periodWord = { day: 'al día', week: 'a la semana', month: 'al mes' }[period];

  return (
    <Screen
      scroll
      edges={['bottom']}
      footer={
        <>
          {error ? (
            <Text tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button label={submitLabel} onPress={submit} loading={submitting} />
        </>
      }
    >
      <TextField
        label="Hábito"
        placeholder="Tomar agua"
        value={name}
        onChangeText={setName}
        error={nameError}
        maxLength={60}
        autoFocus={!initial}
        autoCapitalize="sentences"
      />

      <View style={styles.field}>
        <Text variant="label" tone="muted">
          Cada cuánto
        </Text>
        <View style={styles.wrapRow}>
          <Chip label="Al día" selected={period === 'day'} onPress={() => setPeriod('day')} />
          <Chip label="A la semana" selected={period === 'week'} onPress={() => setPeriod('week')} />
          <Chip label="Al mes" selected={period === 'month'} onPress={() => setPeriod('month')} />
        </View>
      </View>

      <View style={styles.field}>
        <Text variant="label" tone="muted">
          Meta
        </Text>
        <View style={styles.goalRow}>
          <View style={[styles.stepper, { borderColor: colors.rule, backgroundColor: colors.surface }]}>
            <StepButton icon="minus" label="Restar uno a la meta" disabled={target <= 1} onPress={() => setTarget((t) => Math.max(1, t - 1))} />
            <Text variant="figure" style={styles.stepValue} accessibilityLabel={`Meta: ${target}`}>
              {target}
            </Text>
            <StepButton icon="plus" label="Sumar uno a la meta" disabled={target >= 999} onPress={() => setTarget((t) => Math.min(999, t + 1))} />
          </View>
          <View style={styles.flex}>
            <TextField label="Unidad (opcional)" placeholder="vasos, min, páginas" value={unit} onChangeText={setUnit} maxLength={20} />
          </View>
        </View>
        <Text variant="caption" tone="muted">
          {target} {unit.trim() || (target === 1 ? 'vez' : 'veces')} {periodWord}
        </Text>
      </View>

      {period === 'day' ? (
        <View style={styles.field}>
          <Text variant="label" tone="muted">
            Qué días
          </Text>
          <View style={styles.wrapRow}>
            {ALL_DAYS.map((d) => (
              <Chip key={d} compact role="checkbox" label={WEEKDAY_SHORT[d]} selected={days.includes(d)} onPress={() => toggleDay(d)} />
            ))}
          </View>
          <Text variant="caption" tone="muted">
            Los días sin marcar no cuentan para la racha.
          </Text>
        </View>
      ) : null}

      <TimeField
        label="Hora del recordatorio (opcional)"
        value={reminder}
        onChange={(t) => {
          setReminder(t);
          setReminderError(null);
        }}
        defaultTime="07:00"
        placeholder="Sin recordatorio"
        hint={reminderError ?? 'Te avisa ese día a esa hora. Se activa en Hogar → Recordatorios.'}
      />

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Compartir con mi pareja</Text>
          <Text variant="caption" tone="muted">
            Podrá ver tu progreso, pero solo tú lo registras.
          </Text>
        </View>
        <Switch
          value={shared}
          onValueChange={setShared}
          accessibilityLabel="Compartir con mi pareja"
          trackColor={{ true: colors.trunk, false: colors.rule }}
          thumbColor={colors.surface}
        />
      </View>
    </Screen>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: {
    gap: space.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    height: 52,
  },
  stepButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
});
