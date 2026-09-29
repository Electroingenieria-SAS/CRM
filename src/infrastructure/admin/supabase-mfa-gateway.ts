import type { SupabaseClient } from '@supabase/supabase-js';
import { mfaEnrollmentSchema, mfaStatusSchema } from '@/modules/admin/application/admin.schemas';
import type { MfaGateway } from '@/modules/admin/ports/mfa-gateway';
import { AppError } from '@/shared/errors/app-error';

function mfaFailure(message: string) {
  return new AppError('AUTHENTICATION', message);
}

export class SupabaseMfaGateway implements MfaGateway {
  constructor(private readonly client: SupabaseClient) {}

  async status() {
    const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] =
      await Promise.all([
        this.client.auth.mfa.getAuthenticatorAssuranceLevel(),
        this.client.auth.mfa.listFactors(),
      ]);

    if (assuranceError || factorsError) {
      throw mfaFailure('No fue posible consultar el estado de MFA.');
    }

    const allFactors = [
      ...(factors.totp ?? []).map((factor) => ({ ...factor, factorType: 'totp' })),
      ...(factors.phone ?? []).map((factor) => ({ ...factor, factorType: 'phone' })),
    ].map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name ?? null,
      status: factor.status,
      factorType: factor.factorType,
    }));

    return mfaStatusSchema.parse({
      currentLevel: assurance.currentLevel,
      nextLevel: assurance.nextLevel,
      factors: allFactors,
    });
  }

  async enroll() {
    const { data, error } = await this.client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'CRM Electroingeniería',
    });
    if (error) throw mfaFailure('No fue posible iniciar el registro de MFA.');

    return mfaEnrollmentSchema.parse({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async verify(factorId: string, code: string) {
    const { data: challenge, error: challengeError } = await this.client.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) throw mfaFailure('No fue posible crear el desafío MFA.');

    const { error } = await this.client.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (error) throw mfaFailure('El código MFA no es válido.');
  }

  async unenroll(factorId: string) {
    const { error } = await this.client.auth.mfa.unenroll({ factorId });
    if (error) throw mfaFailure('No fue posible retirar el factor MFA.');
  }
}
