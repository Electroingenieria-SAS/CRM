import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EvidenceStoragePort,
  EvidenceUploadRequest,
  StoredEvidence,
} from '@/modules/workforce/application/evidence-storage-port';
import { AppError } from '@/shared/errors/app-error';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function safeFileName(value: string): string {
  const normalized = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized.slice(-120) || 'evidence';
}

function startsWith(bytes: Uint8Array, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

async function validateFileSignature(file: File): Promise<void> {
  if (!allowedMimeTypes.has(file.type)) {
    throw new AppError('VALIDATION', 'Tipo de archivo no permitido para evidencia.');
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const valid =
    (file.type === 'image/png' &&
      startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (file.type === 'image/jpeg' && startsWith(bytes, [0xff, 0xd8, 0xff])) ||
    (file.type === 'image/webp' &&
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])) ||
    (file.type === 'application/pdf' && startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]));

  if (!valid) {
    throw new AppError(
      'VALIDATION',
      'El contenido del archivo no coincide con un formato de evidencia permitido.',
    );
  }
}

export class SupabaseWorkforceEvidenceStorage implements EvidenceStoragePort {
  constructor(private readonly client: SupabaseClient) {}

  async upload(request: EvidenceUploadRequest): Promise<StoredEvidence> {
    if (request.file.size < 1 || request.file.size > 15 * 1024 * 1024) {
      throw new AppError('VALIDATION', 'La evidencia debe pesar entre 1 byte y 15 MB.');
    }

    await validateFileSignature(request.file);

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
        contentType: request.file.type,
        upsert: false,
      });

    if (error) {
      throw new AppError('DATABASE', 'No fue posible almacenar la evidencia.');
    }

    return {
      storageProvider: 'SUPABASE_STORAGE',
      storageReference: reference,
      fileName: request.file.name,
      mimeType: request.file.type,
      sizeBytes: request.file.size,
      capturedAt: new Date().toISOString(),
    };
  }
}
