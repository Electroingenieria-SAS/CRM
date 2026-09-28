import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthGateway,
  AuthSession,
  AuthSessionEvent,
} from '@/modules/auth/application/auth-gateway';
import {
  passwordResetRequestSchema,
  passwordUpdateSchema,
  signInSchema,
  type PasswordResetRequest,
  type PasswordUpdate,
  type SignInInput,
} from '@/modules/auth/application/auth.schemas';
import { AppError } from '@/shared/errors/app-error';

function toAuthSession(session: Session): AuthSession {
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    expiresAt: session.expires_at ?? null,
  };
}

function errorMessage(error: unknown): string {
  return String((error as { message?: unknown })?.message ?? '').toLowerCase();
}

function isEnumerationSafeRecoveryError(error: unknown): boolean {
  const message = errorMessage(error);
  return message.includes('user not found') || message.includes('email not found');
}

function toAuthenticationError(error: unknown): AppError {
  const message = errorMessage(error);

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
    message.includes('expired') ||
    message.includes('invalid flow state') ||
    message.includes('code verifier') ||
    message.includes('pkce')
  ) {
    return new AppError(
      'AUTHENTICATION',
      'El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.',
    );
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

function toSessionEvent(event: AuthChangeEvent, session: Session | null): AuthSessionEvent | null {
  if (event === 'SIGNED_OUT') return { type: 'signed_out' };
  if (!session || event === 'INITIAL_SESSION') return null;
  return { type: 'session_changed', session: toAuthSession(session) };
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async signIn(input: SignInInput): Promise<AuthSession> {
    const credentials = signInSchema.parse(input);
    const { data, error } = await this.client.auth.signInWithPassword(credentials);

    if (error || !data.session) throw toAuthenticationError(error);
    return toAuthSession(data.session);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw toAuthenticationError(error);
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw toAuthenticationError(error);
    return data.session ? toAuthSession(data.session) : null;
  }

  async requestPasswordReset(input: PasswordResetRequest, redirectTo?: string): Promise<void> {
    const { email } = passwordResetRequestSchema.parse(input);
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (error && !isEnumerationSafeRecoveryError(error)) {
      throw toAuthenticationError(error);
    }
  }

  async exchangeRecoveryCode(code: string, flowId?: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );

    if (error || !data.session) throw toAuthenticationError(error);
    return toAuthSession(data.session);
  }

  async updatePassword(input: PasswordUpdate): Promise<void> {
    const { password } = passwordUpdateSchema.parse(input);
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw toAuthenticationError(error);
  }

  onSessionChange(listener: (event: AuthSessionEvent) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      const nextEvent = toSessionEvent(event, session);
      if (nextEvent) listener(nextEvent);
    });

    return () => data.subscription.unsubscribe();
  }
}
