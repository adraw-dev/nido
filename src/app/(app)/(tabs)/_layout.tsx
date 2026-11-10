import { Tabs } from 'expo-router/js-tabs';

import { TabBar, type TabIcons } from '@/ui/TabBar';

const icons: TabIcons = {
  index: { active: 'home-variant', inactive: 'home-variant-outline' },
  tareas: { active: 'checkbox-marked-circle', inactive: 'checkbox-marked-circle-outline' },
  habitos: { active: 'sprout', inactive: 'sprout-outline' },
  dinero: { active: 'wallet', inactive: 'wallet-outline' },
  garaje: { active: 'car', inactive: 'car-outline' },
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} icons={icons} />}>
      <Tabs.Screen name="index" options={{ title: 'Hoy' }} />
      <Tabs.Screen name="tareas" options={{ title: 'Tareas' }} />
      <Tabs.Screen name="habitos" options={{ title: 'Hábitos' }} />
      <Tabs.Screen name="dinero" options={{ title: 'Dinero' }} />
      <Tabs.Screen name="garaje" options={{ title: 'Garaje' }} />
    </Tabs>
  );
}
