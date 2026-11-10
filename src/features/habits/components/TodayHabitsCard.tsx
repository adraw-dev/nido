import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { Text, radius, space, useTheme } from '@/ui';

import { useHabitViews } from '../hooks';
import { useLogView } from '../useLogView';
import { progressText } from './HabitRow';
import { HabitRing } from './HabitRing';

const MAX_RINGS = 3;

/** Tarjeta compacta de Hoy: mis hábitos del día; cada anillo suma uno. */
export function TodayHabitsCard({ householdId }: { householdId: string }) {
  const { colors } = useTheme();
  const userId = useUserId();
  const { views, today, isPending } = useHabitViews(householdId);
  const { colorOf } = useLineLookup(householdId);
  const logView = useLogView(householdId);

  const mine = views.filter((v) => v.habit.owner_id === userId && v.progress.due);
  const met = mine.filter((v) => v.progress.met).length;
  // Primero lo que falta.
  const shown = [...mine].sort((a, b) => Number(a.progress.met) - Number(b.progress.met)).slice(0, MAX_RINGS);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mine.length ? `Hábitos: ${met} de ${mine.length} cumplidos hoy` : 'Hábitos'}
      accessibilityHint="Abre la pestaña Hábitos"
      onPress={() => router.navigate('/habitos')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.rule, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text variant="plate" tone="muted">
        Hábitos
      </Text>
      {isPending ? (
        <Text variant="figure" style={styles.figure}>
          …
        </Text>
      ) : mine.length === 0 ? (
        <>
          <Text variant="figure" style={styles.figure}>
            —
          </Text>
          <Text variant="caption" tone="subtle">
            {views.some((v) => v.habit.owner_id === userId) ? 'Hoy no toca ninguno' : 'Crea tu primer hábito'}
          </Text>
        </>
      ) : (
        <>
          <Text variant="figure" style={styles.figure}>
            {met}/{mine.length}
          </Text>
          <View style={styles.rings}>
            {shown.map((v) => (
              <Pressable
                key={v.habit.id}
                accessibilityRole="button"
                accessibilityLabel={`${v.habit.name}: ${progressText(v)}. Toca para sumar uno`}
                onPress={() => logView(v, today, 1)}
                hitSlop={4}
              >
                <HabitRing
                  size={40}
                  color={colorOf(v.habit.owner_id)}
                  fraction={v.progress.fraction}
                  todayIndex={-1}
                  center={v.progress.met ? '✓' : String(v.progress.amount)}
                />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space.xs,
  },
  figure: {
    fontSize: 24,
    lineHeight: 30,
  },
  rings: {
    flexDirection: 'row',
    gap: space.xs + 2,
    marginTop: space.xs,
  },
});
