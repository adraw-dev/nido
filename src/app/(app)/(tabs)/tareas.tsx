import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { TaskRow } from '@/features/tasks/components/TaskRow';
import { matchesFilter, type Bucket, type TaskFilter, type TaskView } from '@/features/tasks/derive';
import { useTaskViews } from '@/features/tasks/hooks';
import { useToggleView } from '@/features/tasks/useToggleView';
import { Button, EmptyState, Fab, SegmentedControl, SkeletonRows, Text, space, useTheme } from '@/ui';

const SECTIONS: { bucket: Bucket; title: string }[] = [
  { bucket: 'atrasadas', title: 'Atrasadas' },
  { bucket: 'hoy', title: 'Hoy' },
  { bucket: 'proximas', title: 'Próximas' },
  { bucket: 'sin-fecha', title: 'Sin fecha' },
  { bucket: 'hechas', title: 'Hechas' },
];

const MAX_DONE = 10;

export default function TasksScreen() {
  const { colors } = useTheme();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { views, today, isPending, isError, refetch, isRefetching } = useTaskViews(household.id);
  const { colorOf, nameOf, trunkName } = useLineLookup(household.id);
  const toggle = useToggleView(household.id);
  const [filter, setFilter] = useState<TaskFilter>('todas');

  const sections = useMemo(() => {
    const visible = views.filter((v) => matchesFilter(v.task, filter, userId));
    return SECTIONS.map((s) => {
      let data = visible.filter((v) => v.bucket === s.bucket);
      if (s.bucket === 'hechas') {
        data = data.sort((a, b) => (a.completion!.completed_at < b.completion!.completed_at ? 1 : -1)).slice(0, MAX_DONE);
      }
      return { ...s, data, count: data.length };
    }).filter((s) => s.data.length > 0);
  }, [views, filter, userId]);

  const emptyCopy: Record<TaskFilter, { title: string; caption: string }> = {
    todas: { title: 'Todavía no hay tareas', caption: 'Toca + para crear la primera. Puede ser de uno, del otro o de los dos.' },
    mias: { title: 'Nada en tu línea', caption: 'Las tareas asignadas a ti o privadas aparecen aquí.' },
    compartidas: { title: `Nada para ${trunkName.toLowerCase()}`, caption: 'Las tareas de responsabilidad compartida aparecen aquí.' },
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text variant="headline" accessibilityRole="header">
          Tareas
        </Text>
        <SegmentedControl<TaskFilter>
          value={filter}
          onChange={setFilter}
          segments={[
            { value: 'mias', label: 'Mías' },
            { value: 'compartidas', label: 'Compartidas' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
      </View>

      {isError ? (
        <View style={styles.padded}>
          <Text tone="danger">No pudimos cargar las tareas.</Text>
          <Button label="Reintentar" variant="tonal" onPress={() => refetch()} />
        </View>
      ) : (
        <SectionList<TaskView, { bucket: Bucket; title: string; count: number }>
          sections={sections}
          keyExtractor={(v) => v.task.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} colors={[colors.trunk]} tintColor={colors.trunk} />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text variant="plate" tone={section.bucket === 'atrasadas' ? 'danger' : 'muted'}>
                {section.title}
              </Text>
              <Text variant="caption" tone="subtle" style={styles.count}>
                {section.count}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TaskRow
              view={item}
              today={today}
              colorOf={colorOf}
              nameOf={nameOf}
              onToggle={() => toggle(item)}
              onOpen={() => router.push({ pathname: '/tareas/[id]', params: { id: item.task.id } })}
            />
          )}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.rule }]} />}
          ListEmptyComponent={
            isPending ? <SkeletonRows count={5} leading={28} /> : <EmptyState title={emptyCopy[filter].title} caption={emptyCopy[filter].caption} />
          }
        />
      )}

      <Fab label="Nueva tarea" onPress={() => router.push('/tareas/nueva')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: space.xl - 4,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.md,
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
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    paddingTop: space.xl,
    paddingBottom: space.xs,
  },
  count: {
    fontVariant: ['tabular-nums'],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 40,
  },
});
