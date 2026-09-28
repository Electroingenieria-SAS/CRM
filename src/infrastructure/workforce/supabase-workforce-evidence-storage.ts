import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EvidenceStoragePort,
  EvidenceUploadRequest,
  StoredEvidence,
} from '@/modules/workforce/application/evidence-storage-port';
import { AppError } from '@/shared/errors/app-error';

function safeFileName(value: string): string {
  const normalized = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized.slice(-120) || 'evidence';
}

export class SupabaseWorkforceEvidenceStorage implements EvidenceStoragePort {
  constructor(private readonly client: SupabaseClient) {}

  async upload(request: EvidenceUploadRequest): Promise<StoredEvidence> {
    if (request.file.size < 1 || request.file.size > 15 * 1024 * 1024) {
      throw new AppError('VALIDATION', 'La evidencia debe pesar entre 1 byte y 15 MB.');
    }

    const reference = [
      request.organizationId,
      request.activityId,
      crypto.randomUUID(),
      safeFileName(request.file.name),
    ].join('/');

    const { error } = await this.client.storage
      .from('workforce-evidence')
      .upload(reference, request.file, {
        cacheControl: '3600',
        contentType: request.file.type || undefined,
        upsert: false,
      });

    if (error) {
      throw new AppError('DATABASE', 'No fue posible almacenar la evidencia.');
    }

    return {
      storageProvider: 'SUPABASE_STORAGE',
      storageReference: reference,
      fileName: request.file.name,
      mimeType: request.file.type || 'application/octet-stream',
      sizeBytes: request.file.size,
      capturedAt: new Date().toISOString(),
    };
  }
}
