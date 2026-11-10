import { router } from 'expo-router';

import { useCurrentHousehold } from '@/features/household/hooks';
import { taskErrorMessage } from '@/features/tasks/api';
import { TaskForm } from '@/features/tasks/components/TaskForm';
import { useSaveTask } from '@/features/tasks/hooks';

export default function NewTaskScreen() {
  const { household } = useCurrentHousehold();
  const save = useSaveTask(household.id);

  return (
    <TaskForm
      householdId={household.id}
      submitLabel="Crear tarea"
      submitting={save.isPending}
      error={save.isError ? taskErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ input }, { onSuccess: () => router.back() })}
    />
  );
}
