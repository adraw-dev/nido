import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { financeErrorMessage } from '@/features/finance/api';
import { fixedPeriods, type DebtState, type FixedPeriod } from '@/features/finance/bills';
import { AmountInput, Field } from '@/features/finance/components/FormBits';
import { useDebts, useFixedExpenses, usePayDebt, usePayFixedExpense } from '@/features/finance/hooks';
import type { FixedExpense } from '@/features/finance/types';
import { useCurrentHousehold } from '@/features/household/hooks';
import { addDaysKey, fromKey, relativeDay, type DateKey } from '@/lib/dates';
import { formatCOP, groupThousands, parseCOP } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { Button, Chip, Screen, Text, space } from '@/ui';

/**
 * Pagar un período de un gasto fijo (?fijo=&periodo=) o abonar a una deuda
 * (?deuda=&cuota=). Crea el movimiento en Dinero una sola vez.
 */
export default function PayScreen() {
  const params = useLocalSearchParams<{ fijo?: string; periodo?: string; deuda?: string; cuota?: string }>();
  return params.deuda ? <PayDebt id={params.deuda} cuota={params.cuota} /> : <PayFixed id={params.fijo ?? ''} period={params.periodo ?? ''} />;
}

function useDays(today: DateKey) {
  return useMemo(() => Array.from({ length: 31 }, (_, i) => addDaysKey(today, -i)), [today]);
}

function DayChips({ value, onChange, today }: { value: DateKey; onChange: (d: DateKey) => void; today: DateKey }) {
  const days = useDays(today);
  const label = (d: DateKey) =>
    d === today ? 'Hoy' : d === addDaysKey(today, -1) ? 'Ayer' : format(fromKey(d), 'EEE d MMM', { locale: es });
  return (
    <Field label="Fecha del pago">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {days.map((d) => (
          <Chip key={d} label={label(d)} selected={value === d} onPress={() => onChange(d)} />
        ))}
      </ScrollView>
    </Field>
  );
}

function PayFixed({ id, period }: { id: string; period: DateKey }) {
  const today = useToday();
  const { household } = useCurrentHousehold();
  const fixed = useFixedExpenses(household.id);
  const pay = usePayFixedExpense(household.id);
  const item = fixed.list.find((f) => f.id === id);
  const state = item ? fixedPeriods(item, fixed.payments, period, period, today)[0] : undefined;

  if (!item || !state) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{fixed.isPending ? 'Cargando…' : 'Este pago ya no existe.'}</Text>
      </Screen>
    );
  }
  return <PayFixedForm key={item.id} item={item} state={state} pay={pay} today={today} />;
}

function PayFixedForm({
  item,
  state,
  pay,
  today,
}: {
  item: FixedExpense;
  state: FixedPeriod;
  pay: ReturnType<typeof usePayFixedExpense>;
  today: DateKey;
}) {
  const { period } = state;
  const id = item.id;
  const [amountText, setAmountText] = useState(groupThousands(Number(item.amount)));
  const [paidOn, setPaidOn] = useState<DateKey>(today);
  const [amountError, setAmountError] = useState<string | null>(null);

  const amount = parseCOP(amountText);
  const paid = state.status === 'paid';

  function submit() {
    if (amount <= 0) {
      setAmountError('Escribe cuánto pagaron.');
      return;
    }
    setAmountError(null);
    pay.mutate(
      { id, period, amount, paidOn },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.back();
        },
      },
    );
  }

  return (
    <Screen
      scroll
      edges={['bottom']}
      footer={
        <>
          {pay.isError ? <Text tone="danger">{financeErrorMessage(pay.error)}</Text> : null}
          <Button label={paid ? 'Ya está pagado' : `Pagar ${formatCOP(amount)}`} onPress={submit} loading={pay.isPending} disabled={paid} />
        </>
      }
    >
      <Stack.Screen options={{ title: 'Marcar pagado' }} />
      <View style={styles.head}>
        <Text variant="headline">{item.name}</Text>
        <Text tone={state.status === 'overdue' ? 'danger' : 'muted'}>
          Período del {relativeDay(period, today)}
          {state.status === 'overdue' ? ' · vencido' : ''} · {item.visibility === 'shared' ? 'Del hogar' : 'Solo mío'}
        </Text>
      </View>
      <AmountInput
        label="¿Cuánto pagaron?"
        accessibilityLabel="Valor pagado en pesos"
        value={amountText}
        onChange={setAmountText}
        error={amountError}
        size="lg"
      />
      <DayChips value={paidOn} onChange={setPaidOn} today={today} />
      <Text variant="caption" tone="muted">
        Queda como gasto en Dinero, firmado con tu color. Para deshacerlo, borra ese movimiento.
      </Text>
    </Screen>
  );
}

function PayDebt({ id, cuota }: { id: string; cuota?: string }) {
  const today = useToday();
  const { household } = useCurrentHousehold();
  const debts = useDebts(household.id, today);
  const pay = usePayDebt(household.id);
  const state = debts.states.find((s) => s.debt.id === id);

  if (!state) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{debts.isPending ? 'Cargando…' : 'Esta deuda ya no existe.'}</Text>
      </Screen>
    );
  }
  return <PayDebtForm key={state.debt.id} state={state} cuota={cuota} pay={pay} today={today} />;
}

function PayDebtForm({
  state,
  cuota,
  pay,
  today,
}: {
  state: DebtState;
  cuota?: string;
  pay: ReturnType<typeof usePayDebt>;
  today: DateKey;
}) {
  const { debt, pending, settled } = state;
  const id = debt.id;
  // Cuotas sin pagar que se pueden cubrir con este abono.
  const unpaid = useMemo(() => state.installments.filter((i) => i.status !== 'paid'), [state]);
  // Al abrir: la cuota pedida (o la que toca) y su valor.
  const [period, setPeriod] = useState<DateKey | null>(
    () => (cuota && unpaid.find((i) => i.period === cuota)?.period) || state.next?.period || null,
  );
  const [amountText, setAmountText] = useState(() =>
    period && debt.installment_amount ? groupThousands(Math.min(Number(debt.installment_amount), pending)) : '',
  );
  const [paidOn, setPaidOn] = useState<DateKey>(today);
  const [amountError, setAmountError] = useState<string | null>(null);
  const amount = parseCOP(amountText);

  function choosePeriod(p: DateKey | null) {
    setPeriod(p);
    if (p && debt.installment_amount) setAmountText(groupThousands(Math.min(Number(debt.installment_amount), pending)));
  }

  function submit() {
    if (amount <= 0) {
      setAmountError('Escribe cuánto abonaron.');
      return;
    }
    if (amount > pending) {
      setAmountError(`Solo falta ${formatCOP(pending)}.`);
      return;
    }
    setAmountError(null);
    pay.mutate(
      { id, amount, paidOn, period },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.back();
        },
      },
    );
  }

  return (
    <Screen
      scroll
      edges={['bottom']}
      footer={
        <>
          {pay.isError ? <Text tone="danger">{financeErrorMessage(pay.error)}</Text> : null}
          <Button label={settled ? 'Saldada' : `Abonar ${formatCOP(amount)}`} onPress={submit} loading={pay.isPending} disabled={settled} />
        </>
      }
    >
      <Stack.Screen options={{ title: 'Abonar' }} />
      <View style={styles.head}>
        <Text variant="headline">{debt.name}</Text>
        <Text tone="muted">
          Falta {formatCOP(pending)}
          {debt.creditor ? ` · a ${debt.creditor}` : ''}
        </Text>
      </View>

      {unpaid.length ? (
        <Field label="¿Qué cubre?">
          <View style={styles.wrap}>
            {unpaid.map((i) => (
              <Chip
                key={i.period}
                label={`Cuota ${format(fromKey(i.period), 'd MMM', { locale: es })}${i.status === 'overdue' ? ' · vencida' : ''}`}
                selected={period === i.period}
                onPress={() => choosePeriod(i.period)}
              />
            ))}
            <Chip label="Abono extra" selected={period === null} onPress={() => choosePeriod(null)} />
          </View>
        </Field>
      ) : null}

      <AmountInput
        label="¿Cuánto abonaron?"
        accessibilityLabel="Valor del abono en pesos"
        value={amountText}
        onChange={setAmountText}
        error={amountError}
        size="lg"
        autoFocus={!debt.installment_amount}
      />
      <View style={styles.wrap}>
        <Chip label={`Todo (${formatCOP(pending)})`} selected={amount === pending} onPress={() => setAmountText(groupThousands(pending))} />
      </View>
      <DayChips value={paidOn} onChange={setPaidOn} today={today} />
      <Text variant="caption" tone="muted">
        Queda como gasto en Dinero (categoría Deudas), firmado con tu color. Para deshacerlo, borra ese movimiento.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
