import { z } from 'zod';

const normalizedEmail = z
  .string()
  .trim()
  .email('Ingresa un correo válido.')
  .transform((value) => value.toLowerCase());

export const signInSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(1, 'Ingresa tu contraseña.').max(1024),
});

export const passwordResetRequestSchema = z.object({
  email: normalizedEmail,
});

export const passwordUpdateSchema = z.object({
  password: z.string().min(12, 'La nueva contraseña debe tener al menos 12 caracteres.').max(1024),
});

export type SignInInput = z.input<typeof signInSchema>;
export type PasswordResetRequest = z.input<typeof passwordResetRequestSchema>;
export type PasswordUpdate = z.input<typeof passwordUpdateSchema>;
