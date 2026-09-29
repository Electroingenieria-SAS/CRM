import type { MfaEnrollment, MfaStatus } from '@/modules/admin/application/admin.schemas';

export interface MfaGateway {
  status(): Promise<MfaStatus>;
  enroll(): Promise<MfaEnrollment>;
  verify(factorId: string, code: string): Promise<void>;
  unenroll(factorId: string): Promise<void>;
}
