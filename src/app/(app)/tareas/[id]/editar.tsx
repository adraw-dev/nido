import { router, useLocalSearchParams } from 'expo-router';

import { useCurrentHousehold } from '@/features/household/hooks';
import { taskErrorMessage } from '@/features/tasks/api';
import { TaskForm } from '@/features/tasks/components/TaskForm';
import { useSaveTask, useTask } from '@/features/tasks/hooks';
import { Screen, Text } from '@/ui';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useCurrentHousehold();
  const task = useTask(household.id, id);
  const save = useSaveTask(household.id);

  if (!task.data) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{task.isPending ? 'Cargando…' : 'Esta tarea ya no existe.'}</Text>
      </Screen>
    );
  }

  return (
    <TaskForm
      householdId={household.id}
      initial={task.data}
      submitLabel="Guardar cambios"
      submitting={save.isPending}
      error={save.isError ? taskErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ id, input }, { onSuccess: () => router.back() })}
    />
  );
}
