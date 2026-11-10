import { addMonths, endOfYear, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';

import { useUserId } from '@/features/session/SessionProvider';
import { fromKey, toKey, todayKey, type DateKey } from '@/lib/dates';
import { groupThousands, parseCOP } from '@/lib/money';
import { Button, Chip, Screen, SegmentedControl, Text, TextField, fonts, space, useTheme, useRevealFocused } from '@/ui';

import type { Goal, GoalInput, Scope } from '../types';

const nameSchema = z.string().trim().min(1, 'Ponle un nombre.').max(60, 'Máximo 60 caracteres.');

export type GoalFormProps = {
  initial?: Goal;
  defaultScope?: Scope;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: GoalInput) => void;
};

export function GoalForm({ initial, defaultScope, submitLabel, submitting, error, onSubmit }: GoalFormProps) {
  const { colors } = useTheme();
  const userId = useUserId();
  const revealFocused = useRevealFocused();
  const today = todayKey();
  const [name, setName] = useState(initial?.name ?? '');
  const [amountText, setAmountText] = useState(initial ? groupThousands(Number(initial.target_amount)) : '');
  const [targetOn, setTargetOn] = useState<DateKey | null>(initial?.target_on ?? null);
  const [scope, setScope] = useState<Scope>(initial ? (initial.visibility === 'shared' ? 'hogar' : 'personal') : (defaultScope ?? 'hogar'));
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const canChangeScope = !initial || initial.owner_id === userId;

  const presets: { label: string; value: DateKey | null }[] = [
    { label: 'Sin fecha', value: null },
    { label: 'En 3 meses', value: toKey(addMonths(fromKey(today), 3)) },
    { label: 'En 6 meses', value: toKey(addMonths(fromKey(today), 6)) },
    { label: 'Fin de año', value: toKey(endOfYear(fromKey(today))) },
    { label: 'En 1 año', value: toKey(addMonths(fromKey(today), 12)) },
  ];
  const custom = targetOn && !presets.some((p) => p.value === targetOn);

  function submit() {
    const parsed = nameSchema.safeParse(name);
    const amount = parseCOP(amountText);
    setNameError(parsed.success ? null : parsed.error.issues[0].message);
    setAmountError(amount > 0 ? null : 'Escribe cuánto quieren ahorrar.');
    if (!parsed.success || amount <= 0) return;
    onSubmit({
      name: parsed.data,
      target_amount: amount,
      target_on: targetOn,
      visibility: scope === 'hogar' ? 'shared' : 'personal',
    });
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
      <TextField label="Meta" placeholder="Viaje a Cartagena" value={name} onChangeText={setName} error={nameError} maxLength={60} autoFocus={!initial} />

      <View style={styles.field}>
        <Text variant="label" tone="muted">
          ¿Cuánto?
        </Text>
        <View style={[styles.amountRow, { borderBottomColor: amountError ? colors.danger : colors.ink }]}>
          <Text style={[styles.currency, { color: colors.inkMuted }]}>$</Text>
          <TextInput
            accessibilityLabel="Valor de la meta en pesos"
            onFocus={revealFocused}
            value={amountText}
            onChangeText={(t) => {
              const n = parseCOP(t);
              setAmountText(n ? groupThousands(n) : '');
            }}
            placeholder="0"
            placeholderTextColor={colors.inkSubtle}
            keyboardType="number-pad"
            maxLength={17}
            selectionColor={colors.trunk}
            style={[styles.amountInput, { color: colors.ink }]}
          />
        </View>
        {amountError ? (
          <Text variant="caption" tone="danger">
            {amountError}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text variant="label" tone="muted">
          ¿Para cuándo?
        </Text>
        <View style={styles.wrapRow}>
          {presets.map((p) => (
            <Chip key={p.label} label={p.label} selected={targetOn === p.value} onPress={() => setTargetOn(p.value)} />
          ))}
          {custom ? <Chip label={format(fromKey(targetOn!), 'd MMM yyyy', { locale: es })} selected onPress={() => {}} /> : null}
        </View>
      </View>

      {canChangeScope ? (
        <View style={styles.field}>
          <Text variant="label" tone="muted">
            De quién es
          </Text>
          <SegmentedControl<Scope>
            value={scope}
            onChange={setScope}
            segments={[
              { value: 'hogar', label: 'Del hogar' },
              { value: 'personal', label: 'Solo mía' },
            ]}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, gap: space.sm },
  currency: { fontFamily: fonts.display, fontSize: 28 },
  amountInput: { flex: 1, fontFamily: fonts.displayHeavy, fontSize: 36, paddingVertical: space.sm, fontVariant: ['tabular-nums'] },
});
