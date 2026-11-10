import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { queryClient } from '@/lib/query';
import { supabase } from '@/lib/supabase';

type SessionState = {
  session: Session | null;
  /** true mientras se lee la sesión guardada en el dispositivo. */
  loading: boolean;
};

const SessionContext = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setState({ session: data.session, loading: false });
      })
      .catch(() => {
        if (active) setState({ session: null, loading: false });
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') queryClient.clear();
      setState({ session, loading: false });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

/** Id del usuario con sesión. Solo usar dentro de rutas protegidas. */
export function useUserId(): string {
  const { session } = useSession();
  if (!session) throw new Error('useUserId se usó sin sesión activa');
  return session.user.id;
}
