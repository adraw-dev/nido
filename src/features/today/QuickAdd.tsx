import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { useVehicles } from '@/features/vehicles/hooks';
import { Fab, Text, radius, space, useTheme } from '@/ui';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Action = { key: string; label: string; icon: IconName; href: Href };

/**
 * Agregar rápido desde Hoy: el + se abre en las acciones de los cuatro módulos.
 * Las animaciones de Reanimated respetan "quitar animaciones" del sistema.
 */
export function QuickAdd({ householdId }: { householdId: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const vehicles = useVehicles(householdId);

  // El botón Atrás del sistema cierra el menú antes de salir.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  const actions: Action[] = [
    { key: 'tarea', label: 'Tarea', icon: 'checkbox-marked-circle-plus-outline', href: '/tareas/nueva' },
    { key: 'gasto', label: 'Gasto', icon: 'cash', href: { pathname: '/dinero/nuevo', params: { kind: 'expense' } } },
    { key: 'ingreso', label: 'Ingreso', icon: 'cash-plus', href: { pathname: '/dinero/nuevo', params: { kind: 'income' } } },
    { key: 'habito', label: 'Hábito', icon: 'sprout-outline', href: '/habitos/nuevo' },
    ...(vehicles.data?.length
      ? [{ key: 'vehiculo', label: 'Gasto de vehículo', icon: 'car-wrench' as IconName, href: '/garaje/registro/nuevo' as Href }]
      : []),
  ];

  function go(href: Href) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {open ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={[styles.scrim, { backgroundColor: colors.scrim }]}>
          <Pressable accessibilityLabel="Cerrar menú" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.menu} accessibilityRole="menu">
            {actions.map((a, i) => (
              <Animated.View key={a.key} entering={FadeInDown.duration(180).delay((actions.length - 1 - i) * 30)}>
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityLabel={`Agregar ${a.label.toLowerCase()}`}
                  onPress={() => go(a.href)}
                  style={({ pressed }) => [styles.item, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={[styles.itemLabel, { backgroundColor: colors.surface }]}>
                    <Text variant="label">{a.label}</Text>
                  </View>
                  <View style={[styles.itemIcon, { backgroundColor: colors.surface }]}>
                    <MaterialCommunityIcons name={a.icon} size={22} color={colors.trunk} />
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      ) : null}
      <Fab label={open ? 'Cerrar' : 'Agregar'} icon={open ? 'close' : 'plus'} expanded={open} onPress={() => setOpen((o) => !o)} />
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  menu: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg + 56 + space.md,
    alignItems: 'flex-end',
    gap: space.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
  },
  itemLabel: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    elevation: 2,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    elevation: 2,
  },
});
