import { supabase } from '@/lib/supabase';
import type { AccentKey } from '@/ui/tokens';

import type { Household, Invite, Member, Membership } from './types';

/** El hogar del usuario (el MVP asume uno por persona). null si aún no tiene. */
export async function fetchMyMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('role, household:households(*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as unknown as Membership;
}

/** Integrantes en orden de llegada: ese orden asigna el color por defecto. */
export async function fetchMembers(householdId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at, profile:profiles(id, display_name, avatar_path, accent)')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Member[];
}

export async function createHousehold(name: string): Promise<Household> {
  const { data, error } = await supabase.rpc('create_household', { p_name: name.trim() });
  if (error) throw error;
  return data as Household;
}

export async function joinHousehold(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_household', { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return data as string;
}

export async function createInvite(householdId: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('household_invites')
    .insert({ household_id: householdId })
    .select('code, expires_at')
    .single();
  if (error) throw error;
  return data as Invite;
}

export async function updateAccent(userId: string, accent: AccentKey) {
  const { error } = await supabase.from('profiles').update({ accent }).eq('id', userId);
  if (error) throw error;
}

/** Errores de las RPC de hogar en palabras de la pareja. */
export function householdErrorMessage(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message.includes('Código inválido')) return 'Ese código no existe, ya se usó o venció. Pide uno nuevo.';
  if (message.includes('Cuenta no encontrada') || message.includes('created_by_fkey') || message.includes('user_id_fkey'))
    return 'Tu sesión es de una cuenta que ya no existe. Toca "Cerrar sesión" y crea la cuenta de nuevo.';
  if (message.toLowerCase().includes('fetch')) return 'Sin conexión con el servidor. Revisa tu internet.';
  if (message.includes('violates check constraint')) return 'Revisa el nombre: entre 1 y 60 caracteres.';
  return message || 'Algo salió mal. Intenta de nuevo.';
}
