import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { BRAND, MARK, MARK_LENGTHS } from './metro/markGeometry';
import { easing, useReducedMotion } from './motion';
import { Text } from './primitives/Text';
import { useTheme } from './theme';
import { fonts } from './tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Tamaño del logo: igual al splash nativo (imageWidth 160 en app.json). */
const BOX = 160;
/** Unidades de la marca por cada 160 dp del splash nativo (escala 17 sobre 1024 px). */
const UNITS = (BOX * 1024) / (17 * BOX);
const VIEWBOX = `${MARK.center.x - UNITS / 2} ${MARK.center.y - UNITS / 2} ${UNITS} ${UNITS}`;
const RAILS = 0.3;

/** Tiempos (ms): las líneas se llenan, el tronco baja, la estación se cierra y aparece el título. */
const T = { sides: 520, trunkDelay: 380, trunk: 300, stationDelay: 620, station: 240, titleDelay: 700, title: 300 };
const TOTAL = T.titleDelay + T.title;

/**
 * Inicio animado: arranca igual que el splash nativo (rieles tenues) y llena
 * las líneas de color hasta formar la marca, con "Nido" debajo. Se queda hasta
 * que la app está lista y luego se desvanece. Con "quitar animaciones", aparece
 * completo y se va sin animación.
 */
export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [drawn, setDrawn] = useState(false);
  const hidden = useRef(false);

  const sides = useSharedValue(0);
  const trunk = useSharedValue(0);
  const station = useSharedValue(0);
  const title = useSharedValue(0);
  const overlay = useSharedValue(1);

  useEffect(() => {
    const d = (ms: number) => (reduced ? 0 : ms);
    sides.value = withTiming(1, { duration: d(T.sides), easing: easing.emphasizedDecelerate });
    trunk.value = withDelay(d(T.trunkDelay), withTiming(1, { duration: d(T.trunk), easing: easing.standard }));
    station.value = withDelay(d(T.stationDelay), withTiming(1, { duration: d(T.station), easing: easing.standard }));
    title.value = withDelay(d(T.titleDelay), withTiming(1, { duration: d(T.title), easing: easing.emphasizedDecelerate }));
    const timer = setTimeout(() => setDrawn(true), d(TOTAL));
    return () => clearTimeout(timer);
  }, [reduced, sides, trunk, station, title]);

  // Cuando terminó de dibujarse y la app está lista, se desvanece.
  useEffect(() => {
    if (!drawn || !ready) return;
    const fade = reduced ? 0 : 250;
    overlay.value = withTiming(0, { duration: fade });
    const timer = setTimeout(onDone, fade + 20);
    return () => clearTimeout(timer);
  }, [drawn, ready, reduced, overlay, onDone]);

  const sideProps = useAnimatedProps(() => ({ strokeDashoffset: MARK_LENGTHS.side * (1 - sides.value) }));
  const trunkProps = useAnimatedProps(() => ({ strokeDashoffset: MARK_LENGTHS.trunk * (1 - trunk.value) }));
  const stationProps = useAnimatedProps(() => ({ strokeDashoffset: MARK_LENGTHS.station * (1 - station.value) }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{ translateY: (1 - title.value) * 8 }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));

  const s = MARK.station;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.bg }, overlayStyle]}
      onLayout={() => {
        // Ya está pintado el mismo punto de partida: se puede quitar el splash nativo.
        if (hidden.current) return;
        hidden.current = true;
        SplashScreen.hideAsync().catch(() => {});
      }}
      accessible
      accessibilityLabel="Nido"
      accessibilityState={{ busy: !ready }}
    >
      <View style={styles.box}>
        <Svg width={BOX} height={BOX} viewBox={VIEWBOX}>
          {/* Rieles tenues: idénticos al splash nativo. La opacidad va en el grupo
              para que los cruces no se oscurezcan. */}
          <G opacity={RAILS}>
            <Path d={MARK.left} stroke={BRAND.naranja} strokeWidth={MARK.lineWidth} strokeLinecap="round" fill="none" />
            <Path d={MARK.right} stroke={BRAND.verdeAzulado} strokeWidth={MARK.lineWidth} strokeLinecap="round" fill="none" />
            <Path d={MARK.trunk} stroke={BRAND.tronco} strokeWidth={MARK.trunkWidth} strokeLinecap="round" fill="none" />
            <Circle cx={s.cx} cy={s.cy} r={s.r} fill="none" stroke={BRAND.tronco} strokeWidth={s.stroke} />
          </G>

          {/* Las líneas se llenan de color. */}
          <AnimatedPath
            d={MARK.left}
            stroke={BRAND.naranja}
            strokeWidth={MARK.lineWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={[MARK_LENGTHS.side, MARK_LENGTHS.side]}
            animatedProps={sideProps}
          />
          <AnimatedPath
            d={MARK.right}
            stroke={BRAND.verdeAzulado}
            strokeWidth={MARK.lineWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={[MARK_LENGTHS.side, MARK_LENGTHS.side]}
            animatedProps={sideProps}
          />
          <AnimatedPath
            d={MARK.trunk}
            stroke={BRAND.tronco}
            strokeWidth={MARK.trunkWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={[MARK_LENGTHS.trunk, MARK_LENGTHS.trunk]}
            animatedProps={trunkProps}
          />
          <AnimatedCircle
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="none"
            stroke={BRAND.tronco}
            strokeWidth={s.stroke}
            strokeDasharray={[MARK_LENGTHS.station, MARK_LENGTHS.station]}
            animatedProps={stationProps}
            // Empieza arriba, donde llega el tronco.
            rotation={-90}
            origin={`${s.cx}, ${s.cy}`}
          />
        </Svg>
        <Animated.View style={[styles.title, titleStyle]}>
          <Text style={[styles.titleText, { color: colors.ink }]}>Nido</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  box: {
    width: BOX,
    height: BOX,
  },
  title: {
    position: 'absolute',
    top: BOX + 8,
    left: -40,
    right: -40,
    alignItems: 'center',
  },
  titleText: {
    fontFamily: fonts.displayHeavy,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
});
