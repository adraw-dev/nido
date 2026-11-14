import { addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useUserId } from '@/features/session/SessionProvider';
import { fromKey, toKey, todayKey, type DateKey } from '@/lib/dates';
import { formatCOP, groupThousands, parseCOP } from '@/lib/money';
import { Button, Chip, Screen, SegmentedControl, Text, TextField, space } from '@/ui';

import { payDaysLabel } from '../schedule';
import type { Debt, DebtInput, Scope } from '../types';
import { AmountInput, DayOfMonthPicker, Field } from './FormBits';

const nameSchema = z.string().trim().min(1, 'Ponle un nombre.').max(60, 'Máximo 60 caracteres.');

export type DebtFormProps = {
  initial?: Debt;
  /** Al editar: lo que falta hoy y lo abonado en Nido (para recalcular el saldo inicial). */
  current?: { pending: number; paidInNido: number };
  defaultScope?: Scope;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: DebtInput) => void;
};

export function DebtForm({ initial, current, defaultScope, submitLabel, submitting, error, onSubmit }: DebtFormProps) {
  const userId = useUserId();
  const today = todayKey();
  const paidInNido = current?.paidInNido ?? 0;

  const [name, setName] = useState(initial?.name ?? '');
  const [creditor, setCreditor] = useState(initial?.creditor ?? '');
  const [totalText, setTotalText] = useState(initial ? groupThousands(Number(initial.total_amount)) : '');
  const [pendingText, setPendingText] = useState(current ? groupThousands(current.pending) : '');
  const [withInstallment, setWithInstallment] = useState(!!initial?.installment_day);
  const [installmentText, setInstallmentText] = useState(
    initial?.installment_amount ? groupThousands(Number(initial.installment_amount)) : '',
  );
  const [installmentDay, setInstallmentDay] = useState<number[]>(initial?.installment_day ? [initial.installment_day] : []);
  const [dueOn, setDueOn] = useState<DateKey | null>(initial?.due_on ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [scope, setScope] = useState<Scope>(initial ? (initial.visibility === 'shared' ? 'hogar' : 'personal') : (defaultScope ?? 'hogar'));
  const [errors, setErrors] = useState<Partial<Record<'name' | 'total' | 'pending' | 'installment' | 'day', string>>>({});
  const canChangeScope = !initial || initial.owner_id === userId;

  const presets: { label: string; value: DateKey | null }[] = [
    { label: 'Sin fecha', value: null },
    { label: 'En 6 meses', value: toKey(addMonths(fromKey(today), 6)) },
    { label: 'En 1 año', value: toKey(addMonths(fromKey(today), 12)) },
    { label: 'En 2 años', value: toKey(addMonths(fromKey(today), 24)) },
  ];
  const customDue = dueOn && !presets.some((p) => p.value === dueOn);

  function submit() {
    const parsed = nameSchema.safeParse(name);
    const total = parseCOP(totalText);
    const pending = pendingText ? parseCOP(pendingText) : total;
    const opening = pending + paidInNido;
    const installment = parseCOP(installmentText);
    const next: typeof errors = {};
    if (!parsed.success) next.name = parsed.error.issues[0].message;
    if (total <= 0) next.total = 'Escribe el total de la deuda.';
    else if (opening > total)
      next.pending = paidInNido
        ? `Con lo ya abonado en Nido (${formatCOP(paidInNido)}), lo que falta no puede pasar de ${formatCOP(total - paidInNido)}.`
        : 'Lo que falta no puede ser mayor que el total.';
    if (withInstallment && installment <= 0) next.installment = 'Escribe el valor de la cuota.';
    if (withInstallment && installmentDay.length !== 1) next.day = 'Elige el día de la cuota.';
    setErrors(next);
    if (Object.keys(next).length || !parsed.success) return;

    // Si la cuota es nueva, cuenta desde hoy: las fechas pasadas no quedan vencidas.
    const startsOn = !initial || (withInstallment && !initial.installment_day) ? today : initial.starts_on;
    onSubmit({
      name: parsed.data,
      creditor: creditor.trim() || null,
      total_amount: total,
      opening_balance: opening,
      installment_amount: withInstallment ? installment : null,
      installment_day: withInstallment ? installmentDay[0] : null,
      starts_on: startsOn,
      due_on: dueOn,
      notes: notes.trim() || null,
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
      <TextField label="Qué se debe" placeholder="Préstamo de la moto" value={name} onChangeText={setName} error={errors.name} maxLength={60} autoFocus={!initial} />
      <TextField label="¿A quién? (opcional)" placeholder="Banco, mamá, Juan…" value={creditor} onChangeText={setCreditor} maxLength={60} />

      <AmountInput label="Total de la deuda" accessibilityLabel="Total de la deuda en pesos" value={totalText} onChange={setTotalText} error={errors.total} />

      <View style={styles.field}>
        <AmountInput
          label={initial ? '¿Cuánto falta hoy?' : '¿Cuánto falta? (opcional)'}
          accessibilityLabel="Saldo pendiente en pesos"
          value={pendingText}
          onChange={setPendingText}
          error={errors.pending}
        />
        <Text variant="caption" tone="muted">
          {initial
            ? 'Ajústalo si el saldo cambió por intereses o compras nuevas.'
            : 'Si ya llevan pagos, escribe lo que falta hoy. Vacío = el total.'}
        </Text>
      </View>

      <Field label="Cuota">
        <SegmentedControl<'no' | 'si'>
          value={withInstallment ? 'si' : 'no'}
          onChange={(v) => setWithInstallment(v === 'si')}
          segments={[
            { value: 'no', label: 'Sin cuota fija' },
            { value: 'si', label: 'Cuota mensual' },
          ]}
        />
      </Field>

      {withInstallment ? (
        <>
          <AmountInput
            label="Valor de la cuota"
            accessibilityLabel="Valor de la cuota en pesos"
            value={installmentText}
            onChange={setInstallmentText}
            error={errors.installment}
          />
          <Field label="Día de la cuota" hint={installmentDay.length ? `${payDaysLabel(installmentDay)} de cada mes.` : undefined}>
            <DayOfMonthPicker value={installmentDay} onChange={setInstallmentDay} max={1} />
            {errors.day ? (
              <Text variant="caption" tone="danger">
                {errors.day}
              </Text>
            ) : null}
          </Field>
        </>
      ) : null}

      <Field label="Fecha límite para saldarla">
        <View style={styles.wrapRow}>
          {presets.map((p) => (
            <Chip key={p.label} label={p.label} selected={dueOn === p.value} onPress={() => setDueOn(p.value)} />
          ))}
          {customDue ? <Chip label={format(fromKey(dueOn!), 'd MMM yyyy', { locale: es })} selected onPress={() => {}} /> : null}
        </View>
      </Field>

      {canChangeScope ? (
        <Field
          label="De quién es"
          hint={scope === 'hogar' ? 'Los dos la ven y cualquiera puede abonar.' : 'Solo tú la verás.'}
        >
          <SegmentedControl<Scope>
            value={scope}
            onChange={setScope}
            segments={[
              { value: 'hogar', label: 'Del hogar' },
              { value: 'personal', label: 'Solo mía' },
            ]}
          />
        </Field>
      ) : null}

      <TextField label="Nota (opcional)" placeholder="Tasa, número de crédito…" value={notes} onChangeText={setNotes} maxLength={500} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
