import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { fromKey, type DateKey } from '@/lib/dates';
import { formatCOP } from '@/lib/money';
import { Button, EmptyState, SkeletonRows, Text, space, useTheme } from '@/ui';

import { fixedBoard, type FixedPeriod } from '../bills';
import { useDebts, useFixedExpenses } from '../hooks';
import { scopeOf, type Scope } from '../types';
import { DebtCard, FixedPeriodRow, PaymentsLine } from './Bills';

/** Pestaña Pagos de Dinero: gastos fijos del mes y deudas por pagar. */
export function PaymentsView({
  householdId,
  scope,
  month,
  monthEnd,
  today,
}: {
  householdId: string;
  scope: Scope;
  month: DateKey;
  monthEnd: DateKey;
  today: DateKey;
}) {
  const { colors } = useTheme();
  const userId = useUserId();
  const { colorOf, nameOf } = useLineLookup(householdId);
  const fixed = useFixedExpenses(householdId);
  const debts = useDebts(householdId, today);

  // Lo del hogar va en el tronco azul; lo personal, en mi color de línea.
  const lineColor = scope === 'hogar' ? colors.trunk : colorOf(userId);

  const board = useMemo(
    () => fixedBoard(fixed.list.filter((f) => scopeOf(f) === scope), fixed.payments, month, monthEnd, today),
    [fixed.list, fixed.payments, scope, month, monthEnd, today],
  );
  const debtList = useMemo(() => {
    const list = debts.states.filter((s) => scopeOf(s.debt) === scope);
    // Activas primero (la cuota más cercana arriba); saldadas al final.
    return list.sort((a, b) => {
      if (a.settled !== b.settled) return a.settled ? 1 : -1;
      return (a.next?.period ?? a.debt.due_on ?? '9999') < (b.next?.period ?? b.debt.due_on ?? '9999') ? -1 : 1;
    });
  }, [debts.states, scope]);
  const totalPending = debtList.reduce((s, d) => s + d.pending, 0);

  const monthName = format(fromKey(month), 'MMMM', { locale: es });
  const paidCount = board.periods.filter((p) => p.status === 'paid').length;
  const hasFixed = fixed.list.some((f) => scopeOf(f) === scope);

  const pay = (p: FixedPeriod) =>
    router.push({ pathname: '/dinero/pagar', params: { fijo: p.fixed.id, periodo: p.period } });
  const open = (p: FixedPeriod) => router.push({ pathname: '/dinero/fijos/[id]', params: { id: p.fixed.id } });

  return (
    <View style={styles.block}>
      <View style={styles.sectionHead}>
        <Text variant="title" style={styles.flex}>
          Gastos fijos
        </Text>
        {board.periods.length ? (
          <Text variant="caption" tone="muted" style={styles.tabular}>
            {paidCount} de {board.periods.length} pagados
          </Text>
        ) : null}
      </View>

      {fixed.isPending ? (
        <SkeletonRows count={3} leading={28} />
      ) : fixed.isError ? (
        <View style={styles.block}>
          <Text tone="danger">No pudimos cargar los gastos fijos.</Text>
          <Button label="Reintentar" variant="tonal" onPress={() => fixed.refetch()} />
        </View>
      ) : !hasFixed ? (
        <EmptyState
          title="Sin gastos fijos"
          caption="Arriendo, servicios, el seguro de la moto: lo que se paga cada mes o cada quincena. Marcarlo pagado lo registra en Dinero."
        />
      ) : (
        <>
          {board.periods.length ? (
            <>
              <PaymentsLine
                color={lineColor}
                stops={board.periods.map((p) => ({
                  key: `${p.fixed.id}-${p.period}`,
                  status: p.status,
                  label: String(Number(p.period.slice(8, 10))),
                }))}
                accessibilityLabel={`${paidCount} de ${board.periods.length} pagos de ${monthName} hechos`}
              />
              <View style={styles.totals}>
                <Total label={`Fijos de ${monthName}`} value={board.total} />
                <Total label="Pagado" value={board.paid} />
                <Total label="Falta" value={board.pending} strong />
              </View>
            </>
          ) : (
            <Text tone="muted">Nada que pagar en {monthName}.</Text>
          )}

          {board.earlierOverdue.length ? (
            <View>
              <Text variant="plate" tone="danger" style={styles.groupTitle}>
                Vencidos de antes
              </Text>
              {board.earlierOverdue.map((p) => (
                <FixedPeriodRow
                  key={`${p.fixed.id}-${p.period}`}
                  item={p}
                  color={lineColor}
                  today={today}
                  onPress={() => open(p)}
                  onPay={() => pay(p)}
                />
              ))}
            </View>
          ) : null}

          <View>
            {board.periods.map((p) => (
              <FixedPeriodRow
                key={`${p.fixed.id}-${p.period}`}
                item={p}
                color={lineColor}
                today={today}
                payerName={p.payment ? nameOf(p.payment.created_by) : undefined}
                onPress={() => open(p)}
                onPay={() => pay(p)}
              />
            ))}
          </View>
        </>
      )}
      <Button
        label="Nuevo gasto fijo"
        variant="outline"
        onPress={() => router.push({ pathname: '/dinero/fijos/nuevo', params: { scope } })}
      />

      <View style={[styles.sectionHead, styles.sectionGap]}>
        <Text variant="title" style={styles.flex}>
          Deudas
        </Text>
        {totalPending > 0 ? (
          <Text variant="caption" tone="muted" style={styles.tabular}>
            {scope === 'hogar' ? 'Deben' : 'Debes'} {formatCOP(totalPending)}
          </Text>
        ) : null}
      </View>

      {debts.isPending ? (
        <SkeletonRows count={2} leading={40} />
      ) : debts.isError ? (
        <View style={styles.block}>
          <Text tone="danger">No pudimos cargar las deudas.</Text>
          <Button label="Reintentar" variant="tonal" onPress={() => debts.refetch()} />
        </View>
      ) : debtList.length === 0 ? (
        <EmptyState
          title="Sin deudas"
          caption="Un préstamo, la tarjeta o lo que le deben a un familiar. Cada abono baja el saldo y queda en Dinero."
        />
      ) : (
        debtList.map((s) => (
          <DebtCard
            key={s.debt.id}
            state={s}
            color={s.debt.visibility === 'shared' ? colors.trunk : colorOf(s.debt.owner_id)}
            today={today}
            onPress={() => router.push({ pathname: '/dinero/deudas/[id]', params: { id: s.debt.id } })}
          />
        ))
      )}
      <Button
        label="Nueva deuda"
        variant="outline"
        onPress={() => router.push({ pathname: '/dinero/deudas/nueva', params: { scope } })}
      />
    </View>
  );
}

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={styles.flex}>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="figure" tone={strong ? 'default' : 'muted'} numberOfLines={1} adjustsFontSizeToFit>
        {formatCOP(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  sectionGap: { marginTop: space.lg },
  totals: { flexDirection: 'row', gap: space.md },
  groupTitle: { paddingTop: space.xs },
  tabular: { fontVariant: ['tabular-nums'] },
});
