import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TodayMonthCard } from '@/features/finance/components/TodayMonthCard';
import { TodayHabitsCard } from '@/features/habits/components/TodayHabitsCard';
import { HouseActivityCard, UpcomingCard } from '@/features/today/components';
import { QuickAdd } from '@/features/today/QuickAdd';
import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { lineOf, type TaskView } from '@/features/tasks/derive';
import { useTaskViews } from '@/features/tasks/hooks';
import { useToggleView } from '@/features/tasks/useToggleView';
import { formatTime, fromKey, relativeDay } from '@/lib/dates';
import {
  Avatar,
  Button,
  MetroDiagram,
  Text,
  radius,
  space,
  touchTarget,
  useTheme,
  type MetroStation,
} from '@/ui';

/** En la línea: primero lo recorrido (hecho), luego lo atrasado y lo pendiente por hora. */
function stationOrder(a: TaskView, b: TaskView): number {
  const rank = { done: 0, overdue: 1, pending: 2 } as const;
  if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
  if (a.state === 'done') return a.completion!.completed_at < b.completion!.completed_at ? -1 : 1;
  const ta = a.task.due_time ?? '99';
  const tb = b.task.due_time ?? '99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.task.priority - b.task.priority;
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { lines, colorOf, nameOf, trunkName } = useLineLookup(household.id);
  const tasks = useTaskViews(household.id);
  const toggle = useToggleView(household.id);

  const me = lines.find((l) => l.user_id === userId);
  const todayLabel = format(fromKey(tasks.today), "EEEE d 'de' MMMM", { locale: es });
  const alone = lines.length === 1;

  const todays = useMemo(
    () => tasks.views.filter((v) => v.bucket === 'hoy' || v.bucket === 'atrasadas').sort(stationOrder),
    [tasks.views],
  );
  const doneCount = todays.filter((v) => v.state === 'done').length;

  const toStation = (v: TaskView): MetroStation => {
    const time = formatTime(v.task.due_time);
    return {
      id: v.task.id,
      title: v.task.title,
      state: v.state,
      caption:
        v.state === 'overdue' && v.showOn ? `Venció ${relativeDay(v.showOn, tasks.today)}` : (time ?? undefined),
      signedBy:
        v.state === 'done' && v.completion
          ? {
              name: `${nameOf(v.completion.completed_by)} · ${formatTime(format(new Date(v.completion.completed_at), 'HH:mm'))}`,
              color: colorOf(v.completion.completed_by),
            }
          : undefined,
    };
  };

  const memberIds = new Set(lines.map((l) => l.user_id));
  const members = lines.map((l) => ({
    id: l.user_id,
    name: l.firstName,
    color: l.color,
    stations: todays.filter((v) => lineOf(v.task) === l.user_id).map(toStation),
  }));
  // Lo compartido, y lo de alguien que ya no está en el hogar, va al tronco.
  const shared = todays.filter((v) => !memberIds.has(lineOf(v.task))).map(toStation);

  const headline =
    todays.length === 0
      ? 'Día despejado'
      : doneCount === todays.length
        ? `¡Todo hecho! ${doneCount} de ${todays.length}`
        : `${doneCount} de ${todays.length} hechas`;

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <View style={styles.flex}>
          <Text variant="caption" tone="muted" style={styles.date}>
            {todayLabel}
          </Text>
          <Text variant="headline" accessibilityRole="header" accessibilityLiveRegion="polite">
            {headline}
          </Text>
        </View>
        <Link href="/hogar" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Hogar y perfil" hitSlop={8} style={styles.avatarHit}>
            <Avatar name={me?.profile.display_name ?? '?'} color={me?.color ?? colors.inkSubtle} size={40} />
          </Pressable>
        </Link>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={tasks.isRefetching}
            onRefresh={() => tasks.refetch()}
            colors={[colors.trunk]}
            tintColor={colors.trunk}
          />
        }
      >
        {tasks.isError ? (
          <View style={styles.block}>
            <Text tone="danger">No pudimos cargar las tareas de hoy.</Text>
            <Button label="Reintentar" variant="tonal" onPress={() => tasks.refetch()} />
          </View>
        ) : tasks.isPending || lines.length === 0 ? (
          <View style={[styles.skeleton, { backgroundColor: colors.surfaceMuted }]} />
        ) : (
          <MetroDiagram
            members={members}
            shared={shared}
            trunkLabel={trunkName}
            emptyCaption="Toca + para crear una tarea. Cada una será una estación en su línea."
            onStationPress={(id) => {
              const view = todays.find((v) => v.task.id === id);
              if (view) toggle(view);
            }}
          />
        )}

        {alone ? (
          <Link href="/hogar" asChild>
            <Pressable
              accessibilityRole="button"
              // Link asChild no acepta arreglos de estilos: se aplanan.
              style={StyleSheet.flatten([
                styles.card,
                styles.invite,
                { backgroundColor: colors.surface, borderColor: colors.trunk },
              ])}
            >
              <Text variant="title">Falta una línea</Text>
              <Text tone="muted">Invita a tu pareja con un código para que su línea se una al tronco.</Text>
              <Text variant="label" tone="trunk">
                Generar código →
              </Text>
            </Pressable>
          </Link>
        ) : null}

        <View style={styles.row}>
          <TodayHabitsCard householdId={household.id} />
          <TodayMonthCard householdId={household.id} />
        </View>

        <UpcomingCard householdId={household.id} />
        <HouseActivityCard householdId={household.id} />
      </ScrollView>

      <QuickAdd householdId={household.id} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl - 4,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  date: {
    textTransform: 'capitalize',
  },
  avatarHit: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: space.xl - 4,
    paddingBottom: 96,
    gap: space.xl,
  },
  block: {
    gap: space.md,
  },
  skeleton: {
    height: 220,
    borderRadius: radius.lg,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
  },
  card: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space.xs,
  },
  invite: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: space.sm,
  },
});
