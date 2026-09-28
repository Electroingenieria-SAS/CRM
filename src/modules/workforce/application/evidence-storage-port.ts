export interface EvidenceUploadRequest {
  readonly organizationId: string;
  readonly activityId: string;
  readonly evidenceType: string;
  readonly file: File;
}

export interface StoredEvidence {
  readonly storageProvider: string;
  readonly storageReference: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly capturedAt: string;
}

export interface EvidenceStoragePort {
  upload(request: EvidenceUploadRequest): Promise<StoredEvidence>;
}
