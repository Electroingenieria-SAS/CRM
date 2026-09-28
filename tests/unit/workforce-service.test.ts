import { describe, expect, it, vi } from 'vitest';
import type { EvidenceStoragePort } from '@/modules/workforce/application/evidence-storage-port';
import type { WorkforceRepository } from '@/modules/workforce/application/workforce-repository';
import { WorkforceService } from '@/modules/workforce/application/workforce-service';

function repository(): WorkforceRepository {
  const mutation = {
    success: true as const,
    idempotent: false,
    activityId: '00000000-0000-0000-0000-000000000001',
    version: 2,
    contractVersion: '1.0.0',
  };

  return {
    catalog: vi.fn(),
    schedule: vi.fn(),
    detail: vi.fn(),
    indicators: vi.fn(),
    create: vi.fn(async () => mutation),
    assign: vi.fn(async () => mutation),
    start: vi.fn(async () => mutation),
    block: vi.fn(async () => mutation),
    resume: vi.fn(async () => mutation),
    complete: vi.fn(async () => mutation),
    cancel: vi.fn(async () => mutation),
    addEvidence: vi.fn(async () => mutation),
  };
}

describe('workforce service', () => {
  it('rejects invalid versions and empty idempotency keys', () => {
    const service = new WorkforceService(repository(), { upload: vi.fn() });
    expect(() => service.start('activity', 0, 'key')).toThrow('versión');
    expect(() => service.start('activity', 1, ' ')).toThrow('idempotencia');
  });

  it('validates scheduling before repository delegation', async () => {
    const repo = repository();
    const service = new WorkforceService(repo, { upload: vi.fn() });

    await service.create(
      {
        catalogId: '00000000-0000-0000-0000-000000000010',
        plannedStart: '2026-09-29T07:00:00-05:00',
        plannedEnd: '2026-09-29T09:00:00-05:00',
        metadata: {},
      },
      'create-1',
    );

    expect(repo.create).toHaveBeenCalledOnce();
  });

  it('stores binary evidence through a port before registering its reference', async () => {
    const repo = repository();
    const storage: EvidenceStoragePort = {
      upload: vi.fn(async () => ({
        storageProvider: 'TEST',
        storageReference: 'org/activity/file',
        fileName: 'photo.png',
        mimeType: 'image/png',
        sizeBytes: 4,
        capturedAt: '2026-09-29T14:00:00.000Z',
      })),
    };
    const service = new WorkforceService(repo, storage);
    const file = new File(['test'], 'photo.png', { type: 'image/png' });

    await service.uploadEvidence({
      organizationId: '00000000-0000-0000-0000-000000000100',
      activityId: '00000000-0000-0000-0000-000000000001',
      evidenceType: 'FINAL_PHOTO',
      file,
      idempotencyKey: 'evidence-1',
    });

    expect(storage.upload).toHaveBeenCalledOnce();
    expect(repo.addEvidence).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      expect.objectContaining({
        evidenceType: 'FINAL_PHOTO',
        storageProvider: 'TEST',
        storageReference: 'org/activity/file',
      }),
      'evidence-1',
    );
  });
});
