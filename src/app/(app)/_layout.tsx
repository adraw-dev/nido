import { Stack } from 'expo-router';

import { useHabitRealtime } from '@/features/habits/hooks';
import { useCurrentHousehold } from '@/features/household/hooks';
import { useTaskRealtime } from '@/features/tasks/hooks';
import { fonts, useTheme } from '@/ui';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function AppLayout() {
  const { colors } = useTheme();
  const { household } = useCurrentHousehold();
  // Lo que hace la pareja aparece en segundos.
  useTaskRealtime(household.id);
  useHabitRealtime(household.id);

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 20 },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="hogar" options={{ title: 'Hogar' }} />
      <Stack.Screen name="tareas/nueva" options={{ title: 'Nueva tarea', presentation: 'modal' }} />
      <Stack.Screen name="tareas/[id]" options={{ title: '' }} />
      <Stack.Screen name="tareas/[id]/editar" options={{ title: 'Editar tarea', presentation: 'modal' }} />
      <Stack.Screen name="habitos/nuevo" options={{ title: 'Nuevo hábito', presentation: 'modal' }} />
      <Stack.Screen name="habitos/[id]" options={{ title: '' }} />
      <Stack.Screen name="habitos/[id]/editar" options={{ title: 'Editar hábito', presentation: 'modal' }} />
    </Stack>
  );
}
