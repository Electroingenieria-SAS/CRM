export const workforceActivityStatuses = [
  'PLANNED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type WorkforceActivityStatus = (typeof workforceActivityStatuses)[number];

export const workforceOccupancyStatuses = [
  'AVAILABLE',
  'OCCUPIED',
  'BLOCKED',
  'OUT_OF_SCHEDULE',
] as const;

export type WorkforceOccupancyStatus = (typeof workforceOccupancyStatuses)[number];

export const workforceTimeSignals = ['NORMAL', 'OVER_60_MINUTES'] as const;
export type WorkforceTimeSignal = (typeof workforceTimeSignals)[number];

export const workforceEvidencePolicies = [
  'NONE',
  'FINAL_PHOTO',
  'BEFORE_AFTER',
  'FILE',
  'LINK',
  'ERP_REFERENCE',
] as const;

export type WorkforceEvidencePolicy = (typeof workforceEvidencePolicies)[number];

export interface WorkforceDaySlot {
  readonly key: string;
  readonly label: string;
  readonly startMinutes: number;
  readonly endMinutes: number;
}

export interface WorkforceActivitySummary {
  readonly id: string;
  readonly assigneeProfileId: string;
  readonly assigneeName: string;
  readonly title: string;
  readonly categoryLabel: string;
  readonly subcategory: string;
  readonly status: WorkforceActivityStatus;
  readonly plannedStart: string;
  readonly plannedEnd: string;
  readonly actualStart: string | null;
  readonly actualEnd: string | null;
  readonly orderId: string | null;
  readonly orderNumber: string | null;
  readonly occupancy: WorkforceOccupancyStatus;
  readonly timeSignal: WorkforceTimeSignal;
  readonly evidenceCount: number;
  readonly version: number;
}

export interface WorkforceEvidenceReference {
  readonly evidenceType:
    | 'BEFORE_PHOTO'
    | 'AFTER_PHOTO'
    | 'FINAL_PHOTO'
    | 'FILE'
    | 'LINK'
    | 'ERP_REFERENCE';
  readonly storageProvider: string;
  readonly storageReference: string;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
  readonly capturedAt?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
