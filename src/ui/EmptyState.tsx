import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Station } from './metro/Station';
import { Text } from './primitives/Text';
import { useTheme } from './theme';
import { metro, space } from './tokens';

export type EmptyStateProps = {
  title: string;
  caption: string;
  color?: string;
};

/** Estado vacío: un tramo de línea por construir, con estaciones aún sin abrir. */
export function EmptyState({ title, caption, color }: EmptyStateProps) {
  const { colors } = useTheme();
  const c = color ?? colors.trunk;
  return (
    <View style={styles.wrap}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={40} height={150}>
          <Path d="M20 8 L20 58" stroke={c} strokeWidth={metro.lineWidth} strokeLinecap="round" />
          <Path
            d="M20 58 L20 142"
            stroke={c}
            strokeOpacity={0.3}
            strokeWidth={metro.lineWidth}
            strokeLinecap="round"
            strokeDasharray={[2, 12]}
          />
          <Station cx={20} cy={30} color={c} state="done" />
          <Station cx={20} cy={96} color={colors.inkSubtle} state="pending" />
        </Svg>
      </View>
      <View style={styles.text}>
        <Text variant="title">{title}</Text>
        <Text tone="muted">{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: space.lg,
    alignItems: 'flex-start',
  },
  text: {
    flex: 1,
    gap: space.xs,
    paddingTop: 18,
  },
});
