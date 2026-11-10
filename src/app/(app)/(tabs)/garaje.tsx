import { EmptyState, ModuleScreen } from '@/ui';

export default function GarageScreen() {
  return (
    <ModuleScreen title="Garaje">
      <EmptyState
        title="Todavía no hay vehículos"
        caption="Cada vehículo tendrá su línea de kilometraje con el próximo mantenimiento como siguiente estación."
      />
    </ModuleScreen>
  );
}
