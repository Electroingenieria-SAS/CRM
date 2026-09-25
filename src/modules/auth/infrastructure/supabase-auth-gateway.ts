import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthGateway } from '@/modules/auth/application/auth-gateway';
import {
  passwordResetRequestSchema,
  passwordUpdateSchema,
  signInSchema,
  type PasswordResetRequest,
  type PasswordUpdate,
  type SignInInput,
} from '@/modules/auth/application/auth.schemas';
import { AppError } from '@/shared/errors/app-error';

function toAuthenticationError(error: unknown): AppError {
  const message = String((error as { message?: unknown })?.message ?? '').toLowerCase();

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid_credentials') ||
    message.includes('user not found')
  ) {
    return new AppError('AUTHENTICATION', 'Correo o contraseña incorrectos.');
  }

  if (message.includes('email not confirmed')) {
    return new AppError('AUTHENTICATION', 'El correo todavía no ha sido confirmado.');
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  ) {
    return new AppError(
      'NETWORK',
      'No fue posible conectar con el CRM. Revisa tu conexión e inténtalo nuevamente.',
    );
  }

  return new AppError('AUTHENTICATION', 'No fue posible completar la autenticación.');
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async signIn(input: SignInInput) {
    const credentials = signInSchema.parse(input);
    const { data, error } = await this.client.auth.signInWithPassword(credentials);

    if (error || !data.session) throw toAuthenticationError(error);
    return data.session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw toAuthenticationError(error);
  }

  async getSession() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw toAuthenticationError(error);
    return data.session;
  }

  async requestPasswordReset(input: PasswordResetRequest, redirectTo?: string): Promise<void> {
    const { email } = passwordResetRequestSchema.parse(input);
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (error) throw toAuthenticationError(error);
  }

  async updatePassword(input: PasswordUpdate): Promise<void> {
    const { password } = passwordUpdateSchema.parse(input);
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw toAuthenticationError(error);
  }
}
