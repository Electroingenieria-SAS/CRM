export interface StageBusinessSeconds {
  waiting: number;
  processing: number;
  blocked: number;
  transit: number;
  total: number;
}

function nonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(label + ' debe ser un número no negativo.');
  }
  return value;
}

export function stageBusinessSeconds(
  waitingSeconds: number,
  activeSeconds: number,
  blockedSeconds: number,
  transitSeconds = 0,
): StageBusinessSeconds {
  const waiting = nonNegative(waitingSeconds, 'waitingSeconds');
  const active = nonNegative(activeSeconds, 'activeSeconds');
  const blocked = nonNegative(blockedSeconds, 'blockedSeconds');
  const transit = nonNegative(transitSeconds, 'transitSeconds');
  if (blocked > active) throw new Error('blockedSeconds no puede superar activeSeconds.');

  const processing = active - blocked;
  return {
    waiting,
    processing,
    blocked,
    transit,
    total: waiting + processing + blocked + transit,
  };
}

export function percentileCont(values: readonly number[], percentile: number) {
  if (!values.length) return 0;
  if (!Number.isFinite(percentile) || percentile < 0 || percentile > 1) {
    throw new Error('El percentil debe estar entre 0 y 1.');
  }
  const sorted = values.map((value) => nonNegative(value, 'valor')).sort((a, b) => a - b);
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function inclusiveDateDays(from: string, to: string) {
  const start = Date.parse(from + 'T00:00:00Z');
  const end = Date.parse(to + 'T00:00:00Z');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error('Rango de fechas inválido.');
  }
  return Math.floor((end - start) / 86_400_000) + 1;
}
