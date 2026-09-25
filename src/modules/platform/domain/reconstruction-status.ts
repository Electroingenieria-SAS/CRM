export type GateState = 'validated' | 'in-progress' | 'blocked' | 'pending';

export interface ReconstructionGate {
  readonly id: string;
  readonly label: string;
  readonly state: GateState;
  readonly detail: string;
}

export interface ReconstructionStatus {
  readonly baselineCommit: string;
  readonly sourceVersion: string;
  readonly targetVersion: string;
  readonly environment: 'staging';
  readonly gates: readonly ReconstructionGate[];
}
