import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { BRAND, ROUTE, ROUTE_END, WORDMARK, type RoutePiece } from './metro/markGeometry';
import { useReducedMotion } from './motion';
import { useTheme } from './theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Tamaño del logo: igual al splash nativo (imageWidth 160 en app.json). */
const BOX = 160;
/** Unidades del logotipo por cada 160 dp del splash nativo (escala 4,5 sobre 1024 px). */
const UNITS = 1024 / 4.5;
const VIEWBOX = `${WORDMARK.center.x - UNITS / 2} ${WORDMARK.center.y - UNITS / 2} ${UNITS} ${UNITS}`;
const RAILS = 0.3;

/** Velocidad del "tren" (unidades por ms) y tiempos del ciclo de carga. */
const SPEED = 0.33;
const DRAW_MS = ROUTE_END / SPEED;
const HOLD_MS = 450;
const ERASE_MS = DRAW_MS * 0.75;
const REWIND_MS = 250;
/** Distancia en la que una estación termina de aparecer. */
const POP = 30;
const travel = Easing.bezier(0.35, 0, 0.65, 1);

type Phase = 'draw' | 'hold' | 'erase' | 'done';

/**
 * Inicio animado y pantalla de carga: arranca igual que el splash nativo
 * (rieles tenues de "NIDO") y un tren recorre la ruta llenándola de color,
 * abriendo cada transbordo al pasar. Si la app todavía no está lista, la ruta
 * se vacía desde el origen y se vuelve a recorrer. Siempre termina con el logo
 * completo antes de desvanecerse. Con "quitar animaciones", aparece completo y
 * se va sin animación.
 */
export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [finished, setFinished] = useState(false);
  const hidden = useRef(false);
  const readyRef = useRef(ready);
  const phase = useRef<Phase>('draw');

  /** Distancia recorrida por la punta de la línea y por su cola. */
  const head = useSharedValue(0);
  const tail = useSharedValue(0);
  /** 1 cuando las estaciones ya aparecieron (se quedan en los siguientes ciclos). */
  const stations = useSharedValue(0);
  const overlay = useSharedValue(1);

  useEffect(() => {
    readyRef.current = ready;
    // Si llega en plena vaciada, la ruta se rebobina y se termina.
    if (ready && phase.current === 'erase') {
      phase.current = 'done';
      cancelAnimation(tail);
      tail.set(withTiming(0, { duration: REWIND_MS, easing: travel }, (done) => {
        if (done) scheduleOnRN(setFinished, true);
      }));
    }
  }, [ready, tail]);

  useEffect(() => {
    if (reduced) {
      phase.current = 'done';
      head.set(ROUTE_END);
      stations.set(1);
      return;
    }

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const draw = () => {
      if (!alive) return;
      phase.current = 'draw';
      tail.set(0);
      head.set(0);
      head.set(withTiming(ROUTE_END, { duration: DRAW_MS, easing: travel }, (done) => {
        if (done) scheduleOnRN(afterDraw);
      }));
    };

    const afterDraw = () => {
      if (!alive) return;
      stations.set(1);
      if (readyRef.current) {
        phase.current = 'done';
        setFinished(true);
        return;
      }
      phase.current = 'hold';
      timer = setTimeout(erase, HOLD_MS);
    };

    const erase = () => {
      if (!alive) return;
      if (readyRef.current) {
        phase.current = 'done';
        setFinished(true);
        return;
      }
      phase.current = 'erase';
      tail.set(withTiming(ROUTE_END, { duration: ERASE_MS, easing: travel }, (done) => {
        if (done) scheduleOnRN(draw);
      }));
    };

    draw();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      cancelAnimation(head);
      cancelAnimation(tail);
    };
  }, [reduced, head, tail, stations]);

  // Con el logo completo y la app lista, se desvanece (sin animaciones, en cuanto está lista).
  const leaving = reduced ? ready : finished;
  useEffect(() => {
    if (!leaving) return;
    const fade = reduced ? 0 : 250;
    overlay.set(withTiming(0, { duration: fade }));
    const timer = setTimeout(onDone, fade + 20);
    return () => clearTimeout(timer);
  }, [leaving, reduced, overlay, onDone]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const { origin, transfer } = WORDMARK;

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
            {ROUTE.map((p) => (
              <Path
                key={p.key}
                d={p.d}
                stroke={BRAND[p.color]}
                strokeWidth={WORDMARK.lineWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </G>

          {ROUTE.map((p) => (
            <RouteLine key={p.key} piece={p} head={head} tail={tail} />
          ))}

          <RingStation
            at={origin.at}
            head={head}
            shown={stations}
            cx={origin.cx}
            cy={origin.cy}
            r={origin.r}
            width={origin.stroke}
            fill={colors.bg}
            stroke={BRAND.naranja}
          />
          {WORDMARK.transfers.map((s) => (
            <CapsuleStation
              key={s.cx}
              at={s.at}
              head={head}
              shown={stations}
              cx={s.cx}
              cy={s.cy}
              w={transfer.w}
              h={transfer.h}
              width={transfer.stroke}
              fill={colors.bg}
              stroke={colors.ink}
            />
          ))}
        </Svg>
      </View>
    </Animated.View>
  );
}

/** Un tramo de color: visible entre la cola y la punta del recorrido. */
function RouteLine({ piece, head, tail }: { piece: RoutePiece; head: SharedValue<number>; tail: SharedValue<number> }) {
  const { start, length } = piece;
  const props = useAnimatedProps(() => {
    const h = Math.min(Math.max(head.value - start, 0), length);
    const t = Math.min(Math.max(tail.value - start, 0), length);
    return {
      // Con el patrón [L, L]: al llenarse muestra [0, h]; al vaciarse, [t, L].
      strokeDashoffset: length - h - t,
      // Oculto mientras no hay tramo, para que la punta redonda no deje un punto.
      opacity: h > 0 && t < length ? 1 : 0,
    };
  });
  return (
    <AnimatedPath
      d={piece.d}
      stroke={BRAND[piece.color]}
      strokeWidth={WORDMARK.lineWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      strokeDasharray={[length, length]}
      animatedProps={props}
    />
  );
}

/** Curva con un leve rebote para que la estación "se abra". */
function backOut(k: number) {
  'worklet';
  const c1 = 1.70158;
  const x = k - 1;
  return 1 + (c1 + 1) * x * x * x + c1 * x * x;
}

/** Cuánto se ha abierto una estación (0 a 1, con rebote) según por dónde va la punta. */
function useOpening(at: number, head: SharedValue<number>, shown: SharedValue<number>) {
  return (): number => {
    'worklet';
    const k = Math.max(shown.value, Math.min(Math.max((head.value - at) / POP, 0), 1));
    return k >= 1 ? 1 : k <= 0 ? 0 : backOut(k);
  };
}

type StationProps = { at: number; head: SharedValue<number>; shown: SharedValue<number>; fill: string; stroke: string };

/** Estación de origen (anillo) que aparece cuando la punta de la línea pasa por ella. */
function RingStation({ cx, cy, r, width, ...p }: StationProps & { cx: number; cy: number; r: number; width: number }) {
  const opening = useOpening(p.at, p.head, p.shown);
  const props = useAnimatedProps(() => {
    const s = opening();
    return { r: r * s, strokeWidth: width * s, opacity: s > 0 ? 1 : 0 };
  });
  return <AnimatedCircle cx={cx} cy={cy} r={0} fill={p.fill} stroke={p.stroke} animatedProps={props} />;
}

/** Transbordo (cápsula) que aparece cuando la punta de la línea pasa por él. */
function CapsuleStation({
  cx,
  cy,
  w,
  h,
  width,
  ...p
}: StationProps & { cx: number; cy: number; w: number; h: number; width: number }) {
  const opening = useOpening(p.at, p.head, p.shown);
  const props = useAnimatedProps(() => {
    const s = opening();
    return {
      x: cx - (w * s) / 2,
      y: cy - (h * s) / 2,
      width: w * s,
      height: h * s,
      rx: (w * s) / 2,
      strokeWidth: width * s,
      opacity: s > 0 ? 1 : 0,
    };
  });
  return <AnimatedRect x={cx} y={cy} width={0} height={0} fill={p.fill} stroke={p.stroke} animatedProps={props} />;
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
});
