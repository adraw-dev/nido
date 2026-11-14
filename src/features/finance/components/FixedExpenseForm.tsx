import { startOfMonth } from 'date-fns';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useUserId } from '@/features/session/SessionProvider';
import { fromKey, toKey, todayKey, type DateKey } from '@/lib/dates';
import { groupThousands, parseCOP } from '@/lib/money';
import { Button, Chip, Screen, SegmentedControl, Text, TextField, space } from '@/ui';

import { sortCategories, useCategories } from '../hooks';
import { payDaysLabel } from '../schedule';
import type { FixedExpense, FixedExpenseInput, Scope } from '../types';
import { AmountInput, CategoryGrid, DayOfMonthPicker, Field } from './FormBits';

const nameSchema = z.string().trim().min(1, 'Ponle un nombre.').max(60, 'Máximo 60 caracteres.');
type Frequency = 'mensual' | 'quincenal';

export type FixedExpenseFormProps = {
  householdId: string;
  initial?: FixedExpense;
  defaultScope?: Scope;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: FixedExpenseInput) => void;
};

export function FixedExpenseForm({ householdId, initial, defaultScope, submitLabel, submitting, error, onSubmit }: FixedExpenseFormProps) {
  const userId = useUserId();
  const categories = useCategories(householdId);
  const today = todayKey();
  const monthStart = toKey(startOfMonth(fromKey(today)));

  const [name, setName] = useState(initial?.name ?? '');
  const [amountText, setAmountText] = useState(initial ? groupThousands(Number(initial.amount)) : '');
  const [frequency, setFrequency] = useState<Frequency>(initial && initial.pay_days.length > 1 ? 'quincenal' : 'mensual');
  const [days, setDays] = useState<number[]>(initial?.pay_days ?? [1]);
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [startsOn, setStartsOn] = useState<DateKey>(initial?.starts_on ?? today);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [scope, setScope] = useState<Scope>(initial ? (initial.visibility === 'shared' ? 'hogar' : 'personal') : (defaultScope ?? 'hogar'));
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [daysError, setDaysError] = useState<string | null>(null);
  const canChangeScope = !initial || initial.owner_id === userId;

  const expenseCategories = useMemo(
    () => sortCategories((categories.data ?? []).filter((c) => c.kind === 'expense')),
    [categories.data],
  );

  function changeFrequency(next: Frequency) {
    setFrequency(next);
    setDaysError(null);
    if (next === 'quincenal') setDays(days.length === 2 ? days : [15, 30]);
    else setDays(days.slice(0, 1));
  }

  function submit() {
    const parsed = nameSchema.safeParse(name);
    const amount = parseCOP(amountText);
    const needed = frequency === 'quincenal' ? 2 : 1;
    setNameError(parsed.success ? null : parsed.error.issues[0].message);
    setAmountError(amount > 0 ? null : 'Escribe cuánto se paga.');
    setDaysError(days.length === needed ? null : needed === 2 ? 'Elige los dos días de pago.' : 'Elige el día de pago.');
    if (!parsed.success || amount <= 0 || days.length !== needed) return;
    onSubmit({
      name: parsed.data,
      amount,
      category_id: categoryId,
      pay_days: days,
      starts_on: startsOn,
      notes: notes.trim() || null,
      visibility: scope === 'hogar' ? 'shared' : 'personal',
    });
  }

  const startOptions: { label: string; value: DateKey }[] = [
    { label: 'Desde hoy', value: today },
    { label: 'Desde el 1 de este mes', value: monthStart },
  ];
  if (initial && !startOptions.some((o) => o.value === initial.starts_on)) {
    startOptions.push({ label: 'Como estaba', value: initial.starts_on });
  }

  return (
    <Screen
      scroll
      edges={['bottom']}
      footer={
        <>
          {error ? <Text tone="danger">{error}</Text> : null}
          <Button label={submitLabel} onPress={submit} loading={submitting} />
        </>
      }
    >
      <TextField label="Qué se paga" placeholder="Arriendo" value={name} onChangeText={setName} error={nameError} maxLength={60} autoFocus={!initial} />

      <AmountInput
        label="¿Cuánto?"
        accessibilityLabel="Valor del gasto fijo en pesos"
        value={amountText}
        onChange={setAmountText}
        error={amountError}
      />

      <Field label="Cada cuánto">
        <SegmentedControl<Frequency>
          value={frequency}
          onChange={changeFrequency}
          segments={[
            { value: 'mensual', label: 'Mensual' },
            { value: 'quincenal', label: 'Quincenal' },
          ]}
        />
      </Field>

      <Field
        label={frequency === 'quincenal' ? 'Días de pago (elige dos)' : 'Día de pago'}
        hint={`${payDaysLabel(days)}. Si el mes es más corto, el 29, 30 o 31 caen el último día.`}
      >
        <DayOfMonthPicker value={days} onChange={(d) => { setDays(d); setDaysError(null); }} max={frequency === 'quincenal' ? 2 : 1} />
        {daysError ? (
          <Text variant="caption" tone="danger">
            {daysError}
          </Text>
        ) : null}
      </Field>

      <Field label="Categoría" hint={categoryId ? undefined : 'Sin elegir queda en "Otros".'}>
        <CategoryGrid categories={expenseCategories} value={categoryId} onChange={setCategoryId} />
      </Field>

      <Field label="Cuenta desde" hint="Los pagos anteriores a esta fecha no aparecen como vencidos.">
        <View style={styles.wrapRow}>
          {startOptions.map((o) => (
            <Chip key={o.label} label={o.label} selected={startsOn === o.value} onPress={() => setStartsOn(o.value)} />
          ))}
        </View>
      </Field>

      {canChangeScope ? (
        <Field
          label="De quién es"
          hint={scope === 'hogar' ? 'Los dos lo ven y cualquiera puede marcarlo pagado.' : 'Solo tú lo verás.'}
        >
          <SegmentedControl<Scope>
            value={scope}
            onChange={setScope}
            segments={[
              { value: 'hogar', label: 'Del hogar' },
              { value: 'personal', label: 'Solo mío' },
            ]}
          />
        </Field>
      ) : null}

      <TextField label="Nota (opcional)" placeholder="Referencia de pago, cuenta…" value={notes} onChangeText={setNotes} maxLength={500} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
