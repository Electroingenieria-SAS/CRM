import type { Session } from '@supabase/supabase-js';
import type {
  PasswordResetRequest,
  PasswordUpdate,
  SignInInput,
} from '@/modules/auth/application/auth.schemas';

export interface AuthGateway {
  signIn(input: SignInInput): Promise<Session>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  requestPasswordReset(input: PasswordResetRequest, redirectTo?: string): Promise<void>;
  updatePassword(input: PasswordUpdate): Promise<void>;
}
