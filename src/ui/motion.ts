import { Easing, useReducedMotion } from 'react-native-reanimated';

import { motion } from './tokens';

/** Curvas de Material 3. */
export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  emphasizedDecelerate: Easing.bezier(0.05, 0.7, 0.1, 1),
  emphasizedAccelerate: Easing.bezier(0.3, 0, 0.8, 0.15),
};

/**
 * Duración que respeta "quitar animaciones" del sistema: con el ajuste
 * activo el cambio es instantáneo.
 */
export function useMotionDuration(ms: number = motion.base): number {
  const reduced = useReducedMotion();
  return reduced ? 0 : ms;
}

export { useReducedMotion };
