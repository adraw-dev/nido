import { router } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HabitRow } from '@/features/habits/components/HabitRow';
import { useHabitViews, type HabitView } from '@/features/habits/hooks';
import { useLogView } from '@/features/habits/useLogView';
import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { Button, EmptyState, Fab, Text, space, useTheme } from '@/ui';

type Section = { key: string; title: string; data: HabitView[] };

export default function HabitsScreen() {
  const { colors } = useTheme();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { views, today, isPending, isError, isRefetching, refetch } = useHabitViews(household.id);
  const { colorOf, nameOf } = useLineLookup(household.id);
  const logView = useLogView(household.id);
  const todayIndex = views[0]?.week.findIndex((w) => w.day === today) ?? 0;

  const sections = useMemo<Section[]>(() => {
    const mine = views.filter((v) => v.habit.owner_id === userId);
    const theirs = views.filter((v) => v.habit.owner_id !== userId);
    const todayMine = mine.filter((v) => v.habit.period !== 'day' || v.progress.due);
    const restMine = mine.filter((v) => v.habit.period === 'day' && !v.progress.due);
    const out: Section[] = [
      { key: 'hoy', title: 'Mis hábitos', data: todayMine },
      { key: 'descanso', title: 'Hoy no tocan', data: restMine },
    ];
    // Compartidos de la pareja, agrupados por persona.
    const owners = [...new Set(theirs.map((v) => v.habit.owner_id))];
    for (const o of owners) out.push({ key: o, title: `De ${nameOf(o)}`, data: theirs.filter((v) => v.habit.owner_id === o) });
    return out.filter((s) => s.data.length > 0);
  }, [views, userId, nameOf]);

  const metToday = views.filter((v) => v.habit.owner_id === userId && v.progress.due && v.progress.met).length;
  const dueToday = views.filter((v) => v.habit.owner_id === userId && v.progress.due).length;

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text variant="headline" accessibilityRole="header">
          Hábitos
        </Text>
        {dueToday > 0 ? (
          <Text tone="muted" accessibilityLiveRegion="polite">
            {metToday === dueToday ? `¡Todo cumplido! ${metToday} de ${dueToday}` : `${metToday} de ${dueToday} cumplidos`}
          </Text>
        ) : null}
      </View>

      {isError ? (
        <View style={styles.padded}>
          <Text tone="danger">No pudimos cargar los hábitos.</Text>
          <Button label="Reintentar" variant="tonal" onPress={() => refetch()} />
        </View>
      ) : (
        <SectionList<HabitView, Section>
          sections={sections}
          keyExtractor={(v) => v.habit.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} colors={[colors.trunk]} tintColor={colors.trunk} />
          }
          renderSectionHeader={({ section }) => (
            <Text variant="plate" tone="muted" style={styles.sectionHeader}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => {
            const mine = item.habit.owner_id === userId;
            return (
              <HabitRow
                view={item}
                color={colorOf(item.habit.owner_id)}
                todayIndex={todayIndex}
                ownerName={mine ? undefined : nameOf(item.habit.owner_id)}
                canLog={mine}
                onLog={() => logView(item, today, 1)}
                onOpen={() => router.push({ pathname: '/habitos/[id]', params: { id: item.habit.id } })}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.rule }]} />}
          ListEmptyComponent={
            isPending ? undefined : (
              <EmptyState
                title="Todavía no hay hábitos"
                caption="Toca + para crear uno. Cada hábito es una línea circular de la semana; los tuyos son privados salvo que los compartas."
              />
            )
          }
        />
      )}

      <Fab label="Nuevo hábito" onPress={() => router.push('/habitos/nuevo')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: space.xl - 4,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.xs,
  },
  padded: {
    padding: space.xl - 4,
    gap: space.md,
  },
  list: {
    paddingHorizontal: space.xl - 4,
    paddingBottom: 96,
  },
  sectionHeader: {
    paddingTop: space.xl,
    paddingBottom: space.xs,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
});
