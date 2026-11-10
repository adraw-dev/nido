import { EmptyState, ModuleScreen } from '@/ui';

export default function MoneyScreen() {
  return (
    <ModuleScreen title="Dinero">
      <EmptyState
        title="Todavía no hay movimientos"
        caption="Ingresos, gastos y ahorros del hogar, cada uno firmado con el color de quien lo registró."
      />
    </ModuleScreen>
  );
}
