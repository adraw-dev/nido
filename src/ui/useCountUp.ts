import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from './motion';
import { motion } from './tokens';

/**
 * Cifra que cuenta rápido hasta su nuevo valor (por ejemplo, el total del mes
 * al registrar un gasto). Con "quitar animaciones", cambia de una vez.
 */
export function useCountUp(value: number, duration: number = motion.slow * 2): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduced || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      setShown(start + (value - start) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, duration, reduced]);

  return shown;
}
