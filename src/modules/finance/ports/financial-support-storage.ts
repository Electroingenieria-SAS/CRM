export interface FinancialSupportReference {
  readonly provider: string;
  readonly reference: string;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
}

export interface FinancialSupportStoragePort {
  store(file: File, context: { orderId: string }): Promise<FinancialSupportReference>;
}
