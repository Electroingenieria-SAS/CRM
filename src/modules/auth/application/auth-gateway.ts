import type {
  PasswordResetRequest,
  PasswordUpdate,
  SignInInput,
} from '@/modules/auth/application/auth.schemas';

export interface AuthSession {
  readonly userId: string;
  readonly email: string | null;
  readonly expiresAt: number | null;
}

export interface AuthGateway {
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  requestPasswordReset(input: PasswordResetRequest, redirectTo?: string): Promise<void>;
  updatePassword(input: PasswordUpdate): Promise<void>;
}
