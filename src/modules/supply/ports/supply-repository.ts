import type {
  CuttingJobInput,
  PickingJobInput,
  PurchaseOrderInput,
  PurchaseRequestInput,
  ReceiptInput,
  SupplyArea,
  SupplyMutation,
  SupplyQueue,
} from '@/modules/supply/application/supply.schemas';

export interface SupplyRepository {
  queue(area: SupplyArea, status?: string, search?: string, page?: number, pageSize?: number): Promise<SupplyQueue>;
  createPurchaseRequest(input: PurchaseRequestInput, key: string): Promise<SupplyMutation>;
  issuePurchaseOrder(input: PurchaseOrderInput, key: string): Promise<SupplyMutation>;
  createReceipt(input: ReceiptInput, key: string): Promise<SupplyMutation>;
  confirmReceiptLine(lineId: string, movementId: string | undefined, key: string): Promise<SupplyMutation>;
  createPickingJob(input: PickingJobInput, key: string): Promise<SupplyMutation>;
  syncPickingLine(lineId: string, reservationId: string, pickedQuantity: number, key: string): Promise<SupplyMutation>;
  createCuttingJob(input: CuttingJobInput, key: string): Promise<SupplyMutation>;
  startCutting(jobId: string, key: string): Promise<SupplyMutation>;
  syncCuttingLine(
    lineId: string,
    consumed: number,
    reusable: number,
    waste: number,
    key: string,
  ): Promise<SupplyMutation>;
  completeCutting(jobId: string, evidenceId: string | undefined, key: string): Promise<SupplyMutation>;
}
