import { EmptyState, ModuleScreen } from '@/ui';

export default function HabitsScreen() {
  return (
    <ModuleScreen title="Hábitos">
      <EmptyState
        title="Todavía no hay hábitos"
        caption="Cada hábito será una línea circular de la semana. Los tuyos son privados."
      />
    </ModuleScreen>
  );
}
