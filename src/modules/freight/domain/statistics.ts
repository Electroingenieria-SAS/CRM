export interface QuartileSummary {
  readonly p25: number;
  readonly median: number;
  readonly p75: number;
  readonly iqr: number;
  readonly lowerFence: number;
  readonly upperFence: number;
}

export type FreightEvidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) throw new Error('Se requiere al menos una observación.');
  if (percentileValue < 0 || percentileValue > 1) {
    throw new Error('El percentil debe estar entre 0 y 1.');
  }

  const ordered = [...values].sort((a, b) => a - b);
  const position = (ordered.length - 1) * percentileValue;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) return ordered[lower] as number;

  const weight = position - lower;
  return (ordered[lower] as number) * (1 - weight) + (ordered[upper] as number) * weight;
}

export function quartiles(values: readonly number[]): QuartileSummary {
  const p25 = percentile(values, 0.25);
  const median = percentile(values, 0.5);
  const p75 = percentile(values, 0.75);
  const iqr = p75 - p25;

  return {
    p25,
    median,
    p75,
    iqr,
    lowerFence: p25 - 1.5 * iqr,
    upperFence: p75 + 1.5 * iqr,
  };
}

export function removeIqrOutliers(values: readonly number[]): readonly number[] {
  if (values.length < 4) return [...values];
  const summary = quartiles(values);
  return values.filter((value) => value >= summary.lowerFence && value <= summary.upperFence);
}

export function freightRecencyFactor(ageDays: number): number {
  if (ageDays <= 180) return 1;
  if (ageDays <= 365) return 0.85;
  if (ageDays <= 730) return 0.65;
  return 0.4;
}

export function classifyFreightEvidence(input: {
  scope: 'CITY' | 'DEPARTMENT' | 'NATIONAL';
  samples: number;
  relativeSpread: number;
  freshnessFactor: number;
}): FreightEvidenceLevel {
  const { scope, samples, relativeSpread, freshnessFactor } = input;

  if (scope === 'CITY' && samples >= 10 && relativeSpread <= 0.8 && freshnessFactor >= 0.85) {
    return 'HIGH';
  }

  const enoughSamples =
    (scope === 'CITY' && samples >= 5) ||
    (scope === 'DEPARTMENT' && samples >= 12) ||
    (scope === 'NATIONAL' && samples >= 50);

  if (enoughSamples && relativeSpread <= 1.5 && freshnessFactor >= 0.65) {
    return 'MEDIUM';
  }

  return samples > 0 ? 'LOW' : 'NONE';
}

export interface FreightEstimateSample {
  readonly low: number;
  readonly mid: number;
  readonly high: number;
  readonly samples: number;
}

export function weightedFreightEstimate(
  values: readonly FreightEstimateSample[],
): FreightEstimateSample | null {
  const usable = values.filter((value) => value.samples > 0);
  const samples = usable.reduce((total, value) => total + value.samples, 0);
  if (!samples) return null;

  const weighted = (field: 'low' | 'mid' | 'high') =>
    usable.reduce((total, value) => total + value[field] * value.samples, 0) / samples;

  return {
    low: weighted('low'),
    mid: weighted('mid'),
    high: weighted('high'),
    samples,
  };
}
