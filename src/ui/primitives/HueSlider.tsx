import { useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../theme';
import { hueColor, inkOn, radius, touchTarget } from '../tokens';

export type HueSliderProps = {
  /** Tono 0–359. */
  value: number;
  /** Mientras se arrastra (vista previa). */
  onChange?: (hue: number) => void;
  /** Al soltar: el tono elegido. */
  onCommit: (hue: number) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

const STEPS = 12;
const BAR = 28;
const THUMB = 36;

/**
 * Barra de arcoíris para elegir un tono. El color se pinta con el mismo brillo
 * que tendrá la línea (claro u oscuro), así se ve exactamente lo que queda.
 */
export function HueSlider({ value, onChange, onCommit, disabled, accessibilityLabel = 'Tono del color' }: HueSliderProps) {
  const { colors, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const [dragHue, setDragHue] = useState<number | null>(null);
  const last = useRef(value);
  const hue = dragHue ?? value;
  const usable = Math.max(1, width - THUMB);

  const hueAt = (e: GestureResponderEvent) => {
    const x = Math.min(Math.max(e.nativeEvent.locationX - THUMB / 2, 0), usable);
    return Math.round((x / usable) * 359);
  };
  const move = (e: GestureResponderEvent) => {
    const h = hueAt(e);
    last.current = h;
    setDragHue(h);
    onChange?.(h);
  };
  const end = () => {
    if (dragHue === null) return;
    setDragHue(null);
    onCommit(last.current);
  };
  const step = (delta: number) => onCommit((((value + delta) % 360) + 360) % 360);

  const thumbColor = hueColor(hue, scheme);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 359, now: hue }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 15 : -15)}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={move}
      onResponderMove={move}
      onResponderRelease={end}
      onResponderTerminate={end}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {width > 0 ? (
          <Svg width={width} height={touchTarget}>
            <Defs>
              <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
                {Array.from({ length: STEPS + 1 }, (_, i) => (
                  <Stop key={i} offset={i / STEPS} stopColor={hueColor((i / STEPS) * 359, scheme)} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect
              x={THUMB / 2 - BAR / 2}
              y={(touchTarget - BAR) / 2}
              width={width - THUMB + BAR}
              height={BAR}
              rx={BAR / 2}
              fill="url(#hue)"
            />
          </Svg>
        ) : null}
        <View
          style={[
            styles.thumb,
            {
              left: (hue / 359) * usable,
              backgroundColor: thumbColor,
              borderColor: colors.surface,
              shadowColor: colors.ink,
            },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: inkOn(thumbColor) }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: touchTarget,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    top: (touchTarget - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    opacity: 0.8,
  },
});
