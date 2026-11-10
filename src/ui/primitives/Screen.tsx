import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { space } from '../tokens';

export type ScreenProps = {
  children: ReactNode;
  /** Envuelve el contenido en un ScrollView (formularios y listas cortas). */
  scroll?: boolean;
  /** Bordes con área segura. Dentro de pestañas o con encabezado, solo 'top' o ninguno. */
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Contenido fijo debajo del scroll (por ejemplo, un botón principal). */
  footer?: ReactNode;
};

export function Screen({ children, scroll = false, edges = ['top', 'bottom'], contentStyle, footer }: ScreenProps) {
  const { colors } = useTheme();

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: space.xl - 4,
    paddingVertical: space.lg,
    gap: space.lg,
  },
  footer: {
    paddingHorizontal: space.xl - 4,
    paddingBottom: space.lg,
    gap: space.sm,
  },
});
