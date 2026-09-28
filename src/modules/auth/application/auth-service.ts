import { ZodError } from 'zod';
import type {
  AuthGateway,
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
import type { SessionRepository } from '@/modules/auth/application/session-repository';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import { AppError } from '@/shared/errors/app-error';

function validationError(error: ZodError): AppError {
  return new AppError(
    'VALIDATION',
    error.issues[0]?.message ?? 'Revisa los datos ingresados e inténtalo nuevamente.',
  );
}

function parseInput<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ZodError) throw validationError(error);
    throw error;
  }
}

export interface PasswordRecoveryInput {
  readonly code?: string | null;
  readonly flowId?: string | null;
}

export class AuthService {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly sessions: SessionRepository,
  ) {}

  async signIn(input: SignInInput): Promise<SessionContext> {
    const credentials = parseInput(() => signInSchema.parse(input));
    await this.gateway.signIn(credentials);

    try {
      return await this.sessions.load();
    } catch (error) {
      await this.gateway.signOut();
      throw error;
    }
  }

  async restoreContext(): Promise<SessionContext | null> {
    const session = await this.gateway.getSession();
    if (!session) return null;

    if (session.expiresAt !== null && session.expiresAt <= Math.floor(Date.now() / 1000)) {
      await this.gateway.signOut();
      return null;
    }

    return this.sessions.load();
  }

  signOut(): Promise<void> {
    return this.gateway.signOut();
  }

  requestPasswordReset(input: PasswordResetRequest, redirectTo?: string): Promise<void> {
    const request = parseInput(() => passwordResetRequestSchema.parse(input));
    return this.gateway.requestPasswordReset(request, redirectTo);
  }

  async preparePasswordRecovery(input: PasswordRecoveryInput): Promise<void> {
    const code = input.code?.trim();
    const flowId = input.flowId?.trim();

    if (code) {
      await this.gateway.exchangeRecoveryCode(code, flowId || undefined);
    }

    const session = await this.gateway.getSession();
    if (!session) {
      throw new AppError(
        'AUTHENTICATION',
        'El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.',
      );
    }
  }

  updatePassword(input: PasswordUpdate): Promise<void> {
    const password = parseInput(() => passwordUpdateSchema.parse(input));
    return this.gateway.updatePassword(password);
  }

  onSessionChange(listener: (event: AuthSessionEvent) => void): () => void {
    return this.gateway.onSessionChange(listener);
  }
}
