import { supabase } from '@/lib/supabase';

/** Traduce los errores de Supabase Auth que la pareja puede ver. */
export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (lower.includes('already registered') || lower.includes('already been registered'))
    return 'Ese correo ya tiene una cuenta. Entra con tu contraseña.';
  if (lower.includes('email not confirmed')) return 'Confirma tu correo antes de entrar.';
  if (lower.includes('password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (lower.includes('rate limit') || lower.includes('too many'))
    return 'Demasiados intentos. Espera un minuto y vuelve a intentar.';
  if (lower.includes('network') || lower.includes('fetch'))
    return 'Sin conexión con el servidor. Revisa tu internet.';
  return message || 'Algo salió mal. Intenta de nuevo.';
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/** Devuelve true si la cuenta quedó con sesión; false si Supabase pide confirmar el correo. */
export async function signUp(email: string, password: string, displayName: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName.trim() } },
  });
  if (error) throw error;
  return data.session !== null;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  // Si el servidor rechaza (usuario borrado, sin red), igual se borra la sesión del celular.
  if (error) await supabase.auth.signOut({ scope: 'local' });
}
