import { z } from 'zod';

export const emailSchema = z.string().trim().email('Escribe un correo válido.');
export const passwordSchema = z.string().min(6, 'Mínimo 6 caracteres.');
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Escribe tu nombre.')
  .max(40, 'Máximo 40 caracteres.');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Escribe tu contraseña.'),
});

export const signUpSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

/** Primer mensaje de error por campo. */
export function fieldErrors<T extends string>(error: z.ZodError): Partial<Record<T, string>> {
  const out: Partial<Record<T, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as T;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
