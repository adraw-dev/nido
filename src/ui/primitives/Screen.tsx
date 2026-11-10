import { HeaderHeightContext } from 'expo-router/react-navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { space } from '../tokens';

/** Margen entre el campo enfocado y el borde superior del teclado. */
const KEYBOARD_GAP = 24;

type KeyboardAware = { revealFocused: () => void };
const KeyboardAwareContext = createContext<KeyboardAware>({ revealFocused: () => {} });

/** Para campos propios: pedir que el campo enfocado quede a la vista. */
export function useRevealFocused() {
  return useContext(KeyboardAwareContext).revealFocused;
}

export type ScreenProps = {
  children: ReactNode;
  /** Envuelve el contenido en un ScrollView (formularios y listas cortas). */
  scroll?: boolean;
  /** Bordes con área segura. Dentro de pestañas o con encabezado, solo 'top' o ninguno. */
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Contenido fijo debajo del scroll (por ejemplo, un botón principal): queda sobre el teclado. */
  footer?: ReactNode;
};

/**
 * Pantalla base. Con el modo de borde a borde de Android (SDK 58) la ventana
 * ya no se encoge con el teclado, así que aquí se compensa en ambas
 * plataformas y el campo enfocado se desplaza a la vista.
 */
export function Screen({ children, scroll = false, edges = ['top', 'bottom'], contentStyle, footer }: ScreenProps) {
  const { colors } = useTheme();
  // Altura de la barra superior si la pantalla tiene una (0 en pestañas y auth).
  const headerHeight = useContext(HeaderHeightContext) ?? 0;

  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealFocused = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    // Espera a que el KeyboardAvoidingView reacomode el espacio.
    timer.current = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const inner = scrollRef.current?.getInnerViewRef();
      if (!input || !inner || !Keyboard.isVisible()) return;
      input.measureLayout(
        inner,
        (_x, y, _w, h) => {
          const top = offset.current;
          const bottom = top + viewport.current;
          if (y + h + KEYBOARD_GAP > bottom) {
            scrollRef.current?.scrollTo({ y: y + h + KEYBOARD_GAP - viewport.current, animated: true });
          } else if (y - KEYBOARD_GAP < top) {
            scrollRef.current?.scrollTo({ y: Math.max(0, y - KEYBOARD_GAP), animated: true });
          }
        },
        () => {},
      );
    }, 120);
  }, []);

  useEffect(() => {
    if (!scroll) return;
    const sub = Keyboard.addListener('keyboardDidShow', revealFocused);
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scroll, revealFocused]);

  const aware = useMemo(() => ({ revealFocused }), [revealFocused]);

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={32}
      onScroll={(e) => {
        offset.current = e.nativeEvent.contentOffset.y;
      }}
      onLayout={(e) => {
        viewport.current = e.nativeEvent.layout.height;
      }}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <KeyboardAwareContext.Provider value={aware}>
      <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.bg }]}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={headerHeight}>
          {body}
          {footer ? <View style={[styles.footer, { backgroundColor: colors.bg }]}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </KeyboardAwareContext.Provider>
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
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.sm,
  },
});
