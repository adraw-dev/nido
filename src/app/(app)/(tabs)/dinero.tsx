import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BalanceCard } from '@/features/finance/components/BalanceCard';
import { CategoryBars, MonthBars } from '@/features/finance/components/Charts';
import { GoalCard } from '@/features/finance/components/GoalCard';
import { TxRow } from '@/features/finance/components/TxRow';
import { useCategories, useGoals, useTransactions } from '@/features/finance/hooks';
import { balanceOf, byCategory, byMonth, groupByDay, inRange } from '@/features/finance/summary';
import { scopeOf, type Scope } from '@/features/finance/types';
import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { fromKey, relativeDay, toKey, type DateKey } from '@/lib/dates';
import { formatCOP } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { Button, EmptyState, Fab, SegmentedControl, SkeletonRows, Text, space, touchTarget, useTheme } from '@/ui';

type MoneyTab = 'movimientos' | 'metas' | 'reportes';

const monthStart = (d: DateKey) => toKey(startOfMonth(fromKey(d)));
const monthEnd = (d: DateKey) => toKey(endOfMonth(fromKey(d)));

export default function MoneyScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const { household } = useCurrentHousehold();
  const { colorOf, nameOf } = useLineLookup(household.id);
  const categories = useCategories(household.id);
  const goals = useGoals(household.id);

  const [scope, setScope] = useState<Scope>('hogar');
  const [view, setView] = useState<MoneyTab>('movimientos');
  const [reportKind, setReportKind] = useState<'expense' | 'income'>('expense');
  const [month, setMonth] = useState<DateKey>(monthStart(today));

  const year = fromKey(month).getFullYear();
  const yearTx = useTransactions(household.id, `${year}-01-01`, `${year}-12-31`);
  const prevMonth = toKey(addMonths(fromKey(month), -1));
  const prevTx = useTransactions(household.id, monthStart(prevMonth), monthEnd(prevMonth));

  const scoped = useMemo(() => (yearTx.data ?? []).filter((t) => scopeOf(t) === scope), [yearTx.data, scope]);
  const monthTx = useMemo(() => scoped.filter((t) => inRange(t, month, monthEnd(month))), [scoped, month]);
  const prevScoped = useMemo(() => (prevTx.data ?? []).filter((t) => scopeOf(t) === scope), [prevTx.data, scope]);
  const balance = balanceOf(monthTx);
  const days = useMemo(() => groupByDay(monthTx), [monthTx]);
  const goalList = goals.progress.filter((g) => scopeOf(g.goal) === scope);
  const goalNames = new Map(goals.progress.map((g) => [g.goal.id, g.goal.name] as const));

  const isCurrentMonth = month === monthStart(today);
  const monthLabel = format(fromKey(month), 'MMMM yyyy', { locale: es });

  const reportMonth = reportKind === 'expense' ? balance.expense : balance.income;
  const reportPrev = balanceOf(prevScoped)[reportKind];
  const change = reportPrev ? Math.round(((reportMonth - reportPrev) / reportPrev) * 100) : null;
  const yearValues = byMonth(scoped, year, reportKind);
  const currentMonthIndex = year === fromKey(today).getFullYear() ? fromKey(today).getMonth() : year < fromKey(today).getFullYear() ? -1 : 0;

  const refreshing = yearTx.isRefetching;

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              yearTx.refetch();
              prevTx.refetch();
              goals.refetch();
            }}
            colors={[colors.trunk]}
            tintColor={colors.trunk}
          />
        }
      >
        <Text variant="headline" accessibilityRole="header">
          Dinero
        </Text>
        <SegmentedControl<Scope>
          value={scope}
          onChange={setScope}
          segments={[
            { value: 'hogar', label: 'Hogar' },
            { value: 'personal', label: 'Personal' },
          ]}
        />

        {view !== 'metas' ? (
          <View style={styles.monthNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
              onPress={() => setMonth(toKey(addMonths(fromKey(month), -1)))}
              style={styles.navButton}
            >
              <MaterialCommunityIcons name="chevron-left" size={26} color={colors.ink} />
            </Pressable>
            <Text variant="title" style={styles.monthLabel} accessibilityLiveRegion="polite">
              {monthLabel}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
              accessibilityState={{ disabled: isCurrentMonth }}
              disabled={isCurrentMonth}
              onPress={() => setMonth(toKey(addMonths(fromKey(month), 1)))}
              style={[styles.navButton, { opacity: isCurrentMonth ? 0.3 : 1 }]}
            >
              <MaterialCommunityIcons name="chevron-right" size={26} color={colors.ink} />
            </Pressable>
          </View>
        ) : null}

        {view !== 'metas' ? <BalanceCard balance={balance} /> : null}

        <SegmentedControl<MoneyTab>
          value={view}
          onChange={setView}
          segments={[
            { value: 'movimientos', label: 'Movimientos' },
            { value: 'metas', label: 'Metas' },
            { value: 'reportes', label: 'Reportes' },
          ]}
        />

        {yearTx.isError ? (
          <View style={styles.block}>
            <Text tone="danger">No pudimos cargar los movimientos.</Text>
            <Button label="Reintentar" variant="tonal" onPress={() => yearTx.refetch()} />
          </View>
        ) : null}

        {view === 'movimientos' ? (
          days.length === 0 ? (
            yearTx.isPending ? (
              <SkeletonRows count={4} leading={40} />
            ) : (
              <EmptyState
                title="Sin movimientos este mes"
                caption={`Toca + para registrar un gasto ${scope === 'hogar' ? 'del hogar' : 'tuyo'}. Cada movimiento queda firmado con tu color.`}
              />
            )
          ) : (
            days.map((d) => (
              <View key={d.day}>
                <View style={[styles.dayHeader, { borderBottomColor: colors.rule }]}>
                  <Text variant="plate" tone="muted" style={styles.flex}>
                    {relativeDay(d.day, today)}
                  </Text>
                  <Text variant="caption" tone="subtle" style={styles.tabular}>
                    {formatCOP(d.total, { sign: true })}
                  </Text>
                </View>
                {d.data.map((t) => (
                  <TxRow
                    key={t.id}
                    tx={t}
                    category={t.category_id ? categories.byId.get(t.category_id) : undefined}
                    goalName={t.goal_id ? goalNames.get(t.goal_id) : undefined}
                    ownerName={nameOf(t.owner_id)}
                    ownerColor={colorOf(t.owner_id)}
                    onPress={() => router.push({ pathname: '/dinero/[id]', params: { id: t.id } })}
                  />
                ))}
              </View>
            ))
          )
        ) : null}

        {view === 'metas' ? (
          <View style={styles.block}>
            {goalList.length === 0 && !goals.isPending ? (
              <EmptyState
                title="Sin metas de ahorro"
                caption="Una meta junta los aportes que hagan. Su avance es la suma de esos aportes."
              />
            ) : (
              goalList.map((g) => (
                <GoalCard
                  key={g.goal.id}
                  progress={g}
                  color={g.goal.visibility === 'shared' ? colors.trunk : colorOf(g.goal.owner_id)}
                  today={today}
                  onPress={() => router.push({ pathname: '/dinero/metas/[id]', params: { id: g.goal.id } })}
                />
              ))
            )}
            <Button
              label="Nueva meta"
              variant="outline"
              onPress={() => router.push({ pathname: '/dinero/metas/nueva', params: { scope } })}
            />
          </View>
        ) : null}

        {view === 'reportes' ? (
          <View style={styles.block}>
            <SegmentedControl<'expense' | 'income'>
              value={reportKind}
              onChange={setReportKind}
              segments={[
                { value: 'expense', label: 'Gastos' },
                { value: 'income', label: 'Ingresos' },
              ]}
            />
            <View style={styles.reportHead}>
              <Text variant="caption" tone="muted">
                {reportKind === 'expense' ? 'Gastado' : 'Recibido'} en {format(fromKey(month), 'MMMM', { locale: es })}
              </Text>
              <Text variant="display" style={styles.tabular}>
                {formatCOP(reportMonth)}
              </Text>
              {change !== null ? (
                <Text variant="caption" tone="muted">
                  {change === 0 ? 'Igual' : `${change > 0 ? '+' : ''}${change}%`} frente a{' '}
                  {format(fromKey(prevMonth), 'MMMM', { locale: es })} ({formatCOP(reportPrev)})
                </Text>
              ) : null}
            </View>

            {byCategory(monthTx, reportKind).length ? (
              <CategoryBars shares={byCategory(monthTx, reportKind)} categories={categories.byId} kind={reportKind} />
            ) : (
              <Text tone="muted">Sin {reportKind === 'expense' ? 'gastos' : 'ingresos'} en este mes.</Text>
            )}

            <Text variant="title" style={styles.yearTitle}>
              Año {year}
            </Text>
            <MonthBars
              values={yearValues}
              selected={fromKey(month).getMonth()}
              current={currentMonthIndex}
              onSelect={(m) => setMonth(`${year}-${String(m + 1).padStart(2, '0')}-01`)}
            />
            <View style={styles.yearTotals}>
              {(['income', 'expense', 'saving'] as const).map((k) => (
                <View key={k} style={styles.flex}>
                  <Text variant="caption" tone="muted">
                    {k === 'income' ? 'Ingresos' : k === 'expense' ? 'Gastos' : 'Ahorro'} del año
                  </Text>
                  <Text variant="figure" numberOfLines={1} adjustsFontSizeToFit>
                    {formatCOP(byMonth(scoped, year, k).reduce((a, b) => a + b, 0))}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Fab
        label="Registrar movimiento"
        onPress={() => router.push({ pathname: '/dinero/nuevo', params: { scope } })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: space.xl - 4,
    paddingTop: space.md,
    paddingBottom: 96,
    gap: space.lg,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  block: {
    gap: space.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: space.md,
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  reportHead: {
    gap: 2,
  },
  yearTitle: {
    marginTop: space.md,
  },
  yearTotals: {
    flexDirection: 'row',
    gap: space.md,
  },
});
