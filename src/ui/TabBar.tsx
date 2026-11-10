import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './primitives/Text';
import { useTheme } from './theme';
import { radius, space } from './tokens';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type TabIcons = Record<string, { active: IconName; inactive: IconName }>;

/** Barra de navegación inferior de Material 3 con indicador en píldora. */
export function TabBar({ state, descriptors, emitter, navigateToTab, icons }: BottomTabBarProps & { icons: TabIcons }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.rule, paddingBottom: insets.bottom + space.sm },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        const icon = icons[route.name];

        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync().catch(() => {});
            navigateToTab(route.key);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.item}
          >
            <View style={[styles.indicator, focused && { backgroundColor: colors.indicator }]}>
              {icon ? (
                <MaterialCommunityIcons
                  name={focused ? icon.active : icon.inactive}
                  size={24}
                  color={focused ? colors.ink : colors.inkMuted}
                />
              ) : null}
            </View>
            <Text
              variant="label"
              color={focused ? colors.ink : colors.inkMuted}
              style={[styles.label, focused && styles.labelActive]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    minHeight: 56,
  },
  indicator: {
    width: 64,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
  labelActive: {
    fontFamily: 'Roboto_700Bold',
  },
});
