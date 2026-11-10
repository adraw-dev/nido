import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/session/SessionProvider';
import { accentFor, type AccentKey } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import {
  createHousehold,
  createInvite,
  fetchMembers,
  fetchMyMembership,
  joinHousehold,
  updateAccent,
} from './api';

export const householdKeys = {
  mine: (userId: string) => ['household', 'mine', userId] as const,
  members: (householdId: string) => ['household', householdId, 'members'] as const,
};

export function useMyMembership() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: householdKeys.mine(userId ?? 'anon'),
    queryFn: () => fetchMyMembership(userId!),
    enabled: !!userId,
  });
}

/** Hogar actual. Solo dentro de (app), donde el layout raíz garantiza que existe. */
export function useCurrentHousehold() {
  const { data } = useMyMembership();
  if (!data) throw new Error('useCurrentHousehold se usó fuera de un hogar');
  return data;
}

export function useMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: householdKeys.members(householdId ?? 'none'),
    queryFn: () => fetchMembers(householdId!),
    enabled: !!householdId,
  });
}

/** Integrantes con su color de línea ya resuelto para el esquema actual. */
export function useMemberLines(householdId: string | undefined) {
  const { scheme } = useTheme();
  const query = useMembers(householdId);
  const lines = (query.data ?? []).map((m, i) => ({
    ...m,
    color: accentFor(m.profile.accent, i, scheme),
    firstName: m.profile.display_name.trim().split(/\s+/)[0],
  }));
  return { ...query, lines };
}

/**
 * Color y nombre de cada línea: un integrante (por id) o el tronco compartido.
 * Si alguien ya no está en el hogar, se dibuja en gris.
 */
export function useLineLookup(householdId: string | undefined) {
  const { colors } = useTheme();
  const { lines } = useMemberLines(householdId);
  const trunkName = lines.length === 2 ? 'Los dos' : lines.length > 2 ? 'Todos' : 'Compartido';
  return {
    lines,
    trunkName,
    colorOf: (id: string | 'trunk' | null | undefined) =>
      id === 'trunk' || !id ? colors.trunk : (lines.find((l) => l.user_id === id)?.color ?? colors.inkSubtle),
    nameOf: (id: string | 'trunk' | null | undefined) =>
      id === 'trunk' || !id ? trunkName : (lines.find((l) => l.user_id === id)?.firstName ?? 'Alguien'),
  };
}

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createHousehold,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household', 'mine'] }),
  });
}

export function useJoinHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: joinHousehold,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household', 'mine'] }),
  });
}

export function useCreateInvite() {
  return useMutation({ mutationFn: createInvite });
}

export function useUpdateAccent(householdId: string | undefined) {
  const qc = useQueryClient();
  const { session } = useSession();
  return useMutation({
    mutationFn: (accent: AccentKey) => updateAccent(session!.user.id, accent),
    onSuccess: () => {
      if (householdId) qc.invalidateQueries({ queryKey: householdKeys.members(householdId) });
    },
  });
}
