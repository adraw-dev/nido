import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayKey, type DateKey } from './dates';

/** Día actual; se actualiza al volver a la app y al pasar la medianoche. */
export function useToday(): DateKey {
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    const refresh = () => setToday((prev) => (prev === todayKey() ? prev : todayKey()));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    const timer = setInterval(refresh, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  return today;
}
