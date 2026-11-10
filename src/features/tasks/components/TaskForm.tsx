import { format, getISODay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { z } from 'zod';

import { useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { addDaysKey, fromKey, todayKey, type DateKey } from '@/lib/dates';
import { formatRule, parseRule, WEEKDAY_SHORT, type Freq, type Weekday } from '@/lib/recurrence';
import { Button, Chip, Screen, Text, TextField, TimeField, space, useTheme } from '@/ui';

import { PRIORITY_LABEL, type Priority, type Task, type TaskInput } from '../types';

type Repeat = 'none' | Freq;

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const titleSchema = z.string().trim().min(1, 'Escribe qué hay que hacer.').max(120, 'Máximo 120 caracteres.');

export type TaskFormProps = {
  householdId: string;
  initial?: Task;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: TaskInput) => void;
};

export function TaskForm({ householdId, initial, submitLabel, submitting, error, onSubmit }: TaskFormProps) {
  const { colors } = useTheme();
  const userId = useUserId();
  const { lines, colorOf, trunkName } = useLineLookup(householdId);
  const today = todayKey();

  const initialRule = parseRule(initial?.recurrence);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [owner, setOwner] = useState<string>(
    initial ? (initial.assignee_id ?? (initial.visibility === 'personal' ? initial.owner_id : 'trunk')) : 'trunk',
  );
  const [isPrivate, setPrivate] = useState(initial?.visibility === 'personal');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 2);
  const [date, setDate] = useState<DateKey | null>(initial ? initial.due_on : today);
  const [time, setTime] = useState(initial?.due_time?.slice(0, 5) ?? '');
  const [repeat, setRepeat] = useState<Repeat>(initialRule?.freq ?? 'none');
  const [byDay, setByDay] = useState<Weekday[]>(initialRule?.byDay ?? []);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);

  // Solo quien crea la tarea puede volverla privada (la base de datos lo exige).
  const canBePrivate = owner === userId && (!initial || initial.owner_id === userId);

  const initialDue = initial?.due_on ?? null;
  const dayOptions = useMemo(() => {
    const keys = Array.from({ length: 14 }, (_, i) => addDaysKey(today, i));
    if (initialDue && !keys.includes(initialDue)) keys.unshift(initialDue);
    return keys;
  }, [today, initialDue]);

  const dayLabel = (key: DateKey) =>
    key === today ? 'Hoy' : key === addDaysKey(today, 1) ? 'Mañana' : format(fromKey(key), 'EEE d', { locale: es });

  function chooseRepeat(next: Repeat) {
    setRepeat(next);
    if (next !== 'none' && !date) setDate(today);
    if (next === 'WEEKLY' && byDay.length === 0) {
      setByDay([getISODay(fromKey(date ?? today)) as Weekday]);
    }
  }

  function toggleDay(d: Weekday) {
    setByDay((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      return next.length ? next.sort() : prev; // al menos un día
    });
  }

  function submit() {
    const parsedTitle = titleSchema.safeParse(title);
    setTitleError(parsedTitle.success ? null : parsedTitle.error.issues[0].message);
    const timeOk = time.trim() === '' || TIME_RE.test(time.trim());
    setTimeError(timeOk ? null : 'Usa el formato 24 h, por ejemplo 18:30.');
    if (!parsedTitle.success || !timeOk) return;

    const recurrence =
      repeat === 'none'
        ? null
        : formatRule({
            freq: repeat,
            interval: initialRule?.freq === repeat ? initialRule.interval : 1,
            byDay: repeat === 'WEEKLY' ? byDay : undefined,
            byMonthDay: repeat === 'MONTHLY' ? fromKey(date ?? today).getDate() : undefined,
          });

    const trunk = owner === 'trunk';
    const [h, m] = time.trim() ? time.trim().split(':') : [];
    onSubmit({
      title: parsedTitle.data,
      notes: notes.trim() || null,
      assignee_id: trunk ? null : owner,
      visibility: !trunk && canBePrivate && isPrivate ? 'personal' : 'shared',
      priority,
      due_on: repeat !== 'none' ? (date ?? today) : date,
      due_time: h ? `${h.padStart(2, '0')}:${m}` : null,
      recurrence,
    });
  }

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
        label="¿Qué hay que hacer?"
        placeholder="Sacar la basura"
        value={title}
        onChangeText={setTitle}
        error={titleError}
        maxLength={120}
        autoFocus={!initial}
        autoCapitalize="sentences"
        returnKeyType="done"
      />

      <Field label="¿De quién es?">
        <View style={styles.wrapRow}>
          {lines.map((l) => (
            <Chip
              key={l.user_id}
              label={l.user_id === userId ? `${l.firstName} (yo)` : l.firstName}
              color={l.color}
              selected={owner === l.user_id}
              onPress={() => setOwner(l.user_id)}
            />
          ))}
          <Chip label={trunkName} color={colorOf('trunk')} selected={owner === 'trunk'} onPress={() => setOwner('trunk')} />
        </View>
        {canBePrivate ? (
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">Privada</Text>
              <Text variant="caption" tone="muted">
                Solo tú la ves. Tu pareja no sabrá que existe.
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setPrivate}
              accessibilityLabel="Tarea privada"
              trackColor={{ true: colors.trunk, false: colors.rule }}
              thumbColor={colors.surface}
            />
          </View>
        ) : null}
      </Field>

      <Field label="Fecha">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {repeat === 'none' ? (
            <Chip label="Sin fecha" selected={date === null} onPress={() => setDate(null)} />
          ) : null}
          {dayOptions.map((key) => (
            <Chip key={key} label={dayLabel(key)} selected={date === key} onPress={() => setDate(key)} />
          ))}
        </ScrollView>
        {repeat !== 'none' ? (
          <Text variant="caption" tone="muted">
            Es el primer día de la repetición.
          </Text>
        ) : null}
      </Field>

      <TimeField
        label="Hora (opcional)"
        value={time}
        onChange={(t) => {
          setTime(t);
          setTimeError(null);
        }}
        defaultTime="18:00"
        hint={timeError ?? undefined}
      />

      <Field label="Se repite">
        <View style={styles.wrapRow}>
          <Chip label="No" selected={repeat === 'none'} onPress={() => chooseRepeat('none')} />
          <Chip label="Cada día" selected={repeat === 'DAILY'} onPress={() => chooseRepeat('DAILY')} />
          <Chip label="Cada semana" selected={repeat === 'WEEKLY'} onPress={() => chooseRepeat('WEEKLY')} />
          <Chip label="Cada mes" selected={repeat === 'MONTHLY'} onPress={() => chooseRepeat('MONTHLY')} />
        </View>
        {repeat === 'WEEKLY' ? (
          <View style={styles.wrapRow} accessibilityLabel="Días de la semana">
            {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => (
              <Chip
                key={d}
                compact
                role="checkbox"
                label={WEEKDAY_SHORT[d]}
                selected={byDay.includes(d)}
                onPress={() => toggleDay(d)}
              />
            ))}
          </View>
        ) : null}
        {repeat === 'MONTHLY' ? (
          <Text variant="caption" tone="muted">
            El día {fromKey(date ?? today).getDate()} de cada mes.
          </Text>
        ) : null}
      </Field>

      <Field label="Prioridad">
        <View style={styles.wrapRow}>
          {([1, 2, 3] as Priority[]).map((p) => (
            <Chip
              key={p}
              label={PRIORITY_LABEL[p]}
              color={p === 1 ? colors.danger : undefined}
              selected={priority === p}
              onPress={() => setPriority(p)}
            />
          ))}
        </View>
      </Field>

      <TextField
        label="Notas (opcional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={styles.notes}
        textAlignVertical="top"
      />
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.xs,
  },
  notes: {
    minHeight: 88,
  },
});
