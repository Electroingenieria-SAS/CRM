export interface OrderEvidenceUploadRequest {
  readonly organizationId: string;
  readonly orderId: string;
  readonly evidenceType: string;
  readonly file: File;
}

export interface StoredOrderEvidence {
  readonly storageProvider: string;
  readonly storageReference: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface OrderEvidenceStoragePort {
  upload(request: OrderEvidenceUploadRequest): Promise<StoredOrderEvidence>;
}
