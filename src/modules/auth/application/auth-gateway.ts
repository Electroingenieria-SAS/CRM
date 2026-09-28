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

export type AuthSessionEvent =
  | { readonly type: 'signed_out' }
  | { readonly type: 'session_changed'; readonly session: AuthSession };

export interface AuthGateway {
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  requestPasswordReset(input: PasswordResetRequest, redirectTo?: string): Promise<void>;
  exchangeRecoveryCode(code: string, flowId?: string): Promise<AuthSession>;
  updatePassword(input: PasswordUpdate): Promise<void>;
  onSessionChange(listener: (event: AuthSessionEvent) => void): () => void;
}
