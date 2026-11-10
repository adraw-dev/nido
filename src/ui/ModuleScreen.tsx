import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from './primitives/Screen';
import { Text } from './primitives/Text';
import { space } from './tokens';

/** Estructura común de las pestañas de módulo: título grande y contenido. */
export function ModuleScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen scroll edges={['top']}>
      <View style={styles.header}>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
});
