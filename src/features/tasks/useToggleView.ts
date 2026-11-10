import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

import { useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';

import { taskErrorMessage } from './api';
import type { TaskView } from './derive';
import { useToggleTask } from './hooks';

/**
 * Tocar una estación: completa la ocurrencia vigente o la deshace.
 * Solo quien cumplió puede deshacer (lo exige la RLS); a los demás se les explica.
 */
export function useToggleView(householdId: string) {
  const userId = useUserId();
  const { nameOf } = useLineLookup(householdId);
  const toggle = useToggleTask(householdId);

  return (view: TaskView) => {
    const done = view.state === 'done' && !!view.completion;
    if (done && view.completion!.completed_by !== userId) {
      const who = nameOf(view.completion!.completed_by);
      Alert.alert('Ya está hecha', `La completó ${who}. Solo ${who} puede deshacerla.`);
      return;
    }
    if (done) {
      Haptics.selectionAsync().catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    toggle.mutate(
      { taskId: view.task.id, occurrenceOn: view.occurrenceOn, done },
      { onError: (e) => Alert.alert('No se pudo guardar', taskErrorMessage(e)) },
    );
  };
}
